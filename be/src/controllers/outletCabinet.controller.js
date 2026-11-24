const prisma = require('../config/prisma');
const { sendSuccess, sendError } = require('../utils/response');
const { generateQrDataUrl } = require('../utils/qrcode');

/**
 * Get List of Cabinets in Outlet
 */
const getOutletCabinets = async (req, res, next) => {
  try {
    const user = req.user;
    const { outletLocationId, search } = req.query;

    let targetLocId = user.locationId;
    if (user.role === 'SUPER_ADMIN') {
      if (outletLocationId) {
        targetLocId = outletLocationId;
      } else {
        const firstOutlet = await prisma.location.findFirst({
          where: { type: 'OUTLET_HUB' },
        });
        if (firstOutlet) targetLocId = firstOutlet.id;
      }
    }

    const where = {
      locationId: targetLocId,
    };

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [location, cabinets] = await Promise.all([
      prisma.location.findUnique({ where: { id: targetLocId } }),
      prisma.cabinet.findMany({
        where,
        orderBy: { code: 'asc' },
        include: {
          slots: {
            orderBy: { slotNumber: 'asc' },
            include: {
              drawers: {
                include: {
                  items: {
                    where: { currentStatus: 'IN_OUTLET' },
                    select: { id: true, brand: true, weight: true, rfidTag: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const formattedCabinets = cabinets.map((c) => {
      const allDrawers = c.slots.flatMap((s) => s.drawers);
      const totalCapacity = allDrawers.reduce((acc, d) => acc + (d.capacity || 0), 0);
      const allItems = allDrawers.flatMap((d) => d.items);
      const usedCapacity = allItems.length;
      const totalWeight = allItems.reduce((acc, it) => acc + (it.weight || 0), 0);
      const rfidTaggedCount = allItems.filter((it) => !!it.rfidTag).length;

      return {
        id: c.id,
        code: c.code,
        name: c.name,
        totalSlots: c.totalSlots,
        drawerCount: allDrawers.length,
        totalCapacity,
        usedCapacity,
        availableCapacity: Math.max(0, totalCapacity - usedCapacity),
        totalWeightGrams: Number(totalWeight.toFixed(2)),
        rfidTaggedCount,
        qrCode: c.qrCode,
        description: c.description,
        createdAt: c.createdAt,
      };
    });

    return sendSuccess(
      res,
      {
        location: {
          id: location?.id,
          code: location?.code,
          name: location?.name,
        },
        cabinets: formattedCabinets,
      },
      'Daftar Lemari RFID Cabang berhasil dimuat',
      200
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Get Detail of Cabinet in Outlet with Drawers and Grid Slots
 */
const getOutletCabinetDetail = async (req, res, next) => {
  try {
    const { code } = req.params;

    const cabinet = await prisma.cabinet.findFirst({
      where: {
        OR: [{ code: code.toUpperCase() }, { id: code }],
      },
      include: {
        location: true,
        slots: {
          orderBy: { slotNumber: 'asc' },
          include: {
            drawers: {
              orderBy: { code: 'asc' },
              include: {
                items: {
                  where: { currentStatus: 'IN_OUTLET' },
                  orderBy: { slotPosition: 'asc' },
                  select: {
                    id: true,
                    brand: true,
                    weight: true,
                    purity: true,
                    qrCode: true,
                    rfidTag: true,
                    currentStatus: true,
                    slotPosition: true,
                    sbgNumber: true,
                    notes: true,
                    updatedAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cabinet) {
      return sendError(res, `Lemari ${code} tidak ditemukan`, 404);
    }

    // Generate QR Data URL for Cabinet
    const qrDataUrl = await generateQrDataUrl(cabinet.qrCode || `QR-${cabinet.code}`);

    // Format slots and drawers
    const formattedSlots = await Promise.all(
      cabinet.slots.map(async (slot) => {
        const slotQrUrl = await generateQrDataUrl(slot.qrCode || `QR-${cabinet.code}-SL${slot.slotNumber}`);

        const drawersWithQr = await Promise.all(
          slot.drawers.map(async (drw) => {
            const drwQrUrl = await generateQrDataUrl(drw.qrCode || `QR-${drw.code}`);
            const items = drw.items || [];
            const rows = drw.rows || 6;
            const cols = drw.cols || 55;
            const capacity = drw.capacity || rows * cols;

            // Map grid matrix items by slotPosition e.g. "R1-01" s/d "R6-55" or index
            const itemMap = {};
            items.forEach((it) => {
              if (it.slotPosition) {
                itemMap[it.slotPosition.toUpperCase()] = it;
              }
            });

            return {
              ...drw,
              rows,
              cols,
              capacity,
              usedCapacity: items.length,
              availableCapacity: Math.max(0, capacity - items.length),
              rfidAntenna: drw.rfidAntenna || 'ANT-01',
              antennaStatus: 'ONLINE',
              qrDataUrl: drwQrUrl,
              items,
              itemMap,
            };
          })
        );

        return {
          ...slot,
          qrDataUrl: slotQrUrl,
          drawers: drawersWithQr,
        };
      })
    );

    const allDrawers = formattedSlots.flatMap((s) => s.drawers);
    const totalCapacity = allDrawers.reduce((acc, d) => acc + d.capacity, 0);
    const usedCapacity = allDrawers.reduce((acc, d) => acc + d.usedCapacity, 0);

    return sendSuccess(
      res,
      {
        cabinet: {
          ...cabinet,
          qrDataUrl,
          totalCapacity,
          usedCapacity,
          availableCapacity: Math.max(0, totalCapacity - usedCapacity),
          slots: formattedSlots,
          drawers: allDrawers,
        },
      },
      `Detail Lemari RFID ${cabinet.code} berhasil dimuat`,
      200
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Create New Outlet RFID Cabinet (Dynamic Drawers, Rows, Cols)
 */
const createOutletCabinet = async (req, res, next) => {
  try {
    const user = req.user;
    const {
      name,
      code,
      locationId,
      totalDrawers = 10,
      rowsPerDrawer = 6,
      colsPerDrawer = 55,
      description,
    } = req.body;

    if (!name || !name.trim()) {
      return sendError(res, 'Nama Lemari wajib diisi', 400);
    }
    if (!code || !code.trim()) {
      return sendError(res, 'Kode Lemari unik wajib diisi', 400);
    }

    const cleanCode = code.trim().toUpperCase();
    const existing = await prisma.cabinet.findUnique({
      where: { code: cleanCode },
    });
    if (existing) {
      return sendError(res, `Kode Lemari ${cleanCode} sudah terdaftar! Gunakan kode lain.`, 400);
    }

    let targetLocId = user.locationId;
    if (user.role === 'SUPER_ADMIN') {
      if (locationId) {
        targetLocId = locationId;
      } else {
        const firstOutlet = await prisma.location.findFirst({
          where: { type: 'OUTLET_HUB' },
        });
        if (firstOutlet) targetLocId = firstOutlet.id;
      }
    }

    const location = await prisma.location.findUnique({ where: { id: targetLocId } });
    if (!location) {
      return sendError(res, 'Lokasi tujuan Outlet tidak ditemukan', 400);
    }

    const numDrawers = parseInt(totalDrawers, 10) || 10;
    const numRows = parseInt(rowsPerDrawer, 10) || 6;
    const numCols = parseInt(colsPerDrawer, 10) || 55;
    const drawerCap = numRows * numCols;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Cabinet
      const newCab = await tx.cabinet.create({
        data: {
          code: cleanCode,
          name: name.trim(),
          locationId: targetLocId,
          qrCode: `QR-${cleanCode}`,
          totalSlots: numDrawers,
          description: description ? description.trim() : `Lemari RFID Modular (${numDrawers} Laci x ${numRows} Row x ${numCols} Item = ${numDrawers * drawerCap} Kapasitas)`,
        },
      });

      // 2. Loop create slots and drawers
      for (let i = 1; i <= numDrawers; i++) {
        const slot = await tx.cabinetSlot.create({
          data: {
            cabinetId: newCab.id,
            slotNumber: i,
            modularType: 'BIG_DRAWER',
            qrCode: `QR-${cleanCode}-SL${String(i).padStart(2, '0')}`,
          },
        });

        const drwCode = `DRW-${cleanCode}-L${String(i).padStart(2, '0')}`;
        const antennaCode = `ANT-${cleanCode}-L${String(i).padStart(2, '0')}`;

        await tx.drawer.create({
          data: {
            code: drwCode,
            name: `Laci ${String(i).padStart(2, '0')} (Grid ${numRows}x${numCols})`,
            slotId: slot.id,
            qrCode: `QR-${drwCode}`,
            rfidAntenna: antennaCode,
            category: i <= 3 ? 'Emas 1g - 5g' : i <= 6 ? 'Emas 10g - 25g' : i <= 8 ? 'Emas >= 50g' : 'Tebusan / Titipan',
            rows: numRows,
            cols: numCols,
            capacity: drawerCap,
          },
        });
      }

      // 3. Audit Trail
      await tx.auditTrail.create({
        data: {
          action: 'CREATE_OUTLET_CABINET',
          actor: user.username,
          locationCode: location.code,
          details: `Membuat Lemari RFID ${cleanCode} (${numDrawers} Laci, Grid ${numRows}x${numCols} = ${numDrawers * drawerCap} Kapasitas) di ${location.name}`,
          ipAddress: req.ip,
        },
      });

      return newCab;
    });

    return sendSuccess(
      res,
      result,
      `Lemari RFID ${cleanCode} dengan ${numDrawers} Laci (Grid ${numRows}x${numCols}) berhasil dibuat!`,
      201
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Update Drawer Configuration (Rows, Cols, Capacity, RFID Antenna, Category)
 */
const updateOutletDrawer = async (req, res, next) => {
  try {
    const { drawerId } = req.params;
    const { name, category, rows, cols, capacity, rfidAntenna } = req.body;

    const drawer = await prisma.drawer.findUnique({
      where: { id: drawerId },
      include: { slot: { include: { cabinet: true } } },
    });

    if (!drawer) {
      return sendError(res, 'Laci tidak ditemukan', 404);
    }

    const numRows = rows !== undefined ? parseInt(rows, 10) : drawer.rows;
    const numCols = cols !== undefined ? parseInt(cols, 10) : drawer.cols;
    const finalCapacity = capacity !== undefined ? parseInt(capacity, 10) : numRows * numCols;

    const updated = await prisma.drawer.update({
      where: { id: drawerId },
      data: {
        name: name ? name.trim() : drawer.name,
        category: category !== undefined ? category : drawer.category,
        rows: numRows,
        cols: numCols,
        capacity: finalCapacity,
        rfidAntenna: rfidAntenna !== undefined ? rfidAntenna.trim().toUpperCase() : drawer.rfidAntenna,
      },
    });

    return sendSuccess(res, updated, `Konfigurasi Laci ${updated.code} berhasil diperbarui`, 200);
  } catch (err) {
    next(err);
  }
};

/**
 * Delete Cabinet (only if empty)
 */
const deleteOutletCabinet = async (req, res, next) => {
  try {
    const { id } = req.params;

    const cabinet = await prisma.cabinet.findFirst({
      where: { OR: [{ id }, { code: id }] },
      include: {
        slots: {
          include: {
            drawers: {
              include: {
                items: { where: { currentStatus: 'IN_OUTLET' } },
              },
            },
          },
        },
      },
    });

    if (!cabinet) {
      return sendError(res, 'Lemari tidak ditemukan', 404);
    }

    const totalItems = cabinet.slots.flatMap((s) => s.drawers.flatMap((d) => d.items)).length;
    if (totalItems > 0) {
      return sendError(
        res,
        `Lemari ${cabinet.code} tidak dapat dihapus karena masih menyimpan ${totalItems} keping emas di dalamnya! Relokasikan atau kosongkan emas terlebih dahulu.`,
        400
      );
    }

    await prisma.cabinet.delete({ where: { id: cabinet.id } });

    return sendSuccess(res, { id: cabinet.id, code: cabinet.code }, `Lemari ${cabinet.code} berhasil dihapus`, 200);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getOutletCabinets,
  getOutletCabinetDetail,
  createOutletCabinet,
  updateOutletDrawer,
  deleteOutletCabinet,
};

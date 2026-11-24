const prisma = require('../config/prisma');
const { sendSuccess, sendError } = require('../utils/response');
const {
  generateQrDataUrl,
  buildCabinetQrPayload,
  buildDrawerQrPayload,
} = require('../utils/qrcode');

/**
 * Get all 32 cabinets in HO with stats
 */
const getAllCabinets = async (req, res, next) => {
  try {
    const hoLocation = await prisma.location.findFirst({
      where: { type: 'HEAD_OFFICE' },
    });

    if (!hoLocation) {
      return sendError(res, 'Lokasi Head Office tidak ditemukan', 404);
    }

    const cabinets = await prisma.cabinet.findMany({
      where: { locationId: hoLocation.id },
      orderBy: { code: 'asc' },
      include: {
        slots: {
          include: {
            drawers: {
              include: {
                _count: {
                  select: {
                    items: {
                      where: {
                        currentStatus: {
                          in: ['IN_HO', 'ALLOCATED_PO'],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Format metrics per cabinet with QR Data URL
    const formatted = await Promise.all(
      cabinets.map(async (cab) => {
        let totalCapacity = 0;
        let totalOccupied = 0;
        let totalDrawers = 0;
        let bigDrawersCount = 0;
        let smallDrawersCount = 0;

        cab.slots.forEach((slot) => {
          slot.drawers.forEach((drw) => {
            totalDrawers++;
            totalCapacity += drw.capacity;
            totalOccupied += drw._count.items;
            if (slot.modularType === 'BIG_DRAWER') {
              bigDrawersCount++;
            } else {
              smallDrawersCount++;
            }
          });
        });

        const qrDataUrl = await generateQrDataUrl(cab.qrCode);

        return {
          id: cab.id,
          code: cab.code,
          name: cab.name,
          qrCode: cab.qrCode,
          qrDataUrl,
          totalSlots: cab.totalSlots,
          totalDrawers,
          bigDrawersCount,
          smallDrawersCount,
          totalCapacity,
          totalOccupied,
          totalFree: Math.max(0, totalCapacity - totalOccupied),
          occupancyRate: totalCapacity > 0 ? `${((totalOccupied / totalCapacity) * 100).toFixed(1)}%` : '0.0%',
          metrics: {
            totalCapacity,
            totalOccupied,
            totalFree: Math.max(0, totalCapacity - totalOccupied),
            occupancyRate: totalCapacity > 0 ? `${((totalOccupied / totalCapacity) * 100).toFixed(1)}%` : '0.0%',
          },
        };
      })
    );

    return sendSuccess(res, formatted, 'Daftar 32 Lemari Vault HO');
  } catch (err) {
    next(err);
  }
};

/**
 * Get specific Cabinet details by Code e.g. "HO-CAB-01"
 */
const getCabinetByCode = async (req, res, next) => {
  try {
    const { code } = req.params;

    const cabinet = await prisma.cabinet.findFirst({
      where: {
        OR: [
          { code: code.toUpperCase() },
          { id: code }
        ]
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
                  where: {
                    currentStatus: { in: ['IN_HO', 'ALLOCATED_PO'] },
                  },
                  orderBy: { slotPosition: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!cabinet) {
      return sendError(res, `Lemari dengan kode atau ID ${code} tidak ditemukan`, 404);
    }

    // Compute metrics, drawer counts, and QR Data URLs for slots and drawers
    let totalCapacity = 0;
    let totalOccupied = 0;
    for (const slot of cabinet.slots) {
      const standardSlotQr = slot.qrCode || `QR-${cabinet.code}-SLOT-${String(slot.slotNumber).padStart(2, '0')}`;
      slot.qrCode = standardSlotQr;
      slot.qrDataUrl = await generateQrDataUrl(standardSlotQr);

      for (const drw of slot.drawers) {
        totalCapacity += drw.capacity;
        const itemCount = drw.items ? drw.items.length : 0;
        totalOccupied += itemCount;
        drw._count = { items: itemCount };
        const drwQrPayload = drw.qrCode || buildDrawerQrPayload(drw.code);
        drw.qrDataUrl = await generateQrDataUrl(drwQrPayload);
      }
    }

    const metrics = {
      totalCapacity,
      totalOccupied,
      totalFree: Math.max(0, totalCapacity - totalOccupied),
      occupancyRate: totalCapacity > 0 ? `${((totalOccupied / totalCapacity) * 100).toFixed(1)}%` : '0.0%',
    };

    // QR Data URL
    const qrDataUrl = await generateQrDataUrl(cabinet.qrCode);

    return sendSuccess(
      res,
      {
        ...cabinet,
        metrics,
        totalCapacity,
        totalOccupied,
        totalFree: metrics.totalFree,
        occupancyRate: metrics.occupancyRate,
        cabinet: {
          ...cabinet,
          metrics,
          totalCapacity,
          totalOccupied,
          totalFree: metrics.totalFree,
          occupancyRate: metrics.occupancyRate,
        },
        qrDataUrl,
      },
      `Detail Lemari ${cabinet.code}`
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Supervisor only: Switch a slot's modular type (BIG_DRAWER <-> SMALL_CLUSTER)
 */
const switchSlotModularType = async (req, res, next) => {
  try {
    const { cabinetCode, slotNumber } = req.params;
    const { targetModularType } = req.body; // 'BIG_DRAWER' | 'SMALL_CLUSTER'

    if (!['BIG_DRAWER', 'SMALL_CLUSTER'].includes(targetModularType)) {
      return sendError(res, 'Tipe modular tidak valid. Gunakan BIG_DRAWER atau SMALL_CLUSTER', 400);
    }

    const cabinet = await prisma.cabinet.findUnique({
      where: { code: cabinetCode.toUpperCase() },
      include: {
        slots: {
          where: { slotNumber: parseInt(slotNumber, 10) },
          include: {
            drawers: {
              include: {
                items: {
                  where: { currentStatus: { in: ['IN_HO', 'ALLOCATED_PO'] } },
                },
              },
            },
          },
        },
      },
    });

    if (!cabinet || cabinet.slots.length === 0) {
      return sendError(res, `Slot ${slotNumber} pada lemari ${cabinetCode} tidak ditemukan`, 404);
    }

    const slot = cabinet.slots[0];

    // Check if any drawer contains active items
    const hasItems = slot.drawers.some((d) => d.items.length > 0);
    if (hasItems) {
      return sendError(
        res,
        `Tidak dapat mengubah tipe modular slot ${slotNumber} karena masih memuat keping emas aktif. Pindahkan keping emas terlebih dahulu.`,
        400
      );
    }

    // If changing, delete old drawers and create new drawers matching targetModularType
    await prisma.$transaction(async (tx) => {
      // Delete old drawers
      await tx.drawer.deleteMany({
        where: { slotId: slot.id },
      });

      // Update modularType
      await tx.cabinetSlot.update({
        where: { id: slot.id },
        data: { modularType: targetModularType },
      });

      if (targetModularType === 'BIG_DRAWER') {
        // Create 1 Big Drawer
        await tx.drawer.create({
          data: {
            code: `${cabinet.code}-SL0${slotNumber}-DRW-BIG`,
            name: `Laci Besar S0${slotNumber} (${cabinet.code})`,
            slotId: slot.id,
            qrCode: `QR-${cabinet.code}-SL0${slotNumber}-BIG`,
            category: 'Emas Batangan Besar (>= 25g)',
            capacity: 24,
            rows: 4,
            cols: 6,
          },
        });
      } else {
        // Create 8 Small Drawers
        for (let k = 1; k <= 8; k++) {
          await tx.drawer.create({
            data: {
              code: `${cabinet.code}-SL0${slotNumber}-DRW-S0${k}`,
              name: `Laci Kecil S0${slotNumber} Cluster ${k} (${cabinet.code})`,
              slotId: slot.id,
              qrCode: `QR-${cabinet.code}-SL0${slotNumber}-S0${k}`,
              category: 'Emas Pecahan Retail (0.5g - 10g)',
              capacity: 12,
              rows: 3,
              cols: 4,
            },
          });
        }
      }

      // Audit log
      await tx.auditTrail.create({
        data: {
          action: 'MODULAR_SLOT_CONVERT',
          actor: req.user.username,
          locationCode: 'HO-CENTRAL',
          details: `Supervisor mengubah konfigurasi modular slot ${slotNumber} pada ${cabinet.code} menjadi ${targetModularType}`,
          ipAddress: req.ip,
        },
      });
    });

    return sendSuccess(
      res,
      { cabinetCode, slotNumber, modularType: targetModularType },
      `Slot ${slotNumber} pada ${cabinetCode} berhasil diubah ke ${targetModularType}`
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Get Drawer Details with QR Code
 */
const getDrawerDetails = async (req, res, next) => {
  try {
    const { drawerCode } = req.params;

    const drawer = await prisma.drawer.findUnique({
      where: { code: drawerCode },
      include: {
        slot: {
          include: { cabinet: true },
        },
        items: {
          where: { currentStatus: { in: ['IN_HO', 'ALLOCATED_PO'] } },
          orderBy: { slotPosition: 'asc' },
        },
      },
    });

    if (!drawer) {
      return sendError(res, `Laci ${drawerCode} tidak ditemukan`, 404);
    }

    const qrDataUrl = drawer.qrCode ? await generateQrDataUrl(drawer.qrCode) : null;

    return sendSuccess(res, { ...drawer, qrDataUrl }, `Detail Laci ${drawer.code}`);
  } catch (err) {
    next(err);
  }
};

/**
 * Update Drawer Capacity and Grid Dimensions (Supervisor only)
 */
const updateDrawerCapacity = async (req, res, next) => {
  try {
    const { drawerCode } = req.params;
    const { capacity, rows, cols, category } = req.body;

    const drawer = await prisma.drawer.findUnique({
      where: { code: drawerCode },
      include: {
        _count: {
          select: {
            items: {
              where: { currentStatus: { in: ['IN_HO', 'ALLOCATED_PO'] } },
            },
          },
        },
      },
    });

    if (!drawer) {
      return sendError(res, `Laci ${drawerCode} tidak ditemukan`, 404);
    }

    const currentCount = drawer._count.items;
    const newCapacity = capacity !== undefined ? parseInt(capacity, 10) : drawer.capacity;

    if (newCapacity < currentCount) {
      return sendError(
        res,
        `Kapasitas baru (${newCapacity}) tidak boleh lebih kecil dari jumlah keping emas yang ada saat ini (${currentCount})`,
        400
      );
    }

    const updateData = {};
    if (capacity !== undefined) updateData.capacity = parseInt(capacity, 10);
    if (rows !== undefined) updateData.rows = parseInt(rows, 10);
    if (cols !== undefined) updateData.cols = parseInt(cols, 10);
    if (category !== undefined) updateData.category = category;

    const updatedDrawer = await prisma.drawer.update({
      where: { code: drawerCode },
      data: updateData,
    });

    await prisma.auditTrail.create({
      data: {
        action: 'UPDATE_DRAWER_CAPACITY',
        actor: req.user.username,
        locationCode: 'HO-CENTRAL',
        details: `Supervisor mengubah konfigurasi laci ${drawerCode}: kapasitas=${updatedDrawer.capacity}, grid=${updatedDrawer.rows}x${updatedDrawer.cols}`,
        ipAddress: req.ip,
      },
    });

    return sendSuccess(res, 'Kapasitas laci berhasil diperbarui', { drawer: updatedDrawer });
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new Cabinet with 8 modular slots
 */
const createCabinet = async (req, res, next) => {
  try {
    const { code, name, description, slotModularTypes } = req.body;

    const hoLocation = await prisma.location.findFirst({
      where: { type: 'HEAD_OFFICE' },
    });

    if (!hoLocation) {
      return sendError(res, 'Lokasi Head Office tidak ditemukan', 404);
    }

    let cabCode = code ? code.trim().toUpperCase() : '';
    if (!cabCode) {
      const allCabs = await prisma.cabinet.findMany({
        where: { locationId: hoLocation.id },
        select: { code: true },
      });
      let maxNum = 0;
      allCabs.forEach((c) => {
        const match = c.code.match(/HO-CAB-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });
      const nextNum = String(maxNum + 1).padStart(2, '0');
      cabCode = `HO-CAB-${nextNum}`;
    }

    // Check uniqueness
    const existing = await prisma.cabinet.findUnique({
      where: { code: cabCode },
    });
    if (existing) {
      return sendError(res, `Lemari dengan kode ${cabCode} sudah ada`, 400);
    }

    const cabName = name && name.trim() ? name.trim() : `Lemari Besi Vault ${cabCode.replace('HO-CAB-', '')}`;
    const qrCode = buildCabinetQrPayload(cabCode);

    // Create Cabinet with 8 slots in a transaction
    const newCabinet = await prisma.$transaction(async (tx) => {
      const cab = await tx.cabinet.create({
        data: {
          code: cabCode,
          name: cabName,
          description: description || 'Lemari Besi Vault Modular HO',
          locationId: hoLocation.id,
          qrCode,
          totalSlots: 8,
        },
      });

      // Exactly 8 modular slots
      for (let s = 1; s <= 8; s++) {
        const modularType =
          Array.isArray(slotModularTypes) && slotModularTypes[s - 1]
            ? slotModularTypes[s - 1]
            : s <= 4
            ? 'BIG_DRAWER'
            : 'SMALL_CLUSTER';

        const slot = await tx.cabinetSlot.create({
          data: {
            cabinetId: cab.id,
            slotNumber: s,
            modularType,
          },
        });

        if (modularType === 'BIG_DRAWER') {
          await tx.drawer.create({
            data: {
              code: `${cabCode}-SL0${s}-DRW-BIG`,
              name: `Laci Besar S0${s} (${cabCode})`,
              slotId: slot.id,
              qrCode: `QR-${cabCode}-SL0${s}-BIG`,
              category: 'Emas Batangan Besar (>= 25g)',
              capacity: 24,
              rows: 4,
              cols: 6,
            },
          });
        } else {
          for (let k = 1; k <= 8; k++) {
            await tx.drawer.create({
              data: {
                code: `${cabCode}-SL0${s}-DRW-S0${k}`,
                name: `Laci Kecil S0${s} Cluster ${k} (${cabCode})`,
                slotId: slot.id,
                qrCode: `QR-${cabCode}-SL0${s}-S0${k}`,
                category: 'Emas Pecahan Retail (0.5g - 10g)',
                capacity: 12,
                rows: 3,
                cols: 4,
              },
            });
          }
        }
      }

      await tx.auditTrail.create({
        data: {
          action: 'CABINET_CREATE',
          actor: req.user?.username || 'SYSTEM',
          locationCode: 'HO-CENTRAL',
          details: `User membuat lemari besi baru ${cabCode} (${cabName}) dengan 8 slot modular`,
          ipAddress: req.ip,
        },
      });

      return cab;
    });

    const qrDataUrl = await generateQrDataUrl(newCabinet.qrCode);

    return sendSuccess(
      res,
      { ...newCabinet, qrDataUrl },
      `Lemari ${cabCode} berhasil dibuat dengan 8 slot modular`,
      201
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Update Cabinet details (name, description)
 */
const updateCabinet = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const cabinet = await prisma.cabinet.findFirst({
      where: {
        OR: [{ id }, { code: id.toUpperCase() }],
      },
    });

    if (!cabinet) {
      return sendError(res, `Lemari tidak ditemukan`, 404);
    }

    const updated = await prisma.cabinet.update({
      where: { id: cabinet.id },
      data: {
        name: name !== undefined ? name.trim() : cabinet.name,
        description: description !== undefined ? description.trim() : cabinet.description,
      },
    });

    await prisma.auditTrail.create({
      data: {
        action: 'CABINET_UPDATE',
        actor: req.user?.username || 'SYSTEM',
        locationCode: 'HO-CENTRAL',
        details: `User memperbarui data lemari ${cabinet.code}`,
        ipAddress: req.ip,
      },
    });

    return sendSuccess(res, updated, `Lemari ${cabinet.code} berhasil diperbarui`);
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a Cabinet and its slots/drawers if empty
 */
const deleteCabinet = async (req, res, next) => {
  try {
    const { id } = req.params;

    const cabinet = await prisma.cabinet.findFirst({
      where: {
        OR: [{ id }, { code: id.toUpperCase() }],
      },
      include: {
        slots: {
          include: {
            drawers: {
              include: {
                items: {
                  where: {
                    currentStatus: { in: ['IN_HO', 'ALLOCATED_PO'] },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cabinet) {
      return sendError(res, `Lemari tidak ditemukan`, 404);
    }

    // Check if cabinet has active items
    let totalItems = 0;
    cabinet.slots.forEach((slot) => {
      slot.drawers.forEach((drw) => {
        totalItems += drw.items.length;
      });
    });

    if (totalItems > 0) {
      return sendError(
        res,
        `Lemari ${cabinet.code} tidak dapat dihapus karena masih memuat ${totalItems} keping emas aktif. Kosongkan atau pindahkan keping emas terlebih dahulu.`,
        400
      );
    }

    // Cascade delete: delete drawers -> slots -> cabinet
    await prisma.$transaction(async (tx) => {
      for (const slot of cabinet.slots) {
        await tx.drawer.deleteMany({ where: { slotId: slot.id } });
      }
      await tx.cabinetSlot.deleteMany({ where: { cabinetId: cabinet.id } });
      await tx.cabinet.delete({ where: { id: cabinet.id } });

      await tx.auditTrail.create({
        data: {
          action: 'CABINET_DELETE',
          actor: req.user?.username || 'SYSTEM',
          locationCode: 'HO-CENTRAL',
          details: `User menghapus lemari besi ${cabinet.code} (${cabinet.name})`,
          ipAddress: req.ip,
        },
      });
    });

    return sendSuccess(res, null, `Lemari ${cabinet.code} berhasil dihapus`);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllCabinets,
  getCabinetByCode,
  switchSlotModularType,
  getDrawerDetails,
  updateDrawerCapacity,
  createCabinet,
  updateCabinet,
  deleteCabinet,
};

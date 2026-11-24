const prisma = require('../config/prisma');
const { sendSuccess, sendError } = require('../utils/response');
const { generateQrDataUrl } = require('../utils/qrcode');

/**
 * Get Outlet Inventory with comprehensive stats and filters
 */
const getOutletInventory = async (req, res, next) => {
  try {
    const user = req.user;
    const {
      outletLocationId,
      search,
      brand,
      weight,
      cabinetCode,
      drawerId,
      rfidStatus,
      page = 1,
      limit = 100,
    } = req.query;

    // 1. Determine target outlet location
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

    const location = await prisma.location.findUnique({
      where: { id: targetLocId },
    });

    if (!location) {
      return sendError(res, 'Lokasi outlet tidak ditemukan', 404);
    }

    // 2. Build Where Clause
    const where = {
      currentStatus: 'IN_OUTLET',
      drawer: {
        slot: {
          cabinet: {
            locationId: targetLocId,
          },
        },
      },
    };

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { id: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
        { rfidTag: { contains: q, mode: 'insensitive' } },
        { qrCode: { contains: q, mode: 'insensitive' } },
        { slotPosition: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (brand && brand !== 'ALL') {
      where.brand = { equals: brand, mode: 'insensitive' };
    }

    if (weight && weight !== 'ALL') {
      where.weight = parseFloat(weight);
    }

    if (cabinetCode && cabinetCode !== 'ALL') {
      where.drawer.slot.cabinet.code = cabinetCode.toUpperCase();
    }

    if (drawerId && drawerId !== 'ALL') {
      where.drawerId = drawerId;
    }

    if (rfidStatus === 'TAGGED') {
      where.rfidTag = { not: null };
    } else if (rfidStatus === 'UNTAGGED') {
      where.rfidTag = null;
    }

    // 3. Fetch Items
    const items = await prisma.item.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        drawer: {
          include: {
            slot: {
              include: {
                cabinet: true,
              },
            },
          },
        },
      },
    });

    // 4. Fetch All Items in this Outlet for Global Stats (independent of filters)
    const allOutletItems = await prisma.item.findMany({
      where: {
        currentStatus: 'IN_OUTLET',
        drawer: {
          slot: {
            cabinet: {
              locationId: targetLocId,
            },
          },
        },
      },
      include: {
        drawer: {
          include: {
            slot: {
              include: {
                cabinet: true,
              },
            },
          },
        },
      },
    });

    // Compute Stats
    const totalItems = allOutletItems.length;
    const totalWeight = Number(allOutletItems.reduce((acc, it) => acc + (it.weight || 0), 0).toFixed(2));
    const GOLD_PRICE_PER_GRAM = 1450000; // Standar taksiran Rp 1.450.000 / gram
    const totalEstimatedValue = totalWeight * GOLD_PRICE_PER_GRAM;

    const rfidTaggedCount = allOutletItems.filter((it) => !!it.rfidTag).length;
    const rfidUntaggedCount = totalItems - rfidTaggedCount;

    // Breakdown by Brand
    const byBrand = {};
    allOutletItems.forEach((it) => {
      const b = (it.brand || 'LAINNYA').toUpperCase();
      byBrand[b] = (byBrand[b] || 0) + 1;
    });

    // Breakdown by Weight Category
    const byWeight = {};
    allOutletItems.forEach((it) => {
      const w = `${it.weight}g`;
      byWeight[w] = (byWeight[w] || 0) + 1;
    });

    // Breakdown by Cabinet
    const byCabinet = {};
    allOutletItems.forEach((it) => {
      const c = it.drawer?.slot?.cabinet?.code || 'UNASSIGNED';
      byCabinet[c] = (byCabinet[c] || 0) + 1;
    });

    // Cabinets list for filter dropdown
    const cabinetsList = await prisma.cabinet.findMany({
      where: { locationId: targetLocId },
      select: {
        id: true,
        code: true,
        name: true,
        slots: {
          select: {
            drawers: {
              select: {
                id: true,
                code: true,
                name: true,
                rfidAntenna: true,
              },
            },
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    // Format output items with QR code URLs
    const formattedItems = await Promise.all(
      items.map(async (it) => {
        const qrUrl = await generateQrDataUrl(it.qrCode || `PGD-GOLD:${it.id}`);
        return {
          id: it.id,
          serialNumber: it.id,
          brand: it.brand,
          weight: it.weight,
          purity: it.purity || '999.9',
          rfidTag: it.rfidTag,
          isRfidTagged: !!it.rfidTag,
          qrCode: it.qrCode,
          qrDataUrl: qrUrl,
          slotPosition: it.slotPosition || 'R1-01',
          currentStatus: it.currentStatus,
          notes: it.notes,
          createdAt: it.createdAt,
          updatedAt: it.updatedAt,
          cabinet: it.drawer?.slot?.cabinet
            ? {
                id: it.drawer.slot.cabinet.id,
                code: it.drawer.slot.cabinet.code,
                name: it.drawer.slot.cabinet.name,
              }
            : null,
          drawer: it.drawer
            ? {
                id: it.drawer.id,
                code: it.drawer.code,
                name: it.drawer.name,
                category: it.drawer.category,
                rfidAntenna: it.drawer.rfidAntenna,
                rows: it.drawer.rows,
                cols: it.drawer.cols,
              }
            : null,
        };
      })
    );

    return sendSuccess(
      res,
      {
        location: {
          id: location.id,
          code: location.code,
          name: location.name,
        },
        stats: {
          totalItems,
          totalWeight,
          totalEstimatedValue,
          rfidTaggedCount,
          rfidUntaggedCount,
          byBrand,
          byWeight,
          byCabinet,
        },
        cabinets: cabinetsList.map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          drawers: c.slots.flatMap((s) => s.drawers),
        })),
        items: formattedItems,
        filteredCount: formattedItems.length,
      },
      `Inventori Emas Outlet ${location.name} berhasil dimuat`
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Get Single Item Detail with Audit / History
 */
const getOutletItemDetail = async (req, res, next) => {
  try {
    const { id } = req.params;

    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        drawer: {
          include: {
            slot: {
              include: {
                cabinet: {
                  include: {
                    location: true,
                  },
                },
              },
            },
          },
        },
        histories: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!item) {
      return sendError(res, `Keping emas dengan ID ${id} tidak ditemukan`, 404);
    }

    const qrDataUrl = await generateQrDataUrl(item.qrCode || `PGD-GOLD:${item.id}`);

    return sendSuccess(
      res,
      {
        item: {
          ...item,
          qrDataUrl,
          cabinet: item.drawer?.slot?.cabinet || null,
          location: item.drawer?.slot?.cabinet?.location || null,
        },
      },
      `Detail keping emas ${id} berhasil dimuat`
    );
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getOutletInventory,
  getOutletItemDetail,
};

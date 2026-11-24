const prisma = require('../config/prisma');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Get comprehensive Outlet Dashboard data including RFID Vault Matrix
 */
const getOutletDashboard = async (req, res, next) => {
  try {
    const user = req.user;
    const { outletLocationId } = req.query;

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

    // 1. Ambil Brankas & Baki/Laci Cabang berserta items
    const cabinets = await prisma.cabinet.findMany({
      where: { locationId: targetLocId },
      include: {
        slots: {
          orderBy: { slotNumber: 'asc' },
          include: {
            drawers: {
              include: {
                items: {
                  where: { currentStatus: 'IN_OUTLET' },
                  orderBy: { updatedAt: 'desc' },
                },
              },
            },
          },
        },
      },
    });

    // Format Baki/Laci RFID
    const allDrawers = cabinets.flatMap((c) =>
      c.slots.flatMap((s) =>
        s.drawers.map((d) => {
          const items = d.items || [];
          const taggedCount = items.filter((it) => !!it.rfidTag).length;
          const totalWeight = items.reduce((acc, it) => acc + (it.weight || 0), 0);

          return {
            id: d.id,
            code: d.code,
            name: d.name,
            category: d.category,
            capacity: d.capacity,
            rfidAntenna: d.rfidAntenna || 'ANT-01',
            antennaStatus: 'ONLINE',
            signalQuality: 'EXCELLENT', // 95-100%
            frequencyMhz: 922.5,
            itemCount: items.length,
            taggedCount,
            totalWeight: Number(totalWeight.toFixed(2)),
            availableSlots: Math.max(0, d.capacity - items.length),
            cabinetCode: c.code,
            cabinetName: c.name,
            slotNumber: s.slotNumber,
            items: items.map((it) => ({
              id: it.id,
              brand: it.brand,
              weight: it.weight,
              purity: it.purity,
              qrCode: it.qrCode,
              rfidTag: it.rfidTag,
              currentStatus: it.currentStatus,
              slotPosition: it.slotPosition,
              updatedAt: it.updatedAt,
            })),
          };
        })
      )
    );

    // 2. Hitung Agregasi Stok
    const allItems = allDrawers.flatMap((d) => d.items);
    const totalGoldPieces = allItems.length;
    const totalGoldWeight = Number(allItems.reduce((sum, it) => sum + (it.weight || 0), 0).toFixed(2));
    const itemsWithRfid = allItems.filter((it) => !!it.rfidTag).length;
    const rfidCoveragePercent = totalGoldPieces > 0 ? Math.round((itemsWithRfid / totalGoldPieces) * 100) : 100;

    // 3. Ambil Kiriman PO dari HO yang sedang aktif (Incoming Shipments)
    const incomingPos = await prisma.purchaseOrder.findMany({
      where: {
        destLocId: targetLocId,
        status: { in: ['DISPATCHED', 'PARTIAL_HOLD', 'APPROVED_HO', 'PICKING'] },
      },
      include: {
        requestLines: true,
        items: { include: { item: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const incomingPieces = incomingPos.reduce(
      (sum, po) => sum + po.requestLines.reduce((s, l) => s + (l.qtyRequested || 0), 0),
      0
    );

    // 4. Tebusan Nasabah
    const tebusanItems = await prisma.itemHistory.count({
      where: {
        locationCode: location.code,
        event: 'DITEBUS_NASABAH',
      },
    });

    // 5. Riwayat Aktivitas Fisik Terakhir di Outlet
    const recentHistories = await prisma.itemHistory.findMany({
      where: {
        OR: [
          { locationCode: location.code },
          { details: { contains: location.code, mode: 'insensitive' } },
          { details: { contains: location.name, mode: 'insensitive' } },
        ],
      },
      orderBy: { timestamp: 'desc' },
      take: 8,
      include: {
        item: {
          select: { id: true, brand: true, weight: true, rfidTag: true },
        },
      },
    });

    return sendSuccess(
      res,
      {
        location: {
          id: location.id,
          code: location.code,
          name: location.name,
          type: location.type,
          address: location.address,
        },
        stats: {
          totalGoldPieces,
          totalGoldWeight,
          itemsWithRfid,
          rfidCoveragePercent,
          incomingPosCount: incomingPos.length,
          incomingPieces,
          tebusanToday: tebusanItems,
          totalAntennas: allDrawers.length,
          activeAntennas: allDrawers.length,
          antennaStatus: 'ONLINE_ALL',
        },
        vaultDrawers: allDrawers,
        incomingPos: incomingPos.map((po) => ({
          id: po.id,
          status: po.status,
          trackingNumber: po.trackingNumber,
          createdAt: po.createdAt,
          totalPieces: po.requestLines.reduce((s, l) => s + (l.qtyRequested || 0), 0),
          totalWeight: po.requestLines.reduce((s, l) => s + (l.qtyRequested * l.weightGrams), 0),
          canReceiveRfid: ['DISPATCHED', 'PARTIAL_HOLD'].includes(po.status),
        })),
        recentHistories,
      },
      'Data Dashboard & Sensor RFID Brankas Cabang berhasil dimuat',
      200
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Simulate live RFID Reader Scan / Antenna Ping
 */
const simulateRfidScan = async (req, res, next) => {
  try {
    const { drawerId, drawerCode } = req.body;

    const drawer = await prisma.drawer.findFirst({
      where: {
        OR: [{ id: drawerId }, { code: drawerCode }],
      },
      include: {
        items: {
          where: { currentStatus: 'IN_OUTLET' },
        },
        slot: { include: { cabinet: true } },
      },
    });

    if (!drawer) {
      return sendError(res, 'Baki / Laci brankas tidak ditemukan', 404);
    }

    const items = drawer.items || [];
    const detectedTags = items.map((it) => ({
      itemId: it.id,
      rfidTag: it.rfidTag || 'UNTAGGED',
      brand: it.brand,
      weight: it.weight,
      signalRssi: `-${Math.floor(45 + Math.random() * 15)} dBm`, // Realistis RFID UHF RSSI
      readCount: Math.floor(20 + Math.random() * 30),
      status: it.rfidTag ? 'DETECTED' : 'NEEDS_TAG',
    }));

    return sendSuccess(
      res,
      {
        drawerCode: drawer.code,
        drawerName: drawer.name,
        antenna: drawer.rfidAntenna || 'ANT-01',
        cabinet: drawer.slot?.cabinet?.name,
        frequency: '922.5 MHz (EPC UHF Gen2)',
        pingLatencyMs: Math.floor(12 + Math.random() * 10),
        totalDetected: items.length,
        detectedTags,
        scanTimestamp: new Date().toISOString(),
      },
      `Antena ${drawer.rfidAntenna || 'ANT-01'} berhasil memindai ${items.length} keping emas di ${drawer.name}`,
      200
    );
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getOutletDashboard,
  simulateRfidScan,
};

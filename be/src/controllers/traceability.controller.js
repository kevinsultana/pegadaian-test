const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendSuccess, sendError } = require('../utils/response');

/**
 * GET /api/traceability/items
 * Get list of items with their latest real-time vault locations & lifecycle summary.
 * Supports scope='HO' (all nationwide) and scope='OUTLET' (scoped to outlet location).
 */
const getTraceabilityItems = async (req, res, next) => {
  try {
    const user = req.user;
    const {
      scope = 'HO',
      outletLocationId,
      search,
      status,
      brand,
      limit = 100,
      page = 1,
    } = req.query;

    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const isHOUser = user.role.startsWith('HO_') || user.location?.type === 'HEAD_OFFICE';

    let targetOutletLocId = null;
    let targetOutletLocCode = null;

    if (scope === 'OUTLET' || (!isSuperAdmin && !isHOUser)) {
      targetOutletLocId = outletLocationId || user.locationId;
      if (targetOutletLocId) {
        const loc = await prisma.location.findUnique({ where: { id: targetOutletLocId } });
        if (loc) targetOutletLocCode = loc.code;
      }
    } else if (isSuperAdmin && outletLocationId) {
      targetOutletLocId = outletLocationId;
      const loc = await prisma.location.findUnique({ where: { id: targetOutletLocId } });
      if (loc) targetOutletLocCode = loc.code;
    }

    const where = {};

    // Scope filter for Outlet
    if (targetOutletLocId) {
      where.OR = [
        {
          drawer: {
            slot: {
              cabinet: {
                locationId: targetOutletLocId,
              },
            },
          },
        },
        {
          histories: {
            some: {
              locationCode: targetOutletLocCode || undefined,
            },
          },
        },
        {
          poItems: {
            some: {
              po: {
                destLocId: targetOutletLocId,
              },
            },
          },
        },
      ];
    }

    // Status filter
    if (status && status !== 'ALL') {
      where.currentStatus = status;
    }

    // Brand filter
    if (brand && brand !== 'ALL') {
      where.brand = { equals: brand, mode: 'insensitive' };
    }

    // Search query
    if (search && search.trim()) {
      const q = search.trim();
      const searchConditions = [
        { id: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
        { qrCode: { contains: q, mode: 'insensitive' } },
        { rfidTag: { contains: q, mode: 'insensitive' } },
        { slotPosition: { contains: q, mode: 'insensitive' } },
      ];

      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          { OR: searchConditions },
        ];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    const take = Math.min(parseInt(limit, 10) || 50, 200);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

    const [items, total] = await Promise.all([
      prisma.item.findMany({
        where,
        take,
        skip,
        orderBy: { updatedAt: 'desc' },
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
          inboundOrder: {
            select: {
              id: true,
              supplierName: true,
              createdAt: true,
              requestedBy: true,
            },
          },
          histories: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              histories: true,
              poItems: true,
            },
          },
        },
      }),
      prisma.item.count({ where }),
    ]);

    const formatted = items.map((it) => {
      const cabinet = it.drawer?.slot?.cabinet;
      const location = cabinet?.location;
      const lastHistory = it.histories[0] || null;

      let locationLabel = '-';
      if (it.currentStatus === 'IN_HO') {
        locationLabel = `Vault HO • ${cabinet?.name || cabinet?.code || 'Lemari HO'} (${it.drawer?.name || 'Laci'})`;
      } else if (it.currentStatus === 'IN_TRANSIT') {
        locationLabel = 'Dalam Pengiriman (In Transit) ke Cabang';
      } else if (it.currentStatus === 'IN_OUTLET') {
        locationLabel = `${location?.name || 'Cabang'} • ${cabinet?.name || cabinet?.code || 'Brankas'} › ${it.drawer?.name || 'Laci'}`;
      } else if (it.currentStatus === 'SOLD') {
        locationLabel = `Terjual ke Nasabah (${it.customerName || 'Customer'})`;
      } else if (it.currentStatus === 'ALLOCATED_PO') {
        locationLabel = 'Dialokasikan untuk PO Distribusi';
      }

      return {
        id: it.id,
        serialNumber: it.id,
        brand: it.brand,
        weight: it.weight,
        purity: it.purity,
        currentStatus: it.currentStatus,
        qrCode: it.qrCode,
        rfidTag: it.rfidTag,
        slotPosition: it.slotPosition || '-',
        currentLocation: {
          locationId: location?.id || null,
          locationName: location?.name || (it.currentStatus === 'IN_HO' ? 'Head Office Vault' : '-'),
          locationCode: location?.code || (it.currentStatus === 'IN_HO' ? 'HO-CENTRAL' : '-'),
          cabinetCode: cabinet?.code || '-',
          cabinetName: cabinet?.name || '-',
          drawerCode: it.drawer?.code || '-',
          drawerName: it.drawer?.name || '-',
          rfidAntenna: it.drawer?.rfidAntenna || '-',
          slotPosition: it.slotPosition || '-',
          fullDisplay: locationLabel,
        },
        inboundPO: it.inboundOrder?.id || '-',
        supplier: it.inboundOrder?.supplierName || '-',
        totalEvents: it._count.histories,
        lastActivity: lastHistory
          ? {
              event: lastHistory.event,
              actor: lastHistory.actor,
              timestamp: lastHistory.timestamp,
              details: lastHistory.details,
            }
          : null,
        createdAt: it.createdAt,
        updatedAt: it.updatedAt,
      };
    });

    return sendSuccess(res, {
      items: formatted,
      pagination: {
        total,
        page: parseInt(page, 10) || 1,
        limit: take,
        totalPages: Math.ceil(total / take) || 1,
      },
    }, 'Daftar lacak riwayat keping emas berhasil dimuat');
  } catch (err) {
    console.error('getTraceabilityItems Error:', err);
    return next(err);
  }
};

/**
 * GET /api/traceability/items/:id
 * Get full end-to-end lifecycle history and timeline for a specific gold bar.
 */
const getItemLifecycleDetail = async (req, res, next) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const item = await prisma.item.findFirst({
      where: {
        OR: [
          { id: id },
          { id: { equals: id, mode: 'insensitive' } },
          { rfidTag: id },
          { qrCode: id },
        ],
      },
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
        inboundOrder: {
          include: {
            lines: true,
          },
        },
        poItems: {
          include: {
            po: {
              include: {
                sourceLocation: true,
                destLocation: true,
                requestLines: true,
              },
            },
          },
        },
        histories: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!item) {
      return sendError(res, `Keping emas dengan nomor seri atau tag '${id}' tidak ditemukan`, 404);
    }

    // Permission check for outlet scope
    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const isHOUser = user.role.startsWith('HO_') || user.location?.type === 'HEAD_OFFICE';
    if (!isSuperAdmin && !isHOUser && user.locationId) {
      const loc = await prisma.location.findUnique({ where: { id: user.locationId } });
      const outletCode = loc?.code;

      const currentLocId = item.drawer?.slot?.cabinet?.locationId;
      const hasHistoryInOutlet = item.histories.some((h) => h.locationCode === outletCode);
      const isDestOfPo = item.poItems.some((pi) => pi.po?.destLocId === user.locationId);

      if (currentLocId !== user.locationId && !hasHistoryInOutlet && !isDestOfPo) {
        return sendError(
          res,
          'Akses ditolak: Keping emas ini tidak berada dan tidak memiliki riwayat di cabang Anda',
          403
        );
      }
    }

    const cabinet = item.drawer?.slot?.cabinet;
    const location = cabinet?.location;

    // Structured Milestones Generation
    const milestones = [];

    // Milestone 1: INBOUND HO
    const inboundPO = item.inboundOrder;
    const inboundHistory = item.histories.find((h) => h.event === 'HO_INBOUND');

    milestones.push({
      step: 1,
      code: 'HO_INBOUND',
      title: '1. Pengadaan & Inbound di Head Office (HO)',
      status: 'COMPLETED',
      badgeColor: 'emerald',
      timestamp: inboundHistory?.timestamp || inboundPO?.createdAt || item.createdAt,
      actor: inboundHistory?.actor || inboundPO?.requestedBy || 'Staff HO',
      details: {
        poNumber: inboundPO?.id || 'PO Pengadaan HO',
        supplier: inboundPO?.supplierName || 'PT ANTAM (Persero) Tbk',
        orderDate: inboundPO?.createdAt,
        orderedBy: inboundPO?.requestedBy || 'Staff Pengadaan HO',
        approvedBy: inboundPO?.approvedBy || 'Supervisor HO',
        putAwayBy: inboundHistory?.actor || 'Staff Vault HO',
        initialPlacement: inboundHistory?.details || 'Diletakkan di Lemari Vault HO',
      },
    });

    // Milestone 2: DISTRIBUSI KE CABANG (PO Picking & Dispatch)
    const activePOItem = item.poItems[0];
    const po = activePOItem?.po;
    const pickingHistory = item.histories.find((h) => h.event === 'HO_PICKING');
    const dispatchHistory = item.histories.find((h) => h.event === 'DISPATCHED');

    if (po || pickingHistory || dispatchHistory) {
      milestones.push({
        step: 2,
        code: 'DISTRIBUTION_DISPATCH',
        title: '2. Distribusi & Pengiriman ke Cabang',
        status: po?.status === 'DISPATCHED' || po?.status === 'RECEIVED' ? 'COMPLETED' : 'IN_PROGRESS',
        badgeColor: 'blue',
        timestamp: dispatchHistory?.timestamp || po?.updatedAt || po?.createdAt,
        actor: dispatchHistory?.actor || po?.dispatchedBy || po?.requestedBy || 'Logistik HO',
        details: {
          poNumber: po?.id || 'PO Distribusi Cabang',
          targetOutlet: po?.destLocation?.name || 'Outlet Cabang',
          targetOutletCode: po?.destLocation?.code || '-',
          requestedBy: po?.requestedBy || 'Staff Cabang',
          approvedBy: po?.hoApprovedBy || po?.approvedBy || 'Supervisor HO',
          pickedBy: pickingHistory?.actor || 'Petugas Picking HO',
          dispatchedBy: po?.dispatchedBy || dispatchHistory?.actor || 'Logistik HO',
          trackingNumber: po?.trackingNumber || 'PGD-EXP-HO-001',
          courier: po?.kurirName || 'Kurir Ekspedisi Internal Pegadaian',
          vehicle: po?.vehicleNumber || 'B 4129 PGD',
        },
      });
    }

    // Milestone 3: PENERIMAAN & PAIRING RFID DI CABANG
    const pairingHistory = item.histories.find((h) => h.event === 'OUTLET_RFID_PAIRING');
    if (pairingHistory || item.rfidTag || item.currentStatus === 'IN_OUTLET') {
      milestones.push({
        step: 3,
        code: 'OUTLET_RECEIVED_PAIRED',
        title: '3. Penerimaan & Pairing Tag RFID di Cabang',
        status: 'COMPLETED',
        badgeColor: 'purple',
        timestamp: pairingHistory?.timestamp || item.updatedAt,
        actor: pairingHistory?.actor || po?.receivedBy || 'Petugas Cabang',
        details: {
          outletName: location?.name || po?.destLocation?.name || 'Outlet Cabang',
          outletCode: location?.code || po?.destLocation?.code || 'CABANG',
          receivedBy: pairingHistory?.actor || po?.receivedBy || 'Petugas Cabang',
          rfidTag: item.rfidTag || 'EPC-PGD-2026-AUTOPAIRED',
          initialPlacement: pairingHistory?.details || `Disimpan di ${item.drawer?.name || 'Laci Cabang'} (${item.slotPosition || 'Row 1'})`,
        },
      });
    }

    // Milestone 4: MUTASI INTERNAL LACI / BARIS (ROW)
    const internalMutations = item.histories.filter((h) => h.event === 'INTERNAL_VAULT_MUTATION');
    internalMutations.forEach((im, idx) => {
      milestones.push({
        step: 4,
        code: `INTERNAL_MUTATION_${idx + 1}`,
        title: `4. Mutasi Antar Laci / Baris (Internal #${idx + 1})`,
        status: 'COMPLETED',
        badgeColor: 'violet',
        timestamp: im.timestamp,
        actor: im.actor,
        details: {
          description: im.details,
          locationCode: im.locationCode,
        },
      });
    });

    // Milestone 5: MUTASI EKSTERNAL ANTAR CABANG
    const externalMutations = item.histories.filter((h) => h.event === 'INTER_OUTLET_MUTATION_DISPATCHED');
    externalMutations.forEach((em, idx) => {
      milestones.push({
        step: 5,
        code: `EXTERNAL_MUTATION_${idx + 1}`,
        title: `5. Mutasi Antar Cabang (Eksternal #${idx + 1})`,
        status: 'COMPLETED',
        badgeColor: 'cyan',
        timestamp: em.timestamp,
        actor: em.actor,
        details: {
          description: em.details,
          locationCode: em.locationCode,
        },
      });
    });

    // Milestone 6: PENJUALAN KE NASABAH (CUSTOMER SALE)
    const saleHistory = item.histories.find((h) => h.event === 'OUTLET_CUSTOMER_SALE');
    if (saleHistory || item.currentStatus === 'SOLD') {
      milestones.push({
        step: 6,
        code: 'CUSTOMER_SALE',
        title: '6. Penjualan ke Nasabah (Outbound Akhir)',
        status: 'COMPLETED',
        badgeColor: 'amber',
        timestamp: saleHistory?.timestamp || item.updatedAt,
        actor: saleHistory?.actor || 'Kasir Outlet',
        details: {
          customerName: item.customerName || 'Nasabah Cabang',
          customerNik: item.customerNik || '-',
          customerPhone: item.customerPhone || '-',
          description: saleHistory?.details || 'Keping emas ditebus / dibeli nasabah',
        },
      });
    }

    // Sort milestones by logical step first, then timestamp ascending
    milestones.sort((a, b) => {
      if (a.step !== b.step) return a.step - b.step;
      return new Date(a.timestamp) - new Date(b.timestamp);
    });

    return sendSuccess(res, {
      item: {
        id: item.id,
        serialNumber: item.id,
        brand: item.brand,
        weight: item.weight,
        purity: item.purity,
        currentStatus: item.currentStatus,
        qrCode: item.qrCode,
        rfidTag: item.rfidTag,
        slotPosition: item.slotPosition || '-',
        customerName: item.customerName,
        customerNik: item.customerNik,
        customerPhone: item.customerPhone,
        currentLocation: {
          locationId: location?.id || null,
          locationName: location?.name || (item.currentStatus === 'IN_HO' ? 'Head Office Vault' : '-'),
          locationCode: location?.code || (item.currentStatus === 'IN_HO' ? 'HO-CENTRAL' : '-'),
          cabinetCode: cabinet?.code || '-',
          cabinetName: cabinet?.name || '-',
          drawerCode: item.drawer?.code || '-',
          drawerName: item.drawer?.name || '-',
          rfidAntenna: item.drawer?.rfidAntenna || '-',
          slotPosition: item.slotPosition || '-',
        },
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
      milestones,
      rawHistories: item.histories,
    }, 'Detail riwayat jejak keping emas berhasil dimuat');
  } catch (err) {
    console.error('getItemLifecycleDetail Error:', err);
    return next(err);
  }
};

module.exports = {
  getTraceabilityItems,
  getItemLifecycleDetail,
};

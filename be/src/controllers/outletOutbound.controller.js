const prisma = require('../config/prisma');
const { sendSuccess, sendError } = require('../utils/response');
const { generateQrDataUrl } = require('../utils/qrcode');

/**
 * Get available items in current outlet (for selection in outbound modals)
 */
const getAvailableOutletItems = async (req, res, next) => {
  try {
    const user = req.user;
    const { outletLocationId, search, brand, weight } = req.query;

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
        { slotPosition: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (brand && brand !== 'ALL') {
      where.brand = { equals: brand, mode: 'insensitive' };
    }

    if (weight && weight !== 'ALL') {
      where.weight = parseFloat(weight);
    }

    const items = await prisma.item.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        drawer: {
          include: {
            slot: {
              include: { cabinet: true },
            },
          },
        },
      },
    });

    const formatted = items.map((it) => ({
      id: it.id,
      serialNumber: it.id,
      brand: it.brand,
      weight: it.weight,
      purity: it.purity,
      rfidTag: it.rfidTag,
      slotPosition: it.slotPosition || 'R1-01',
      cabinetName: it.drawer?.slot?.cabinet?.name || '-',
      cabinetCode: it.drawer?.slot?.cabinet?.code || '-',
      drawerId: it.drawerId,
      drawerName: it.drawer?.name || '-',
      drawerCode: it.drawer?.code || '-',
      rfidAntenna: it.drawer?.rfidAntenna || '-',
    }));

    return sendSuccess(res, formatted, 'Daftar emas tersedia di cabang berhasil dimuat');
  } catch (err) {
    next(err);
  }
};

/**
 * Get Destination Outlets (for External Mutation)
 */
const getDestinationOutlets = async (req, res, next) => {
  try {
    const user = req.user;
    const { currentOutletId } = req.query;

    const myLocId = currentOutletId || user.locationId;
    const destinations = await prisma.location.findMany({
      where: {
        type: 'OUTLET_HUB',
        id: { not: myLocId },
      },
      orderBy: { name: 'asc' },
    });

    return sendSuccess(res, destinations, 'Daftar cabang tujuan mutasi berhasil dimuat');
  } catch (err) {
    next(err);
  }
};

/**
 * 1. CUSTOMER SALE (Pembelian Emas oleh Nasabah / Checkout Keluar dari Vault)
 */
const createCustomerSale = async (req, res, next) => {
  try {
    const user = req.user;
    const {
      outletLocationId,
      itemIds,
      customerName,
      customerNik,
      customerPhone,
      salePrice,
      invoiceNumber,
      notes,
    } = req.body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return sendError(res, 'Pilih minimal 1 keping emas untuk transaksi penjualan', 400);
    }
    if (!customerName || !customerName.trim()) {
      return sendError(res, 'Nama lengkap nasabah / pembeli wajib diisi', 400);
    }
    if (!customerNik || !customerNik.trim()) {
      return sendError(res, 'NIK nasabah wajib diisi', 400);
    }

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
    if (!location) return sendError(res, 'Lokasi outlet tidak ditemukan', 404);

    // Verify all items belong to this outlet and are IN_OUTLET
    const items = await prisma.item.findMany({
      where: {
        id: { in: itemIds },
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
            slot: { include: { cabinet: true } },
          },
        },
      },
    });

    if (items.length !== itemIds.length) {
      return sendError(
        res,
        'Beberapa keping emas yang dipilih tidak ditemukan atau tidak berstatus IN_OUTLET di cabang ini',
        400
      );
    }

    const cleanInvoice = invoiceNumber && invoiceNumber.trim()
      ? invoiceNumber.trim()
      : `INV-OUT-${Date.now().toString().slice(-8)}`;

    const totalWeight = items.reduce((acc, it) => acc + (it.weight || 0), 0);
    const parsedPrice = salePrice ? parseFloat(salePrice) : totalWeight * 1450000;

    // Execute transaction: update items, record item history, record audit trail
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update items
      for (const it of items) {
        await tx.item.update({
          where: { id: it.id },
          data: {
            currentStatus: 'SOLD',
            customerName: customerName.trim(),
            customerNik: customerNik.trim(),
            customerPhone: customerPhone ? customerPhone.trim() : null,
            drawerId: null,
            slotPosition: null,
            notes: `[TERJUAL KE NASABAH] Inv: ${cleanInvoice} - Rp ${parsedPrice.toLocaleString('id-ID')} - ${notes || 'Pembelian emas langsung di cabang'}`,
          },
        });

        // 2. Item History
        await tx.itemHistory.create({
          data: {
            itemId: it.id,
            event: 'OUTLET_CUSTOMER_SALE',
            actor: user.username,
            locationCode: location.code,
            details: `Emas ${it.id} (${it.brand} ${it.weight}g) resmi terjual kepada ${customerName} (NIK: ${customerNik}). Invoice: ${cleanInvoice}. Nilai: Rp ${parsedPrice.toLocaleString('id-ID')}. Emas dikeluarkan dari ${it.drawer?.name || 'Vault'}.`,
          },
        });
      }

      // 3. Audit Trail
      await tx.auditTrail.create({
        data: {
          action: 'OUTLET_CUSTOMER_SALE',
          actor: user.username,
          locationCode: location.code,
          details: `Penjualan ${items.length} keping emas (${totalWeight}g) ke nasabah ${customerName} (Inv: ${cleanInvoice}, Rp ${parsedPrice.toLocaleString('id-ID')})`,
          ipAddress: req.ip,
        },
      });

      return {
        invoiceNumber: cleanInvoice,
        itemCount: items.length,
        totalWeight,
        totalPrice: parsedPrice,
        customerName,
        customerNik,
      };
    });

    return sendSuccess(
      res,
      result,
      `Berhasil memproses penjualan ${items.length} keping emas ke nasabah ${customerName} (Invoice: ${cleanInvoice})! Emas telah dikeluarkan dari brankas cabang.`,
      201
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 2. EXTERNAL MUTATION (Mutasi Emas Antar Cabang / Inter-Outlet Transfer)
 */
const createExternalMutationPO = async (req, res, next) => {
  try {
    const user = req.user;
    const {
      sourceLocationId,
      destLocId,
      itemIds,
      notes,
      kurirName,
      vehicleNumber,
      trackingNumber,
    } = req.body;

    if (!destLocId) {
      return sendError(res, 'Cabang outlet tujuan mutasi wajib dipilih', 400);
    }
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return sendError(res, 'Pilih minimal 1 keping emas untuk dimutasikan', 400);
    }

    let mySourceId = user.locationId;
    if (user.role === 'SUPER_ADMIN') {
      if (sourceLocationId) {
        mySourceId = sourceLocationId;
      } else {
        const firstOutlet = await prisma.location.findFirst({
          where: { type: 'OUTLET_HUB' },
        });
        if (firstOutlet) mySourceId = firstOutlet.id;
      }
    }

    if (mySourceId === destLocId) {
      return sendError(res, 'Cabang asal dan cabang tujuan tidak boleh sama', 400);
    }

    const [sourceLoc, destLoc] = await Promise.all([
      prisma.location.findUnique({ where: { id: mySourceId } }),
      prisma.location.findUnique({ where: { id: destLocId } }),
    ]);

    if (!sourceLoc || !destLoc) {
      return sendError(res, 'Lokasi cabang asal atau tujuan tidak ditemukan', 404);
    }

    // Verify items
    const items = await prisma.item.findMany({
      where: {
        id: { in: itemIds },
        currentStatus: 'IN_OUTLET',
        drawer: {
          slot: {
            cabinet: {
              locationId: mySourceId,
            },
          },
        },
      },
      include: {
        drawer: {
          include: { slot: { include: { cabinet: true } } },
        },
      },
    });

    if (items.length !== itemIds.length) {
      return sendError(
        res,
        'Beberapa keping emas yang dipilih tidak tersedia di brankas cabang asal',
        400
      );
    }

    // Generate PO ID for Mutation
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const countToday = await prisma.purchaseOrder.count({
      where: {
        id: { startsWith: `MUT-${yearMonth}` },
      },
    });
    const poId = `MUT-${yearMonth}-${String(countToday + 1).padStart(4, '0')}`;
    const cleanTracking = trackingNumber && trackingNumber.trim()
      ? trackingNumber.trim()
      : `RESI-MUT-${Date.now().toString().slice(-8)}`;

    const totalWeight = items.reduce((acc, it) => acc + (it.weight || 0), 0);

    // Group items by brand & weight for request lines
    const lineGroups = {};
    items.forEach((it) => {
      const key = `${it.brand}_${it.weight}`;
      if (!lineGroups[key]) {
        lineGroups[key] = {
          goldBrand: it.brand,
          weightGrams: it.weight,
          qtyRequested: 0,
        };
      }
      lineGroups[key].qtyRequested += 1;
    });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create PurchaseOrder for inter-outlet transfer
      const po = await tx.purchaseOrder.create({
        data: {
          id: poId,
          sourceLocId: mySourceId,
          destLocId: destLocId,
          status: 'DISPATCHED', // langsung status dispatched karena dikeluarkan langsung oleh cabang pengirim
          notes: notes ? `[MUTASI ANTAR CABANG] ${notes}` : `[MUTASI ANTAR CABANG] Pengiriman emas dari ${sourceLoc.name} ke ${destLoc.name}`,
          trackingNumber: cleanTracking,
          requestedBy: user.username,
          outletApprovedBy: user.username,
          dispatchedBy: user.username,
          kurirName: kurirName ? kurirName.trim() : 'Kurir Logistik Internal',
          vehicleNumber: vehicleNumber ? vehicleNumber.trim() : 'B 1234 PGD',
          requestLines: {
            create: Object.values(lineGroups).map((g) => ({
              goldBrand: g.goldBrand,
              weightGrams: g.weightGrams,
              qtyRequested: g.qtyRequested,
              notes: `Mutasi cabang ${g.qtyRequested} keping`,
            })),
          },
          items: {
            create: items.map((it) => ({
              itemId: it.id,
              isPicked: true,
              pickedAt: new Date(),
            })),
          },
        },
      });

      // 2. Update items to IN_TRANSIT and clear drawer/slot
      for (const it of items) {
        await tx.item.update({
          where: { id: it.id },
          data: {
            currentStatus: 'IN_TRANSIT',
            drawerId: null,
            slotPosition: null,
            notes: `[MUTASI KE ${destLoc.code}] Dalam pengiriman ke ${destLoc.name} (Dokumen: ${poId}, Resi: ${cleanTracking})`,
          },
        });

        // 3. Item History
        await tx.itemHistory.create({
          data: {
            itemId: it.id,
            event: 'INTER_OUTLET_MUTATION_DISPATCHED',
            actor: user.username,
            locationCode: sourceLoc.code,
            details: `Mutasi keluar dari ${sourceLoc.name} menuju ${destLoc.name}. Dokumen: ${poId}. No Resi: ${cleanTracking}. Kurir: ${kurirName || 'Internal'} (${vehicleNumber || '-'}). Dikeluarkan dari ${it.drawer?.name || 'Vault'}.`,
          },
        });
      }

      // 4. Audit Trail
      await tx.auditTrail.create({
        data: {
          action: 'MUTASI_EKSTERNAL_DISPATCH',
          actor: user.username,
          locationCode: sourceLoc.code,
          details: `Membuat mutasi outbound ${items.length} keping emas (${totalWeight}g) dari ${sourceLoc.name} ke ${destLoc.name} (Dokumen: ${poId}, Resi: ${cleanTracking})`,
          ipAddress: req.ip,
        },
      });

      return po;
    });

    return sendSuccess(
      res,
      result,
      `Dokumen Mutasi Antar Cabang ${poId} berhasil dibuat dan di-dispatch ke ${destLoc.name}! ${items.length} keping emas sekarang berstatus IN_TRANSIT.`,
      201
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 3. INTERNAL MUTATION (Pemindahan Fisik Emas Antar Laci / Baki / Lemari di Cabang yang Sama)
 */
const createInternalMutation = async (req, res, next) => {
  try {
    const user = req.user;
    const {
      itemId,
      targetDrawerId,
      targetSlotPosition,
      reason,
    } = req.body;

    if (!itemId) return sendError(res, 'Pilih keping emas yang ingin dipindahkan', 400);
    if (!targetDrawerId) return sendError(res, 'Pilih laci / baki tujuan pemindahan', 400);

    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        drawer: {
          include: {
            slot: { include: { cabinet: { include: { location: true } } } },
          },
        },
      },
    });

    if (!item) return sendError(res, `Keping emas ${itemId} tidak ditemukan`, 404);
    if (item.currentStatus !== 'IN_OUTLET') {
      return sendError(
        res,
        `Keping emas ${itemId} berstatus ${item.currentStatus}. Hanya emas di brankas cabang (IN_OUTLET) yang dapat dipindahkan`,
        400
      );
    }

    const targetDrawer = await prisma.drawer.findUnique({
      where: { id: targetDrawerId },
      include: {
        slot: { include: { cabinet: { include: { location: true } } } },
        items: { where: { currentStatus: 'IN_OUTLET' } },
      },
    });

    if (!targetDrawer) return sendError(res, 'Laci tujuan tidak ditemukan', 404);

    // Verify same location
    const itemLocId = item.drawer?.slot?.cabinet?.locationId;
    const targetLocId = targetDrawer.slot?.cabinet?.locationId;

    if (itemLocId && targetLocId && itemLocId !== targetLocId) {
      return sendError(
        res,
        'Mutasi internal hanya untuk laci dalam cabang yang sama. Untuk beda cabang, gunakan menu Mutasi Eksternal',
        400
      );
    }

    // Check capacity of target drawer (if moving to another drawer)
    if (targetDrawer.id !== item.drawerId && targetDrawer.items.length >= targetDrawer.capacity) {
      return sendError(
        res,
        `Laci tujuan ${targetDrawer.name} sudah penuh (${targetDrawer.items.length}/${targetDrawer.capacity} keping)! Pilih laci lain.`,
        400
      );
    }

    const fromDrawerName = item.drawer?.name || 'Laci Asal';
    const fromCabinetCode = item.drawer?.slot?.cabinet?.code || '-';
    const fromSlotPos = item.slotPosition || 'R1-01';

    const cleanSlot = targetSlotPosition && targetSlotPosition.trim()
      ? targetSlotPosition.trim().toUpperCase()
      : `R1-${String(targetDrawer.items.length + 1).padStart(2, '0')}`;

    // Update item
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.item.update({
        where: { id: itemId },
        data: {
          drawerId: targetDrawer.id,
          slotPosition: cleanSlot,
          notes: `[RELOKASI LACI] Pindah dari ${fromCabinetCode} (${fromDrawerName} ${fromSlotPos}) ke ${targetDrawer.slot?.cabinet?.code} (${targetDrawer.name} ${cleanSlot}). ${reason || ''}`.trim(),
        },
      });

      // Item History
      await tx.itemHistory.create({
        data: {
          itemId,
          event: 'INTERNAL_VAULT_MUTATION',
          actor: user.username,
          locationCode: targetDrawer.slot?.cabinet?.location?.code || 'OUTLET',
          details: `Pemindahan fisik keping ${itemId} (${item.brand} ${item.weight}g) dari ${fromCabinetCode} > ${fromDrawerName} (${fromSlotPos}) ke ${targetDrawer.slot?.cabinet?.code} > ${targetDrawer.name} (${cleanSlot}). Alasan: ${reason || 'Penataan inventori berkala'}. Antena RFID aktif: ${targetDrawer.rfidAntenna || 'Default'}.`,
        },
      });

      // Audit Trail
      await tx.auditTrail.create({
        data: {
          action: 'MUTASI_INTERNAL_LACI',
          actor: user.username,
          locationCode: targetDrawer.slot?.cabinet?.location?.code || 'OUTLET',
          details: `Relokasi keping ${itemId} dari ${fromDrawerName} (${fromSlotPos}) ke ${targetDrawer.name} (${cleanSlot})`,
          ipAddress: req.ip,
        },
      });

      return updated;
    });

    return sendSuccess(
      res,
      result,
      `Keping emas ${itemId} berhasil dipindahkan ke ${targetDrawer.name} pada slot ${cleanSlot}!`,
      200
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Get comprehensive list of Outbound Transactions & Mutations for Outlet
 */
const getOutboundOrders = async (req, res, next) => {
  try {
    const user = req.user;
    const { outletLocationId, type = 'ALL', search } = req.query;

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
    if (!location) return sendError(res, 'Lokasi outlet tidak ditemukan', 404);

    // 1. Fetch Customer Sales (Items with SOLD status and customer info)
    const customerSalesItems = await prisma.item.findMany({
      where: {
        currentStatus: 'SOLD',
        histories: {
          some: {
            event: 'OUTLET_CUSTOMER_SALE',
            locationCode: location.code,
          },
        },
      },
      include: {
        histories: {
          where: { event: 'OUTLET_CUSTOMER_SALE' },
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const formattedSales = customerSalesItems.map((it) => {
      const h = it.histories?.[0];
      return {
        id: `SALE-${it.id}`,
        type: 'CUSTOMER_SALE',
        typeName: 'Penjualan ke Nasabah',
        item: {
          id: it.id,
          brand: it.brand,
          weight: it.weight,
          purity: it.purity,
          rfidTag: it.rfidTag,
        },
        customerName: it.customerName || 'Nasabah Cabang',
        customerNik: it.customerNik || '-',
        customerPhone: it.customerPhone || '-',
        timestamp: h?.timestamp || it.updatedAt,
        actor: h?.actor || 'Petugas Cabang',
        notes: it.notes || h?.details || '-',
        status: 'COMPLETED',
      };
    });

    // 2. Fetch External Mutations (PurchaseOrders where sourceLocId = targetLocId)
    const externalMutationPOs = await prisma.purchaseOrder.findMany({
      where: {
        sourceLocId: targetLocId,
        id: { startsWith: 'MUT-' },
      },
      include: {
        destLocation: true,
        sourceLocation: true,
        items: {
          include: { item: true },
        },
        requestLines: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedExternal = externalMutationPOs.map((po) => ({
      id: po.id,
      type: 'MUTATION_EXTERNAL',
      typeName: 'Mutasi Antar Cabang (Eksternal)',
      destLocationName: po.destLocation?.name,
      destLocationCode: po.destLocation?.code,
      status: po.status,
      trackingNumber: po.trackingNumber,
      kurirName: po.kurirName,
      vehicleNumber: po.vehicleNumber,
      requestedBy: po.requestedBy,
      dispatchedBy: po.dispatchedBy,
      receivedBy: po.receivedBy,
      notes: po.notes,
      timestamp: po.createdAt,
      items: po.items.map((pi) => ({
        id: pi.item?.id,
        brand: pi.item?.brand,
        weight: pi.item?.weight,
        purity: pi.item?.purity,
        rfidTag: pi.item?.rfidTag,
        currentStatus: pi.item?.currentStatus,
      })),
      totalItems: po.items.length,
      totalWeight: po.items.reduce((acc, pi) => acc + (pi.item?.weight || 0), 0),
    }));

    // 3. Fetch Internal Mutations (Item Histories with event INTERNAL_VAULT_MUTATION)
    const internalHistories = await prisma.itemHistory.findMany({
      where: {
        event: 'INTERNAL_VAULT_MUTATION',
        locationCode: location.code,
      },
      include: {
        item: {
          include: {
            drawer: {
              include: {
                slot: { include: { cabinet: true } },
              },
            },
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    const formattedInternal = internalHistories.map((h) => ({
      id: `INT-${h.id.slice(0, 8)}`,
      type: 'MUTATION_INTERNAL',
      typeName: 'Mutasi Antar Laci (Internal)',
      item: {
        id: h.item?.id,
        brand: h.item?.brand,
        weight: h.item?.weight,
        purity: h.item?.purity,
        currentSlot: h.item?.slotPosition,
        currentDrawer: h.item?.drawer?.name,
        currentCabinet: h.item?.drawer?.slot?.cabinet?.code,
      },
      details: h.details,
      actor: h.actor,
      timestamp: h.timestamp,
      status: 'COMPLETED',
    }));

    // Combine all
    let allTransactions = [
      ...formattedSales,
      ...formattedExternal,
      ...formattedInternal,
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (type !== 'ALL') {
      allTransactions = allTransactions.filter((t) => t.type === type);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      allTransactions = allTransactions.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          (t.customerName && t.customerName.toLowerCase().includes(q)) ||
          (t.trackingNumber && t.trackingNumber.toLowerCase().includes(q)) ||
          (t.item?.id && t.item.id.toLowerCase().includes(q)) ||
          (t.items && t.items.some((it) => it.id?.toLowerCase().includes(q)))
      );
    }

    return sendSuccess(
      res,
      {
        location: {
          id: location.id,
          code: location.code,
          name: location.name,
        },
        stats: {
          totalTransactions: allTransactions.length,
          customerSalesCount: formattedSales.length,
          customerSalesWeight: formattedSales.reduce((acc, s) => acc + (s.item?.weight || 0), 0),
          externalMutationsCount: formattedExternal.length,
          externalMutationsWeight: formattedExternal.reduce((acc, e) => acc + (e.totalWeight || 0), 0),
          internalMutationsCount: formattedInternal.length,
        },
        transactions: allTransactions,
      },
      `Daftar Outbound & Mutasi Cabang ${location.name} berhasil dimuat`
    );
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAvailableOutletItems,
  getDestinationOutlets,
  createCustomerSale,
  createExternalMutationPO,
  createInternalMutation,
  getOutboundOrders,
};

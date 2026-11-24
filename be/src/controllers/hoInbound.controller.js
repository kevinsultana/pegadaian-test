const prisma = require('../config/prisma');
const { sendSuccess, sendError } = require('../utils/response');
const { generateQrDataUrl, buildItemQrPayload } = require('../utils/qrcode');

/**
 * Generate sequential Inbound Order ID: INB-YYYYMM-XXXX
 */
async function generateInboundOrderId() {
  const date = new Date();
  const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `INB-${yearMonth}`;

  const lastOrder = await prisma.inboundOrder.findFirst({
    where: { id: { startsWith: prefix } },
    orderBy: { id: 'desc' },
  });

  let nextSequence = 1;
  if (lastOrder) {
    const parts = lastOrder.id.split('-');
    if (parts.length === 3) {
      const lastSeq = parseInt(parts[2], 10);
      if (!isNaN(lastSeq)) {
        nextSequence = lastSeq + 1;
      }
    }
  }

  return `${prefix}-${String(nextSequence).padStart(4, '0')}`;
}

/**
 * Get List of Inbound Orders
 */
const getInboundOrders = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { supplierName: { contains: search, mode: 'insensitive' } },
        { requestedBy: { contains: search, mode: 'insensitive' } },
        { approvedBy: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [orders, totalCount, statusCountsRaw] = await Promise.all([
      prisma.inboundOrder.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          lines: true,
          _count: { select: { items: true } },
        },
      }),
      prisma.inboundOrder.count({ where }),
      prisma.inboundOrder.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    // Format status counts
    const statusCounts = {
      ALL: 0,
      DRAFT: 0,
      PENDING_APPROVAL: 0,
      APPROVED: 0,
      RECEIVING: 0,
      COMPLETED: 0,
      REJECTED: 0,
    };
    statusCountsRaw.forEach((sc) => {
      statusCounts[sc.status] = sc._count.id;
      statusCounts.ALL += sc._count.id;
    });

    const formattedOrders = orders.map((o) => {
      const totalRequested = o.lines.reduce((acc, l) => acc + l.qtyRequested, 0);
      const totalReceived = o.lines.reduce((acc, l) => acc + l.qtyReceived, 0);
      const totalWeightGrams = o.lines.reduce((acc, l) => acc + (l.qtyRequested * l.weightGrams), 0);
      return {
        ...o,
        totalRequested,
        totalReceived,
        totalWeightGrams,
        itemCount: o._count.items,
      };
    });

    return sendSuccess(
      res,
      {
        orders: formattedOrders,
        pagination: {
          page: parseInt(page, 10),
          limit: take,
          totalCount,
          totalPages: Math.ceil(totalCount / take),
        },
        statusCounts,
      },
      'Daftar PO Inbound Pengadaan Emas HO berhasil dimuat',
      200
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Get Inbound Order Detail by ID
 */
const getInboundOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await prisma.inboundOrder.findUnique({
      where: { id },
      include: {
        lines: {
          orderBy: { createdAt: 'asc' },
        },
        items: {
          orderBy: { createdAt: 'desc' },
          include: {
            drawer: {
              include: {
                slot: {
                  include: { cabinet: true },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return sendError(res, `PO Inbound ${id} tidak ditemukan`, 404);
    }

    const totalRequested = order.lines.reduce((acc, l) => acc + l.qtyRequested, 0);
    const totalReceived = order.lines.reduce((acc, l) => acc + l.qtyReceived, 0);
    const totalWeightGrams = order.lines.reduce((acc, l) => acc + (l.qtyRequested * l.weightGrams), 0);

    return sendSuccess(
      res,
      {
        ...order,
        totalRequested,
        totalReceived,
        totalWeightGrams,
        isCompleted: totalRequested > 0 && totalReceived >= totalRequested,
      },
      `Detail PO Inbound ${id} berhasil dimuat`,
      200
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Create New Inbound Request (Staff HO)
 */
const createInboundOrder = async (req, res, next) => {
  try {
    const {
      supplierName,
      notes,
      expectedDate,
      lines = [],
      submitImmediately = true,
    } = req.body;

    if (!supplierName || !supplierName.trim()) {
      return sendError(res, 'Nama Supplier / Pemasok wajib diisi', 400);
    }

    if (!Array.isArray(lines) || lines.length === 0) {
      return sendError(res, 'Daftar item pengadaan emas wajib diisi minimal 1 baris', 400);
    }

    // Validate lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.goldBrand || !line.goldBrand.trim()) {
        return sendError(res, `Baris ${i + 1}: Brand / Merk emas wajib diisi`, 400);
      }
      if (!line.weightGrams || line.weightGrams <= 0) {
        return sendError(res, `Baris ${i + 1}: Berat emas (gram) harus lebih dari 0`, 400);
      }
      if (!line.qtyRequested || line.qtyRequested <= 0) {
        return sendError(res, `Baris ${i + 1}: Kuantitas keping harus lebih dari 0`, 400);
      }
    }

    const orderId = await generateInboundOrderId();
    const status = submitImmediately ? 'PENDING_APPROVAL' : 'DRAFT';
    const requestedBy = req.user?.username || 'admin';

    const newOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.inboundOrder.create({
        data: {
          id: orderId,
          supplierName: supplierName.trim(),
          notes: notes ? notes.trim() : null,
          status,
          requestedBy,
          expectedDate: expectedDate ? new Date(expectedDate) : null,
          lines: {
            create: lines.map((l) => ({
              goldBrand: l.goldBrand.trim().toUpperCase(),
              weightGrams: parseFloat(l.weightGrams),
              purity: l.purity ? l.purity.trim() : '999.9',
              qtyRequested: parseInt(l.qtyRequested, 10),
              notes: l.notes ? l.notes.trim() : null,
            })),
          },
        },
        include: { lines: true },
      });

      // Audit Trail
      await tx.auditTrail.create({
        data: {
          action: 'CREATE_INBOUND_ORDER',
          actor: requestedBy,
          locationCode: req.user?.location?.code || 'HO-CENTRAL',
          details: `Membuat PO Inbound ${orderId} dari ${supplierName} (${lines.length} tipe emas, status: ${status})`,
          ipAddress: req.ip,
        },
      });

      return order;
    });

    return sendSuccess(
      res,
      newOrder,
      submitImmediately
        ? `PO Inbound ${orderId} berhasil dibuat dan diajukan untuk persetujuan Supervisor HO`
        : `Draft PO Inbound ${orderId} berhasil disimpan`,
      201
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Submit Draft Inbound Order for SPV Approval
 */
const submitInboundOrder = async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await prisma.inboundOrder.findUnique({ where: { id } });
    if (!order) {
      return sendError(res, `PO Inbound ${id} tidak ditemukan`, 404);
    }
    if (order.status !== 'DRAFT') {
      return sendError(res, `PO Inbound dengan status ${order.status} tidak dapat diajukan`, 400);
    }

    const updated = await prisma.inboundOrder.update({
      where: { id },
      data: { status: 'PENDING_APPROVAL' },
      include: { lines: true },
    });

    await prisma.auditTrail.create({
      data: {
        action: 'SUBMIT_INBOUND_FOR_APPROVAL',
        actor: req.user?.username || 'admin',
        locationCode: req.user?.location?.code || 'HO-CENTRAL',
        details: `Mengajukan PO Inbound ${id} untuk persetujuan Supervisor HO`,
        ipAddress: req.ip,
      },
    });

    return sendSuccess(res, updated, `PO Inbound ${id} berhasil diajukan ke Supervisor HO`, 200);
  } catch (err) {
    next(err);
  }
};

/**
 * Approve Inbound Order (HO Supervisor)
 */
const approveInboundOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const actor = req.user?.username || 'supervisor';

    const order = await prisma.inboundOrder.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!order) {
      return sendError(res, `PO Inbound ${id} tidak ditemukan`, 404);
    }
    if (order.status !== 'PENDING_APPROVAL') {
      return sendError(res, `Hanya PO Inbound berstatus PENDING_APPROVAL yang dapat disetujui (Status saat ini: ${order.status})`, 400);
    }

    const updated = await prisma.inboundOrder.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: actor,
      },
      include: { lines: true },
    });

    await prisma.auditTrail.create({
      data: {
        action: 'APPROVE_INBOUND_ORDER',
        actor,
        locationCode: req.user?.location?.code || 'HO-CENTRAL',
        details: `Supervisor HO menyetujui PO Inbound ${id} dari ${order.supplierName}`,
        ipAddress: req.ip,
      },
    });

    return sendSuccess(res, updated, `PO Inbound ${id} telah disetujui oleh Supervisor HO. Siap menerima kedatangan barang fisik.`, 200);
  } catch (err) {
    next(err);
  }
};

/**
 * Reject Inbound Order (HO Supervisor)
 */
const rejectInboundOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const actor = req.user?.username || 'supervisor';

    const order = await prisma.inboundOrder.findUnique({ where: { id } });
    if (!order) {
      return sendError(res, `PO Inbound ${id} tidak ditemukan`, 404);
    }
    if (order.status !== 'PENDING_APPROVAL') {
      return sendError(res, `Hanya PO Inbound berstatus PENDING_APPROVAL yang dapat ditolak`, 400);
    }

    const updated = await prisma.inboundOrder.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedBy: actor,
        notes: reason ? `${order.notes ? order.notes + ' | ' : ''}DITOLAK: ${reason}` : order.notes,
      },
    });

    await prisma.auditTrail.create({
      data: {
        action: 'REJECT_INBOUND_ORDER',
        actor,
        locationCode: req.user?.location?.code || 'HO-CENTRAL',
        details: `Supervisor HO menolak PO Inbound ${id}. Alasan: ${reason || 'Tidak ada alasan'}`,
        ipAddress: req.ip,
      },
    });

    return sendSuccess(res, updated, `PO Inbound ${id} telah ditolak`, 200);
  } catch (err) {
    next(err);
  }
};

/**
 * Mark Inbound Goods as Received at HO (Starts Put-away)
 */
const receiveInboundGoods = async (req, res, next) => {
  try {
    const { id } = req.params;
    const actor = req.user?.username || 'admin';

    const order = await prisma.inboundOrder.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!order) {
      return sendError(res, `PO Inbound ${id} tidak ditemukan`, 404);
    }
    if (order.status !== 'APPROVED' && order.status !== 'RECEIVING') {
      return sendError(res, `Hanya PO Inbound yang sudah disetujui (APPROVED) yang dapat diterima fisiknya`, 400);
    }

    const updated = await prisma.inboundOrder.update({
      where: { id },
      data: {
        status: 'RECEIVING',
        receivedBy: order.receivedBy || actor,
      },
      include: { lines: true },
    });

    await prisma.auditTrail.create({
      data: {
        action: 'RECEIVE_INBOUND_GOODS',
        actor,
        locationCode: req.user?.location?.code || 'HO-CENTRAL',
        details: `Penerimaan fisik barang untuk PO Inbound ${id} dari ${order.supplierName}. Siap put-away ke vault.`,
        ipAddress: req.ip,
      },
    });

    return sendSuccess(res, updated, `Barang fisik PO Inbound ${id} berhasil dikonfirmasi tiba di HO. Silakan lakukan proses put-away per keping ke lemari vault.`, 200);
  } catch (err) {
    next(err);
  }
};

/**
 * Get Intelligent Drawer Recommendations based on Brand & Weight
 */
const getDrawerRecommendations = async (req, res, next) => {
  try {
    const { brand = '', weight } = req.query;
    const weightNum = parseFloat(weight) || 0;
    const searchBrand = brand.trim().toUpperCase();

    // Query all drawers in Head Office cabinets
    const drawers = await prisma.drawer.findMany({
      where: {
        slot: {
          cabinet: {
            location: { type: 'HEAD_OFFICE' },
          },
        },
      },
      include: {
        slot: {
          include: { cabinet: true },
        },
        items: {
          where: { currentStatus: { in: ['IN_HO', 'ALLOCATED_PO'] } },
          select: { id: true, brand: true, weight: true },
        },
      },
    });

    const recommendations = drawers.map((d) => {
      const usedCapacity = d.items.length;
      const effectiveCapacity = Math.max(d.capacity, usedCapacity + 10);
      const availableCapacity = Math.max(0, effectiveCapacity - usedCapacity);

      let score = 50; // base score
      const reasons = [];

      // Check category match
      const cat = (d.category || '').toUpperCase();
      if (searchBrand && cat.includes(searchBrand)) {
        score += 35;
        reasons.push(`Kategori laci cocok dengan merk ${searchBrand}`);
      }

      // Check weight match
      if (weightNum > 0 && cat.includes(`${weightNum}G`)) {
        score += 25;
        reasons.push(`Kategori laci cocok dengan berat ${weightNum}g`);
      }

      // Check if drawer already contains identical brand & weight
      const sameItems = d.items.filter(
        (it) => it.brand?.toUpperCase().includes(searchBrand) && Math.abs(it.weight - weightNum) < 0.1
      );
      if (sameItems.length > 0) {
        score += 20;
        reasons.push(`Terdapat ${sameItems.length} keping serupa di laci ini`);
      }

      // Free space score
      if (availableCapacity > 5) {
        score += 15;
      } else if (availableCapacity > 0) {
        score += 5;
      }

      const reasonStr = reasons.length > 0 ? reasons.join(' • ') : `Kapasitas memadai (${availableCapacity} slot kosong)`;

      return {
        drawerId: d.id,
        drawerCode: d.code,
        drawerName: d.name,
        category: d.category || 'Umum',
        capacity: effectiveCapacity,
        usedCapacity,
        availableCapacity,
        slotNumber: d.slot.slotNumber,
        slotQrCode: d.slot.qrCode || `QR-${d.slot.cabinet.code}-SLOT-0${d.slot.slotNumber}`,
        cabinetCode: d.slot.cabinet.code,
        cabinetName: d.slot.cabinet.name,
        fullPath: `${d.slot.cabinet.name} (${d.slot.cabinet.code}) ➔ Slot ${d.slot.slotNumber} ➔ Laci ${d.name} (${d.code})`,
        score,
        reason: reasonStr,
      };
    });

    // Sort by score descending, then by available capacity
    recommendations.sort((a, b) => b.score - a.score || b.availableCapacity - a.availableCapacity);

    return sendSuccess(
      res,
      {
        recommendations: recommendations.slice(0, 10),
        bestMatch: recommendations[0] || null,
      },
      'Rekomendasi laci vault berhasil dihitung',
      200
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Put-away Single Gold Item into Vault (per keping)
 */
const putAwayItem = async (req, res, next) => {
  try {
    const { id } = req.params; // Inbound Order ID
    const {
      lineId,
      serialNumber,
      brand,
      weight,
      weightGrams,
      purity = '999.9',
      drawerCode,
      slotPosition,
      notes,
    } = req.body;

    const finalBrand = (brand || '').trim().toUpperCase();
    const finalWeight = parseFloat(weight !== undefined ? weight : weightGrams);

    if (!lineId) {
      return sendError(res, 'Line ID Inbound wajib disertakan', 400);
    }
    if (!drawerCode) {
      return sendError(res, 'Kode / ID Laci vault tujuan wajib dipilih', 400);
    }
    if (!finalBrand || isNaN(finalWeight) || finalWeight <= 0) {
      return sendError(res, 'Brand dan Berat emas (gram) tidak valid', 400);
    }

    // Verify Inbound Order
    const order = await prisma.inboundOrder.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!order) {
      return sendError(res, `PO Inbound ${id} tidak ditemukan`, 404);
    }
    if (order.status !== 'APPROVED' && order.status !== 'RECEIVING') {
      return sendError(res, `PO Inbound berstatus ${order.status}. Hanya status APPROVED atau RECEIVING yang dapat melakukan put-away`, 400);
    }

    // Verify Line Item
    const line = order.lines.find((l) => l.id === lineId);
    if (!line) {
      return sendError(res, `Baris pengadaan emas ${lineId} tidak ditemukan dalam PO Inbound ${id}`, 404);
    }
    if (line.qtyReceived >= line.qtyRequested) {
      return sendError(res, `Baris ${line.goldBrand} (${line.weightGrams}g) sudah terpenuhi seluruhnya (${line.qtyReceived}/${line.qtyRequested} keping)`, 400);
    }

    // Auto-generate serial number if empty
    let finalSerial = (serialNumber || '').trim().toUpperCase();
    if (!finalSerial) {
      const year = new Date().getFullYear();
      const randomCode = Math.floor(100000 + Math.random() * 900000);
      finalSerial = `LM-${year}-${randomCode}`;
    }

    // Check duplicate serial number
    const existing = await prisma.item.findUnique({
      where: { id: finalSerial },
    });
    if (existing) {
      return sendError(res, `Nomor Seri / ID ${finalSerial} sudah terdaftar di sistem! Gunakan nomor seri unik lain.`, 400);
    }

    // Find target drawer
    const drawer = await prisma.drawer.findFirst({
      where: {
        OR: [{ code: drawerCode }, { id: drawerCode }],
      },
      include: {
        slot: { include: { cabinet: true } },
        items: { where: { currentStatus: { in: ['IN_HO', 'ALLOCATED_PO'] } } },
      },
    });

    if (!drawer) {
      return sendError(res, `Laci ${drawerCode} tidak ditemukan di sistem`, 404);
    }

    // Expand capacity if filled
    if (drawer.items.length >= drawer.capacity) {
      await prisma.drawer.update({
        where: { id: drawer.id },
        data: { capacity: drawer.items.length + 10 },
      });
    }

    // Format slotPosition
    let formattedSlotPos = slotPosition;
    if (typeof slotPosition === 'number' || (!isNaN(slotPosition) && !String(slotPosition).startsWith('SLOT-'))) {
      formattedSlotPos = `SLOT-${String(slotPosition).padStart(2, '0')}`;
    }
    if (!formattedSlotPos || drawer.items.some((i) => i.slotPosition === formattedSlotPos)) {
      formattedSlotPos = `SLOT-${String(drawer.items.length + 1).padStart(2, '0')}`;
    }

    const qrPayload = buildItemQrPayload(finalSerial, finalBrand, finalWeight, purity);
    const qrDataUrl = await generateQrDataUrl(qrPayload);
    const actor = req.user?.username || 'staff_ho';

    // Transaction for saving Item and updating Inbound Order
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Item
      const newItem = await tx.item.create({
        data: {
          id: finalSerial,
          qrCode: qrPayload,
          brand: finalBrand,
          weight: finalWeight,
          purity,
          currentStatus: 'IN_HO',
          drawerId: drawer.id,
          slotPosition: formattedSlotPos,
          inboundOrderId: id,
          notes: notes ? notes.trim() : `Inbound dari PO ${id} (${order.supplierName})`,
        },
        include: {
          drawer: {
            include: {
              slot: { include: { cabinet: true } },
            },
          },
        },
      });

      // 2. Create Item History
      await tx.itemHistory.create({
        data: {
          itemId: finalSerial,
          event: 'HO_INBOUND',
          actor,
          locationCode: req.user?.location?.code || 'HO-CENTRAL',
          details: `Inbound keping emas dari PO ${id} (${order.supplierName}). Disimpan di ${drawer.slot.cabinet.name} -> Slot ${drawer.slot.slotNumber} -> Laci ${drawer.name} (${formattedSlotPos})`,
        },
      });

      // 3. Increment Line received count
      const updatedLine = await tx.inboundOrderLine.update({
        where: { id: lineId },
        data: { qtyReceived: { increment: 1 } },
      });

      // 4. Check if order is now complete or needs status RECEIVING
      const allLines = await tx.inboundOrderLine.findMany({
        where: { inboundOrderId: id },
      });
      const allFulfilled = allLines.every((l) => l.qtyReceived >= l.qtyRequested);

      let newStatus = order.status;
      let completedAt = null;
      if (allFulfilled) {
        newStatus = 'COMPLETED';
        completedAt = new Date();
      } else if (order.status !== 'RECEIVING') {
        newStatus = 'RECEIVING';
      }

      const updatedOrder = await tx.inboundOrder.update({
        where: { id },
        data: {
          status: newStatus,
          receivedBy: order.receivedBy || actor,
          completedAt,
        },
      });

      // 5. Audit Trail
      await tx.auditTrail.create({
        data: {
          action: 'PUT_AWAY_INBOUND_ITEM',
          actor,
          locationCode: req.user?.location?.code || 'HO-CENTRAL',
          details: `Menyimpan keping emas ${finalSerial} (${finalBrand} ${finalWeight}g) ke ${drawer.code} [Slot ${drawer.slot.slotNumber}]. PO Inbound: ${id}.`,
          ipAddress: req.ip,
        },
      });

      return {
        item: { ...newItem, qrDataUrl },
        line: updatedLine,
        order: updatedOrder,
        allFulfilled,
      };
    });

    return sendSuccess(
      res,
      result,
      `Keping emas ${finalSerial} (${finalBrand} ${finalWeight}g) berhasil disimpan ke Vault (${drawer.slot.cabinet.name} - Slot ${drawer.slot.slotNumber} - ${drawer.name})!`,
      201
    );
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getInboundOrders,
  getInboundOrderById,
  createInboundOrder,
  submitInboundOrder,
  approveInboundOrder,
  rejectInboundOrder,
  receiveInboundGoods,
  getDrawerRecommendations,
  putAwayItem,
};

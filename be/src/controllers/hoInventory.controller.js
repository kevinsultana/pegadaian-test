const prisma = require('../config/prisma');
const { sendSuccess, sendError } = require('../utils/response');
const { generateQrDataUrl, buildItemQrPayload } = require('../utils/qrcode');

/**
 * Get HO Inventory items with filters and search
 */
const getHoInventory = async (req, res, next) => {
  try {
    const { brand, cabinetCode, drawerCode, search, status } = req.query;

    const where = {
      currentStatus: status ? status : { in: ['IN_HO', 'ALLOCATED_PO'] },
    };

    if (brand) {
      where.brand = { contains: brand, mode: 'insensitive' };
    }

    if (drawerCode) {
      where.drawer = { code: drawerCode };
    } else if (cabinetCode) {
      where.drawer = {
        slot: {
          cabinet: { code: cabinetCode.toUpperCase() },
        },
      };
    }

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { qrCode: { contains: search, mode: 'insensitive' } },
        { sbgNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.item.findMany({
      where,
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
    });

    const totalWeight = items.reduce((acc, curr) => acc + curr.weight, 0);

    const formattedItems = items.map((it) => ({
      ...it,
      serialNumber: it.id,
      goldType: it.brand,
      weightGrams: it.weight,
    }));

    return sendSuccess(
      res,
      {
        items: formattedItems,
        totalCount: items.length,
        totalWeight: Number(totalWeight.toFixed(2)),
      },
      'Daftar Inventori Emas Head Office (HO)',
      200,
      { totalCount: items.length, totalWeight: Number(totalWeight.toFixed(2)) }
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Register a new gold item into HO (Inbound Emas Pusat)
 */
const registerInboundItem = async (req, res, next) => {
  try {
    const {
      id, // Serial Number / Tag ID e.g. "E0049901"
      serialNumber, // Dukung juga alias serialNumber dari FE
      brand, // "ANTAM 10 g"
      goldType, // Dukung juga alias goldType dari FE
      weight, // 10.0
      weightGrams, // Dukung juga alias weightGrams dari FE
      purity = '999.9',
      sbgNumber,
      drawerCode, // e.g. "HO-CAB-01-SL01-DRW-BIG"
      drawerId,
      slotPosition, // e.g. "SLOT-03" atau integer 1
      notes,
    } = req.body;

    const finalId = (id || serialNumber || '').trim();
    const finalBrand = (brand || goldType || 'LOGAM MULIA').trim();
    const finalWeight = parseFloat(weight !== undefined ? weight : weightGrams);
    const targetDrawerKey = (drawerCode || drawerId || '').trim();

    if (!finalId || !finalBrand || isNaN(finalWeight) || !targetDrawerKey) {
      return sendError(res, 'Serial Number / ID, Tipe Emas (Brand), Berat, dan Kode/ID Laci wajib diisi', 400);
    }

    // Check if ID already registered
    const existing = await prisma.item.findUnique({
      where: { id: finalId },
    });
    if (existing) {
      return sendError(res, `Keping emas dengan No. Seri ${finalId} sudah terdaftar di sistem!`, 400);
    }

    // Check target drawer
    const drawer = await prisma.drawer.findFirst({
      where: {
        OR: [
          { code: targetDrawerKey },
          { id: targetDrawerKey },
        ],
      },
      include: {
        slot: { include: { cabinet: true } },
        items: { where: { currentStatus: { in: ['IN_HO', 'ALLOCATED_PO'] } } },
      },
    });

    if (!drawer) {
      return sendError(res, `Laci tujuan ${targetDrawerKey} tidak ditemukan`, 404);
    }

    // Dynamic capacity: no arbitrary limit for gold items in drawer
    if (drawer.items.length >= drawer.capacity) {
      await prisma.drawer.update({
        where: { id: drawer.id },
        data: { capacity: drawer.items.length + 20 },
      });
    }

    // Format slotPosition (bisa berupa integer 1 atau string "SLOT-01")
    let formattedSlotPos = slotPosition;
    if (typeof slotPosition === 'number' || (!isNaN(slotPosition) && !String(slotPosition).startsWith('SLOT-'))) {
      formattedSlotPos = `SLOT-${String(slotPosition).padStart(2, '0')}`;
    }

    // Auto-resolve slot position if not specified or already taken
    if (!formattedSlotPos || drawer.items.some((i) => i.slotPosition === formattedSlotPos)) {
      formattedSlotPos = `SLOT-${String(drawer.items.length + 1).padStart(2, '0')}`;
    }

    const finalSlotPos = formattedSlotPos || `SLOT-${String(drawer.items.length + 1).padStart(2, '0')}`;
    const qrPayload = buildItemQrPayload(finalId, finalBrand, finalWeight, purity, sbgNumber);

    const result = await prisma.$transaction(async (tx) => {
      const newItem = await tx.item.create({
        data: {
          id: finalId,
          qrCode: qrPayload,
          brand: finalBrand,
          weight: finalWeight,
          purity,
          sbgNumber: sbgNumber || null,
          currentStatus: 'IN_HO',
          drawerId: drawer.id,
          slotPosition: finalSlotPos,
          notes: notes || null,
        },
        include: {
          drawer: {
            include: {
              slot: { include: { cabinet: true } },
            },
          },
        },
      });

      // Item History
      await tx.itemHistory.create({
        data: {
          itemId: newItem.id,
          event: 'HO_INBOUND',
          actor: req.user.username,
          locationCode: 'HO-CENTRAL',
          details: `Keping emas ${newItem.id} (${newItem.brand}) didaftarkan di HO dan dialokasikan ke ${drawer.slot.cabinet.code} -> ${drawer.name} -> ${finalSlotPos}. QR Code diterbitkan.`,
        },
      });

      // Audit Trail
      await tx.auditTrail.create({
        data: {
          action: 'HO_INBOUND_REGISTRATION',
          actor: req.user.username,
          locationCode: 'HO-CENTRAL',
          details: `Pendaftaran emas baru: ${newItem.id} (${newItem.brand}, ${newItem.weight}g) ke lemari ${drawer.slot.cabinet.code}`,
          ipAddress: req.ip,
        },
      });

      return newItem;
    });

    const qrDataUrl = await generateQrDataUrl(result.qrCode);

    return sendSuccess(
      res,
      {
        item: {
          ...result,
          serialNumber: result.id,
          goldType: result.brand,
          weightGrams: result.weight,
        },
        ...result,
        serialNumber: result.id,
        goldType: result.brand,
        weightGrams: result.weight,
        qrDataUrl,
      },
      `Keping emas ${result.id} berhasil didaftarkan di Vault HO!`,
      201
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Scan Item QR Code and retrieve item details & position
 */
const getItemByQrCode = async (req, res, next) => {
  try {
    const { qrPayload } = req.query;

    if (!qrPayload) {
      return sendError(res, 'Payload QR Code wajib diberikan', 400);
    }

    const item = await prisma.item.findFirst({
      where: {
        OR: [
          { qrCode: qrPayload },
          { id: qrPayload }, // Allow scanning by raw ID as fallback
        ],
      },
      include: {
        drawer: {
          include: {
            slot: { include: { cabinet: true } },
          },
        },
        histories: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!item) {
      return sendError(res, 'Keping emas dengan QR Code tersebut tidak ditemukan di sistem', 404);
    }

    const qrDataUrl = await generateQrDataUrl(item.qrCode);

    return sendSuccess(res, { ...item, qrDataUrl }, 'Data Keping Emas Terverifikasi');
  } catch (err) {
    next(err);
  }
};

/**
 * Get Printable Label for an Item (Data URL image + specifications)
 */
const getItemPrintableLabel = async (req, res, next) => {
  try {
    const { itemId } = req.params;

    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        drawer: {
          include: {
            slot: { include: { cabinet: true } },
          },
        },
      },
    });

    if (!item) {
      return sendError(res, `Keping emas ${itemId} tidak ditemukan`, 404);
    }

    const qrDataUrl = await generateQrDataUrl(item.qrCode);

    const labelData = {
      itemId: item.id,
      brand: item.brand,
      weight: `${item.weight} gram`,
      purity: item.purity,
      sbgNumber: item.sbgNumber || '-',
      qrCode: item.qrCode,
      qrDataUrl,
      cabinetCode: item.drawer?.slot?.cabinet?.code || '-',
      drawerCode: item.drawer?.code || '-',
      slotPosition: item.slotPosition || '-',
      registeredDate: item.createdAt.toLocaleDateString('id-ID'),
    };

    return sendSuccess(
      res,
      {
        ...labelData,
        item: {
          ...item,
          serialNumber: item.id,
          goldType: item.brand,
          weightGrams: item.weight,
          qrDataUrl,
        },
      },
      'Label Cetak QR Emas'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Overview KPI Dashboard Statistics for HO
 */
const getHoDashboardStats = async (req, res, next) => {
  try {
    const activeItems = await prisma.item.findMany({
      where: { currentStatus: { in: ['IN_HO', 'ALLOCATED_PO'] } },
      select: { brand: true, weight: true, currentStatus: true },
    });

    const totalWeight = activeItems.reduce((acc, curr) => acc + curr.weight, 0);
    const allocatedWeight = activeItems
      .filter((i) => i.currentStatus === 'ALLOCATED_PO')
      .reduce((acc, curr) => acc + curr.weight, 0);

    const totalCabinets = await prisma.cabinet.count();
    const totalDrawers = await prisma.drawer.count();

    // Brand breakdown
    const brandMap = {};
    activeItems.forEach((it) => {
      const b = it.brand.split(' ')[0] || 'LAINNYA';
      brandMap[b] = (brandMap[b] || 0) + 1;
    });

    // Pending POs
    const pendingPoCount = await prisma.purchaseOrder.count({
      where: { status: { in: ['REQUESTED', 'APPROVED', 'PICKING'] } },
    });

    return sendSuccess(
      res,
      {
        totalPieces: activeItems.length,
        totalWeightGram: Number(totalWeight.toFixed(2)),
        allocatedWeightGram: Number(allocatedWeight.toFixed(2)),
        allocatedPoCount: activeItems.filter((i) => i.currentStatus === 'ALLOCATED_PO').length,
        totalCabinets,
        totalDrawers,
        pendingPoCount,
        brandBreakdown: brandMap,
      },
      'Statistik Dashboard Vault HO'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Update an existing gold item details (Super Admin / HO Staff)
 */
const updateItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { brand, goldType, weight, weightGrams, purity, slotPosition, notes, drawerCode, currentStatus } = req.body;

    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        drawer: {
          include: {
            slot: { include: { cabinet: true } },
          },
        },
      },
    });

    if (!item) {
      return sendError(res, `Keping emas dengan ID ${id} tidak ditemukan`, 404);
    }

    const finalBrand = (brand || goldType || item.brand).trim();
    const finalWeight = weight !== undefined ? parseFloat(weight) : (weightGrams !== undefined ? parseFloat(weightGrams) : item.weight);
    const finalPurity = (purity || item.purity).trim();

    const updateData = {
      brand: finalBrand,
      weight: finalWeight,
      purity: finalPurity,
    };

    if (slotPosition !== undefined) {
      updateData.slotPosition = typeof slotPosition === 'number' || (!isNaN(slotPosition) && !String(slotPosition).startsWith('SLOT-'))
        ? `SLOT-${String(slotPosition).padStart(2, '0')}`
        : slotPosition;
    }
    if (notes !== undefined) updateData.notes = notes;
    if (currentStatus !== undefined) updateData.currentStatus = currentStatus;

    // If target drawer changed
    if (drawerCode && drawerCode !== item.drawer?.code) {
      const targetDrawer = await prisma.drawer.findUnique({
        where: { code: drawerCode },
      });
      if (!targetDrawer) {
        return sendError(res, `Laci tujuan ${drawerCode} tidak ditemukan`, 404);
      }
      updateData.drawerId = targetDrawer.id;
    }

    // Re-generate QR payload
    updateData.qrCode = buildItemQrPayload(item.id, finalBrand, finalWeight, finalPurity, item.sbgNumber);

    const updated = await prisma.item.update({
      where: { id },
      data: updateData,
      include: {
        drawer: {
          include: {
            slot: { include: { cabinet: true } },
          },
        },
      },
    });

    // Audit log
    await prisma.auditTrail.create({
      data: {
        action: 'UPDATE_GOLD_ITEM',
        actor: req.user.username,
        locationCode: 'HO-CENTRAL',
        details: `Memperbarui data keping emas: ${updated.id} (${updated.brand}, ${updated.weight}g)`,
        ipAddress: req.ip,
      },
    });

    const qrDataUrl = await generateQrDataUrl(updated.qrCode);

    return sendSuccess(
      res,
      {
        ...updated,
        serialNumber: updated.id,
        goldType: updated.brand,
        weightGrams: updated.weight,
        qrDataUrl,
      },
      `Keping emas ${updated.id} berhasil diperbarui`
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a gold item from HO
 */
const deleteItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        poItems: true,
        drawer: {
          include: {
            slot: { include: { cabinet: true } },
          },
        },
      },
    });

    if (!item) {
      return sendError(res, `Keping emas dengan ID ${id} tidak ditemukan`, 404);
    }

    if (item.currentStatus === 'ALLOCATED_PO' || (item.poItems && item.poItems.length > 0)) {
      return sendError(
        res,
        `Keping emas ${item.id} tidak dapat dihapus karena sedang terkait transaksi Purchase Order / distribusi aktif`,
        400
      );
    }

    await prisma.item.delete({
      where: { id },
    });

    // Audit log
    await prisma.auditTrail.create({
      data: {
        action: 'DELETE_GOLD_ITEM',
        actor: req.user.username,
        locationCode: 'HO-CENTRAL',
        details: `Menghapus keping emas: ${item.id} (${item.brand}, ${item.weight}g) dari laci ${item.drawer?.code || '-'}`,
        ipAddress: req.ip,
      },
    });

    return sendSuccess(res, null, `Keping emas ${item.id} (${item.brand}) berhasil dihapus dari vault`);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getHoInventory,
  registerInboundItem,
  getItemByQrCode,
  getItemPrintableLabel,
  getHoDashboardStats,
  updateItem,
  deleteItem,
};

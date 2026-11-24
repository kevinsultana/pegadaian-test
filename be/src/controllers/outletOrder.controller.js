const prisma = require('../config/prisma');
const { sendSuccess, sendError } = require('../utils/response');

// Helper untuk membangun kondisi Prisma OR query untuk brand (fleksibel terhadap spasi, underscore, casing)
const buildBrandWhereConditions = (goldBrand) => {
  if (!goldBrand) return [];
  const raw = String(goldBrand).trim();
  const withUnderscore = raw.replace(/\s+/g, '_');
  const withSpace = raw.replace(/_/g, ' ');
  const noSpace = raw.replace(/[\s_\-]+/g, '');

  const variants = Array.from(new Set([raw, withUnderscore, withSpace, noSpace])).filter(Boolean);
  return variants.flatMap((b) => [
    { brand: { equals: b, mode: 'insensitive' } },
    { brand: { contains: b, mode: 'insensitive' } },
  ]);
};

// Helper: generate PO ID
async function generatePoId() {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const count = await prisma.purchaseOrder.count({
    where: { id: { startsWith: `PO-${ym}-` } },
  });
  return `PO-${ym}-${String(count + 1).padStart(4, '0')}`;
}

// GET /api/outlet/orders - List POs milik outlet user
const listOutletOrders = async (req, res) => {
  try {
    const user = req.user;
    const { status, page = 1, limit = 20, destLocId, outletLocationId } = req.query;

    const targetLoc = destLocId || outletLocationId;
    const where = {};

    if (user.role === 'SUPER_ADMIN') {
      if (targetLoc && targetLoc !== 'ALL') {
        where.destLocId = targetLoc;
      }
    } else {
      where.destLocId = user.locationId;
    }

    if (status && status !== 'ALL') where.status = status;

    const [total, orders] = await Promise.all([
      prisma.purchaseOrder.count({ where }),
      prisma.purchaseOrder.findMany({
        where,
        include: {
          sourceLocation: { select: { name: true, code: true } },
          destLocation: { select: { name: true, code: true } },
          requestLines: true,
          items: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
    ]);

    return sendSuccess(res, { orders, total, page: Number(page), limit: Number(limit) }, 'Daftar PO outlet berhasil diambil');
  } catch (err) {
    console.error(err);
    return sendError(res, 'Gagal mengambil daftar PO', 500);
  }
};

// GET /api/outlet/orders/:id - Detail PO
const getOutletOrderDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const where = user.role === 'SUPER_ADMIN' ? { id } : { id, destLocId: user.locationId };
    const po = await prisma.purchaseOrder.findFirst({
      where,
      include: {
        sourceLocation: true,
        destLocation: true,
        requestLines: true,
        items: {
          include: {
            item: {
              select: {
                id: true,
                brand: true,
                weight: true,
                purity: true,
                qrCode: true,
                rfidTag: true,
                currentStatus: true,
                drawerId: true,
                drawer: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    rfidAntenna: true,
                    category: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!po) return sendError(res, 'PO tidak ditemukan', 404);

    // Hitung stok ketersediaan di HO
    const linesWithStock = await Promise.all(
      (po.requestLines || []).map(async (line) => {
        const availableCount = await prisma.item.count({
          where: {
            currentStatus: 'IN_HO',
            weight: Number(line.weightGrams),
            drawerId: { not: null },
            OR: buildBrandWhereConditions(line.goldBrand),
          },
        });
        const shortage = Math.max(0, line.qtyRequested - availableCount);
        let stockStatus = 'FULL';
        if (availableCount === 0) stockStatus = 'EMPTY';
        else if (availableCount < line.qtyRequested) stockStatus = 'PARTIAL';

        return {
          ...line,
          availableStock: availableCount,
          shortage,
          stockStatus,
        };
      })
    );

    let overallStockStatus = 'ALL_AVAILABLE';
    if (linesWithStock.length === 0) {
      overallStockStatus = 'ALL_AVAILABLE';
    } else if (linesWithStock.every((l) => l.stockStatus === 'EMPTY')) {
      overallStockStatus = 'OUT_OF_STOCK';
    } else if (linesWithStock.some((l) => l.stockStatus !== 'FULL')) {
      overallStockStatus = 'PARTIALLY_AVAILABLE';
    }

    return sendSuccess(
      res,
      {
        ...po,
        requestLines: linesWithStock,
        overallStockStatus,
      },
      'Detail PO berhasil diambil'
    );
  } catch (err) {
    console.error(err);
    return sendError(res, 'Gagal mengambil detail PO', 500);
  }
};

// POST /api/outlet/orders - Buat DRAFT PO baru
const createDraftOrder = async (req, res) => {
  try {
    const user = req.user;
    const { notes, requestLines, destLocId, outletLocationId } = req.body;

    if (!requestLines || !Array.isArray(requestLines) || requestLines.length === 0) {
      return sendError(res, 'Request lines tidak boleh kosong', 400);
    }

    // Validasi setiap request line
    for (const line of requestLines) {
      if (!line.goldBrand || !line.weightGrams || !line.qtyRequested) {
        return sendError(res, 'Setiap request line harus memiliki goldBrand, weightGrams, dan qtyRequested', 400);
      }
      if (line.qtyRequested < 1) {
        return sendError(res, 'Qty harus minimal 1', 400);
      }
    }

    // Tentukan lokasi Outlet tujuan
    let targetDestLocId = user.locationId;
    if (user.role === 'SUPER_ADMIN') {
      targetDestLocId = destLocId || outletLocationId;
      if (!targetDestLocId) {
        const firstOutlet = await prisma.location.findFirst({
          where: { type: 'OUTLET_HUB' },
        });
        if (!firstOutlet) {
          return sendError(res, 'Lokasi Outlet tujuan wajib dipilih oleh Super Admin', 400);
        }
        targetDestLocId = firstOutlet.id;
      }
    }

    const destLocation = await prisma.location.findUnique({
      where: { id: targetDestLocId },
    });
    if (!destLocation) {
      return sendError(res, 'Lokasi tujuan Outlet tidak ditemukan', 400);
    }

    // Cari lokasi HO (sourceLocation)
    const hoLocation = await prisma.location.findFirst({
      where: { type: 'HEAD_OFFICE' },
    });
    if (!hoLocation) return sendError(res, 'Lokasi HO tidak ditemukan', 500);

    const poId = await generatePoId();

    const po = await prisma.purchaseOrder.create({
      data: {
        id: poId,
        sourceLocId: hoLocation.id,
        destLocId: targetDestLocId,
        status: 'DRAFT',
        notes,
        requestedBy: user.username,
        requestLines: {
          create: requestLines.map((line) => ({
            goldBrand: line.goldBrand,
            weightGrams: Number(line.weightGrams),
            qtyRequested: Number(line.qtyRequested),
            notes: line.notes || null,
          })),
        },
      },
      include: { requestLines: true, destLocation: true },
    });

    return sendSuccess(res, po, `Draft PO ${poId} berhasil dibuat untuk ${destLocation.name}`, 201);
  } catch (err) {
    console.error(err);
    return sendError(res, 'Gagal membuat PO', 500);
  }
};

// PATCH /api/outlet/orders/:id/submit-to-spv - Outlet Staff submit ke Outlet SPV
const submitToOutletSpv = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const whereClause = user.role === 'SUPER_ADMIN' ? { id } : { id, destLocId: user.locationId };
    const po = await prisma.purchaseOrder.findFirst({
      where: whereClause,
    });

    if (!po) return sendError(res, 'PO tidak ditemukan', 404);
    if (po.status !== 'DRAFT') {
      return sendError(res, `PO tidak bisa disubmit karena status saat ini: ${po.status}`, 400);
    }
    if (user.role !== 'SUPER_ADMIN' && po.requestedBy !== user.username) {
      return sendError(res, 'Hanya pembuat PO yang bisa submit', 403);
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'PENDING_OUTLET_SPV' },
    });

    return sendSuccess(res, updated, 'PO berhasil disubmit ke Supervisor Outlet');
  } catch (err) {
    console.error(err);
    return sendError(res, 'Gagal submit PO', 500);
  }
};

// PATCH /api/outlet/orders/:id/approve-outlet - Outlet SPV approve → SUBMITTED_TO_HO
const approveByOutletSpv = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!['OUTLET_SUPERVISOR', 'SUPER_ADMIN'].includes(user.role)) {
      return sendError(res, 'Hanya Supervisor Outlet atau Super Admin yang bisa approve', 403);
    }

    const whereClause = user.role === 'SUPER_ADMIN' ? { id } : { id, destLocId: user.locationId };
    const po = await prisma.purchaseOrder.findFirst({
      where: whereClause,
    });

    if (!po) return sendError(res, 'PO tidak ditemukan', 404);
    if (po.status !== 'PENDING_OUTLET_SPV') {
      return sendError(res, `PO tidak bisa di-approve karena status saat ini: ${po.status}`, 400);
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'SUBMITTED_TO_HO',
        outletApprovedBy: user.username,
      },
    });

    return sendSuccess(res, updated, 'PO berhasil disetujui dan dikirim ke HO');
  } catch (err) {
    console.error(err);
    return sendError(res, 'Gagal approve PO', 500);
  }
};

// PATCH /api/outlet/orders/:id/reject-outlet - Outlet SPV reject PO
const rejectByOutletSpv = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user = req.user;

    if (!['OUTLET_SUPERVISOR', 'SUPER_ADMIN'].includes(user.role)) {
      return sendError(res, 'Hanya Supervisor Outlet atau Super Admin yang bisa reject', 403);
    }

    const whereClause = user.role === 'SUPER_ADMIN' ? { id } : { id, destLocId: user.locationId };
    const po = await prisma.purchaseOrder.findFirst({
      where: whereClause,
    });

    if (!po) return sendError(res, 'PO tidak ditemukan', 404);
    if (po.status !== 'PENDING_OUTLET_SPV') {
      return sendError(res, `PO tidak bisa di-reject karena status saat ini: ${po.status}`, 400);
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'REJECTED',
        notes: reason ? `${po.notes || ''}\n[Ditolak Outlet SPV: ${reason}]`.trim() : po.notes,
      },
    });

    return sendSuccess(res, updated, 'PO berhasil ditolak');
  } catch (err) {
    console.error(err);
    return sendError(res, 'Gagal reject PO', 500);
  }
};

// PATCH /api/outlet/orders/:id/receive - Outlet mark as RECEIVED
const receiveOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const where = user.role === 'SUPER_ADMIN' ? { id } : { id, destLocId: user.locationId };
    const po = await prisma.purchaseOrder.findFirst({
      where,
      include: {
        items: {
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
        },
      },
    });

    if (!po) return sendError(res, 'PO tidak ditemukan', 404);
    if (!['DISPATCHED', 'PARTIAL_HOLD'].includes(po.status)) {
      return sendError(res, `PO tidak bisa diterima karena status saat ini: ${po.status}`, 400);
    }

    // Default drawer di outlet tujuan jika ada item yang masih mengarah ke lemari HO
    const defaultOutletDrawer = await prisma.drawer.findFirst({
      where: {
        slot: { cabinet: { locationId: po.destLocId } },
      },
    });

    // Update semua item PO menjadi IN_OUTLET dan pastikan drawer dialihkan ke outlet tujuan jika masih memegang laci HO
    const itemUpdates = po.items.map((poi) => {
      const isStillInHo = poi.item?.drawer?.slot?.cabinet?.locationId !== po.destLocId;
      const updateData = { currentStatus: 'IN_OUTLET' };
      if (isStillInHo && defaultOutletDrawer) {
        updateData.drawerId = defaultOutletDrawer.id;
      }
      return prisma.item.update({
        where: { id: poi.itemId },
        data: updateData,
      });
    });

    await prisma.$transaction([
      prisma.purchaseOrder.update({
        where: { id },
        data: { status: 'RECEIVED', receivedBy: user.username },
      }),
      ...itemUpdates,
    ]);

    return sendSuccess(res, { id }, 'PO berhasil ditandai sebagai diterima');
  } catch (err) {
    console.error(err);
    return sendError(res, 'Gagal konfirmasi penerimaan PO', 500);
  }
};

// PATCH /api/outlet/orders/:id - Update draft PO (hanya saat DRAFT)
const updateDraftOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { notes, requestLines } = req.body;

    const whereClause = user.role === 'SUPER_ADMIN' ? { id } : { id, destLocId: user.locationId };
    const po = await prisma.purchaseOrder.findFirst({
      where: whereClause,
    });

    if (!po) return sendError(res, 'PO tidak ditemukan', 404);
    if (po.status !== 'DRAFT') {
      return sendError(res, 'Hanya PO berstatus DRAFT yang bisa diubah', 400);
    }

    // Delete existing lines then recreate
    await prisma.$transaction([
      prisma.pORequestLine.deleteMany({ where: { poId: id } }),
      prisma.purchaseOrder.update({
        where: { id },
        data: {
          notes,
          requestLines: {
            create: (requestLines || []).map((line) => ({
              goldBrand: line.goldBrand,
              weightGrams: Number(line.weightGrams),
              qtyRequested: Number(line.qtyRequested),
              notes: line.notes || null,
            })),
          },
        },
      }),
    ]);

    const updated = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { requestLines: true },
    });

    return sendSuccess(res, updated, 'Draft PO berhasil diperbarui');
  } catch (err) {
    console.error(err);
    return sendError(res, 'Gagal update PO', 500);
  }
};

// DELETE /api/outlet/orders/:id - Hapus DRAFT PO
const deleteDraftOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const whereClause = user.role === 'SUPER_ADMIN' ? { id } : { id, destLocId: user.locationId };
    const po = await prisma.purchaseOrder.findFirst({
      where: whereClause,
    });

    if (!po) return sendError(res, 'PO tidak ditemukan', 404);
    if (po.status !== 'DRAFT') {
      return sendError(res, 'Hanya PO berstatus DRAFT yang bisa dihapus', 400);
    }

    await prisma.purchaseOrder.delete({ where: { id } });
    return sendSuccess(res, { id }, 'Draft PO berhasil dihapus');
  } catch (err) {
    console.error(err);
    return sendError(res, 'Gagal hapus PO', 500);
  }
};

// GET /api/outlet/orders/drawers?locationId=...
const getOutletDrawers = async (req, res) => {
  try {
    const user = req.user;
    const { locationId } = req.query;

    let targetLocId = user.locationId;
    if (user.role === 'SUPER_ADMIN' && locationId) {
      targetLocId = locationId;
    }

    const drawers = await prisma.drawer.findMany({
      where: {
        slot: {
          cabinet: {
            locationId: targetLocId,
          },
        },
      },
      include: {
        slot: {
          include: {
            cabinet: { select: { id: true, code: true, name: true } },
          },
        },
        items: {
          where: { currentStatus: 'IN_OUTLET' },
          select: { id: true, brand: true, weight: true },
        },
      },
      orderBy: { code: 'asc' },
    });

    const formattedDrawers = drawers.map((d) => {
      const usedCapacity = d.items.length;
      return {
        id: d.id,
        code: d.code,
        name: d.name,
        category: d.category,
        capacity: d.capacity,
        usedCapacity,
        availableCapacity: Math.max(0, d.capacity - usedCapacity),
        rfidAntenna: d.rfidAntenna,
        cabinetName: d.slot?.cabinet?.name,
        cabinetCode: d.slot?.cabinet?.code,
        slotNumber: d.slot?.slotNumber,
      };
    });

    return sendSuccess(res, formattedDrawers, 'Daftar laci brankas outlet berhasil diambil');
  } catch (err) {
    console.error(err);
    return sendError(res, 'Gagal mengambil daftar laci outlet', 500);
  }
};

// POST /api/outlet/orders/:id/pair-item-rfid
const pairItemRfid = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { itemId, rfidTag, drawerCode, drawerId, slotPosition, rowNumber } = req.body;

    if (!itemId) {
      return sendError(res, 'ID / Serial Number keping emas wajib diisi', 400);
    }
    if (!rfidTag || !rfidTag.trim()) {
      return sendError(res, 'Nomor Tag RFID (EPC) wajib diisi / dipindai', 400);
    }
    const cleanRfid = rfidTag.trim().toUpperCase();

    // Check PO existence & status
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: { include: { item: true } },
        destLocation: true,
      },
    });

    if (!po) return sendError(res, 'PO tidak ditemukan', 404);
    if (!['DISPATCHED', 'PARTIAL_HOLD', 'RECEIVED'].includes(po.status)) {
      return sendError(res, `PO berstatus ${po.status}. Hanya PO yang dikirim (DISPATCHED) yang dapat dipairing RFID`, 400);
    }

    // Verify item is in PO
    const poItem = po.items.find((poi) => poi.itemId === itemId);
    if (!poItem) {
      return sendError(res, `Keping ${itemId} bukan bagian dari PO ${id}`, 400);
    }

    // Check if RFID tag already in use by another item
    const existingRfid = await prisma.item.findFirst({
      where: {
        rfidTag: cleanRfid,
        id: { not: itemId },
      },
    });
    if (existingRfid) {
      return sendError(res, `Tag RFID ${cleanRfid} sudah digunakan oleh keping ${existingRfid.id}! Gunakan tag RFID unik lain.`, 400);
    }

    // Find target drawer in outlet (wajib berada di lokasi outlet tujuan po.destLocId)
    const drawerTarget = drawerCode || drawerId;
    let targetDrawer = null;
    if (drawerTarget) {
      targetDrawer = await prisma.drawer.findFirst({
        where: {
          OR: [{ code: drawerTarget }, { id: drawerTarget }],
          slot: { cabinet: { locationId: po.destLocId } },
        },
        include: { slot: { include: { cabinet: true } } },
      });
    }

    // If no drawer specified or not in outlet, find default drawer in destination location
    if (!targetDrawer) {
      targetDrawer = await prisma.drawer.findFirst({
        where: {
          slot: { cabinet: { locationId: po.destLocId } },
        },
        include: { slot: { include: { cabinet: true } } },
      });
    }

    if (!targetDrawer) {
      return sendError(res, 'Laci brankas cabang tujuan tidak ditemukan', 404);
    }

    // Perform transaction
    const result = await prisma.$transaction(async (tx) => {
      // Tentukan posisi slot di dalam laci outlet (prioritas slotPosition eksplisit e.g. R1-03 atau per rowNumber)
      let finalSlotPos = slotPosition;
      if (!finalSlotPos) {
        const targetRow = Number(rowNumber) || 1;
        const itemsInThisRow = await tx.item.count({
          where: {
            drawerId: targetDrawer.id,
            currentStatus: 'IN_OUTLET',
            slotPosition: { startsWith: `R${targetRow}-` },
            id: { not: itemId },
          },
        });
        const nextCol = itemsInThisRow + 1;
        finalSlotPos = `R${targetRow}-${String(nextCol).padStart(2, '0')}`;
      }

      // 1. Update Item
      const updatedItem = await tx.item.update({
        where: { id: itemId },
        data: {
          rfidTag: cleanRfid,
          currentStatus: 'IN_OUTLET',
          drawerId: targetDrawer.id,
          slotPosition: finalSlotPos,
        },
        include: {
          drawer: true,
        },
      });

      // 2. Add Item History
      await tx.itemHistory.create({
        data: {
          itemId,
          event: 'OUTLET_RFID_PAIRING',
          actor: user.username,
          locationCode: po.destLocation?.code || 'OUTLET',
          details: `Keping emas ${itemId} (${updatedItem.brand} ${updatedItem.weight}g) dipairing dengan RFID Tag: ${cleanRfid} dan disimpan di ${targetDrawer.name} (${finalSlotPos}) (Antena: ${targetDrawer.rfidAntenna || 'Default'}).`,
        },
      });

      // 3. Check if all items in this PO are paired with RFID
      const allPoItems = await tx.pOItem.findMany({
        where: { poId: id },
        include: { item: true },
      });

      const allPaired = allPoItems.every((poi) => poi.item.id === itemId || poi.item.rfidTag !== null);

      let updatedPo = po;
      if (allPaired && po.status !== 'RECEIVED') {
        updatedPo = await tx.purchaseOrder.update({
          where: { id },
          data: {
            status: 'RECEIVED',
            receivedBy: user.username,
          },
        });

        await tx.auditTrail.create({
          data: {
            action: 'RECEIVE_PO_OUTLET',
            actor: user.username,
            locationCode: po.destLocation?.code || 'OUTLET',
            details: `Semua ${allPoItems.length} keping emas pada PO ${id} telah dipairing RFID dan diterima lengkap di ${po.destLocation?.name}`,
            ipAddress: req.ip,
          },
        });
      }

      return {
        item: updatedItem,
        drawer: targetDrawer,
        allPaired,
        poStatus: updatedPo.status,
      };
    });

    return sendSuccess(
      res,
      result,
      `Keping ${itemId} berhasil dipairing dengan RFID Tag ${cleanRfid} dan disimpan di ${result.drawer.name}`,
      200
    );
  } catch (err) {
    console.error(err);
    return sendError(res, 'Gagal pairing RFID keping emas: ' + err.message, 500);
  }
};

module.exports = {
  listOutletOrders,
  getOutletOrderDetail,
  createDraftOrder,
  submitToOutletSpv,
  approveByOutletSpv,
  rejectByOutletSpv,
  receiveOrder,
  updateDraftOrder,
  deleteDraftOrder,
  getOutletDrawers,
  pairItemRfid,
};

const prisma = require('../config/prisma');
const { sendSuccess, sendError } = require('../utils/response');

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
    const { status, page = 1, limit = 20 } = req.query;

    const where = user.role === 'SUPER_ADMIN' ? {} : { destLocId: user.locationId };
    if (status) where.status = status;

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
              select: { id: true, brand: true, weight: true, qrCode: true, currentStatus: true },
            },
          },
        },
      },
    });

    if (!po) return sendError(res, 'PO tidak ditemukan', 404);
    return sendSuccess(res, po, 'Detail PO berhasil diambil');
  } catch (err) {
    console.error(err);
    return sendError(res, 'Gagal mengambil detail PO', 500);
  }
};

// POST /api/outlet/orders - Buat DRAFT PO baru
const createDraftOrder = async (req, res) => {
  try {
    const user = req.user;
    const { notes, requestLines } = req.body;

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
        destLocId: user.locationId,
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
      include: { requestLines: true },
    });

    return sendSuccess(res, po, 'Draft PO berhasil dibuat', 201);
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

    const po = await prisma.purchaseOrder.findFirst({
      where: { id, destLocId: user.locationId },
    });

    if (!po) return sendError(res, 'PO tidak ditemukan', 404);
    if (po.status !== 'DRAFT') {
      return sendError(res, `PO tidak bisa disubmit karena status saat ini: ${po.status}`, 400);
    }
    if (po.requestedBy !== user.username) {
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
      include: { items: true },
    });

    if (!po) return sendError(res, 'PO tidak ditemukan', 404);
    if (!['DISPATCHED', 'PARTIAL_HOLD'].includes(po.status)) {
      return sendError(res, `PO tidak bisa diterima karena status saat ini: ${po.status}`, 400);
    }

    // Update semua item PO menjadi IN_OUTLET
    await prisma.$transaction([
      prisma.purchaseOrder.update({
        where: { id },
        data: { status: 'RECEIVED', receivedBy: user.username },
      }),
      ...po.items.map((poi) =>
        prisma.item.update({
          where: { id: poi.itemId },
          data: { currentStatus: 'IN_OUTLET' },
        })
      ),
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

    const po = await prisma.purchaseOrder.findFirst({
      where: { id, destLocId: user.locationId },
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

    const po = await prisma.purchaseOrder.findFirst({
      where: { id, destLocId: user.locationId },
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
};

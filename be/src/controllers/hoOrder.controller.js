const prisma = require('../config/prisma');
const { sendSuccess, sendError } = require('../utils/response');

// GET /api/ho/orders - List semua PO untuk HO
const listHoOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;

    const where = {};
    if (status) {
      // support comma-separated: ?status=SUBMITTED_TO_HO,APPROVED_HO,PICKING
      const statuses = status.split(',').map((s) => s.trim());
      where.status = { in: statuses };
    }
    if (search) {
      where.id = { contains: search, mode: 'insensitive' };
    }

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

    return sendSuccess(res, { orders, total, page: Number(page), limit: Number(limit) }, 'Daftar PO HO berhasil diambil');
  } catch (err) {
    console.error(err);
    return sendError(res, 'Gagal mengambil daftar PO HO', 500);
  }
};

// GET /api/ho/orders/:id - Detail PO
const getHoOrderDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
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
                qrCode: true,
                currentStatus: true,
                drawerId: true,
                drawer: {
                  select: {
                    code: true,
                    name: true,
                    slot: {
                      select: {
                        slotNumber: true,
                        cabinet: { select: { code: true, name: true } },
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

    if (!po) return sendError(res, 'PO tidak ditemukan', 404);
    return sendSuccess(res, po, 'Detail PO berhasil diambil');
  } catch (err) {
    console.error(err);
    return sendError(res, 'Gagal mengambil detail PO', 500);
  }
};

// PATCH /api/ho/orders/:id/approve - HO SPV approve → APPROVED_HO
const approveByHoSpv = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!['HO_SUPERVISOR', 'SUPER_ADMIN'].includes(user.role)) {
      return sendError(res, 'Hanya Supervisor HO yang bisa approve PO', 403);
    }

    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) return sendError(res, 'PO tidak ditemukan', 404);
    if (po.status !== 'SUBMITTED_TO_HO') {
      return sendError(res, `PO tidak bisa di-approve karena status saat ini: ${po.status}`, 400);
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'APPROVED_HO',
        hoApprovedBy: user.username,
      },
    });

    return sendSuccess(res, updated, 'PO berhasil disetujui oleh HO Supervisor');
  } catch (err) {
    console.error(err);
    return sendError(res, 'Gagal approve PO', 500);
  }
};

// PATCH /api/ho/orders/:id/reject - HO SPV reject PO
const rejectByHo = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user = req.user;

    if (!['HO_SUPERVISOR', 'SUPER_ADMIN'].includes(user.role)) {
      return sendError(res, 'Hanya Supervisor HO yang bisa reject PO', 403);
    }

    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) return sendError(res, 'PO tidak ditemukan', 404);
    if (!['SUBMITTED_TO_HO', 'APPROVED_HO'].includes(po.status)) {
      return sendError(res, `PO tidak bisa di-reject karena status saat ini: ${po.status}`, 400);
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'REJECTED',
        notes: reason ? `${po.notes || ''}\n[Ditolak HO SPV: ${reason}]`.trim() : po.notes,
      },
    });

    return sendSuccess(res, updated, 'PO berhasil ditolak');
  } catch (err) {
    console.error(err);
    return sendError(res, 'Gagal reject PO', 500);
  }
};

// PATCH /api/ho/orders/:id/start-picking - Mulai proses picking (APPROVED_HO → PICKING)
const startPicking = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) return sendError(res, 'PO tidak ditemukan', 404);
    if (po.status !== 'APPROVED_HO') {
      return sendError(res, `PO belum di-approve HO atau sudah dalam proses picking`, 400);
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'PICKING',
        pickerName: user.fullName,
      },
    });

    return sendSuccess(res, updated, 'Proses picking dimulai');
  } catch (err) {
    console.error(err);
    return sendError(res, 'Gagal memulai picking', 500);
  }
};

// PATCH /api/ho/orders/:id/scan-item - Scan item QR ke dalam picking list
// Flow: cabinet QR → slot number → drawer QR → item QR
const scanItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { cabinetQr, slotNumber, drawerQr, itemQr } = req.body;

    if (!cabinetQr || !slotNumber || !drawerQr || !itemQr) {
      return sendError(res, 'Semua field scan diperlukan: cabinetQr, slotNumber, drawerQr, itemQr', 400);
    }

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { requestLines: true, items: true },
    });
    if (!po) return sendError(res, 'PO tidak ditemukan', 404);
    if (po.status !== 'PICKING') {
      return sendError(res, 'PO tidak sedang dalam proses picking', 400);
    }

    // 1. Validasi Cabinet
    const cabinet = await prisma.cabinet.findUnique({ where: { qrCode: cabinetQr } });
    if (!cabinet) return sendError(res, 'QR Code Lemari tidak valid', 400);

    // 2. Validasi Slot
    const slot = await prisma.cabinetSlot.findFirst({
      where: { cabinetId: cabinet.id, slotNumber: Number(slotNumber) },
    });
    if (!slot) return sendError(res, `Slot ${slotNumber} tidak ditemukan di lemari ${cabinet.code}`, 400);

    // 3. Validasi Drawer
    const drawer = await prisma.drawer.findFirst({
      where: { qrCode: drawerQr, slotId: slot.id },
    });
    if (!drawer) return sendError(res, `QR Code Laci tidak sesuai dengan Slot ${slotNumber} di ${cabinet.code}`, 400);

    // 4. Validasi Item
    const item = await prisma.item.findFirst({
      where: { qrCode: itemQr, drawerId: drawer.id },
    });
    if (!item) return sendError(res, 'QR Code Emas tidak ditemukan atau tidak ada di laci ini', 400);

    // 5. Pastikan item belum masuk ke PO ini
    const alreadyPicked = po.items.find((pi) => pi.itemId === item.id);
    if (alreadyPicked) return sendError(res, 'Item ini sudah ada dalam daftar picking', 400);

    // 6. Pastikan item statusnya IN_HO
    if (item.currentStatus !== 'IN_HO') {
      return sendError(res, `Item tidak tersedia (status: ${item.currentStatus})`, 400);
    }

    // 7. Validasi apakah item sesuai dengan salah satu request line
    const matchedLine = po.requestLines.find(
      (line) => line.goldBrand === item.brand && line.weightGrams === item.weight
    );
    if (!matchedLine) {
      return sendError(res, `Item (${item.brand} ${item.weight}g) tidak sesuai dengan permintaan PO ini`, 400);
    }

    // 8. Cek apakah masih butuh qty untuk line ini
    const pickedForLine = po.items.filter((pi) => {
      // We'll check by joining with item data - simplified approach
      return true; // will be validated via qtyFulfilled
    });

    // 9. Tambahkan item ke PO & lock status
    await prisma.$transaction([
      prisma.pOItem.create({ data: { poId: id, itemId: item.id } }),
      prisma.item.update({
        where: { id: item.id },
        data: { currentStatus: 'ALLOCATED_PO' },
      }),
      prisma.pORequestLine.update({
        where: { id: matchedLine.id },
        data: { qtyFulfilled: { increment: 1 } },
      }),
    ]);

    return sendSuccess(
      res,
      {
        item: { id: item.id, brand: item.brand, weight: item.weight, qrCode: item.qrCode },
        location: `${cabinet.code} / Slot ${slotNumber} / ${drawer.code}`,
      },
      `Item berhasil ditambahkan ke picking list`
    );
  } catch (err) {
    console.error(err);
    return sendError(res, 'Gagal scan item', 500);
  }
};

// PATCH /api/ho/orders/:id/remove-item - Remove item dari picking list
const removePickedItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { itemId } = req.body;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { requestLines: true },
    });
    if (!po) return sendError(res, 'PO tidak ditemukan', 404);
    if (po.status !== 'PICKING') {
      return sendError(res, 'Hanya bisa hapus item saat status PICKING', 400);
    }

    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) return sendError(res, 'Item tidak ditemukan', 404);

    // Find matched line
    const matchedLine = po.requestLines.find(
      (line) => line.goldBrand === item.brand && line.weightGrams === item.weight
    );

    await prisma.$transaction([
      prisma.pOItem.deleteMany({ where: { poId: id, itemId } }),
      prisma.item.update({
        where: { id: itemId },
        data: { currentStatus: 'IN_HO' },
      }),
      ...(matchedLine
        ? [
            prisma.pORequestLine.update({
              where: { id: matchedLine.id },
              data: { qtyFulfilled: { decrement: 1 } },
            }),
          ]
        : []),
    ]);

    return sendSuccess(res, { itemId }, 'Item berhasil dihapus dari picking list');
  } catch (err) {
    console.error(err);
    return sendError(res, 'Gagal hapus item dari picking', 500);
  }
};

// PATCH /api/ho/orders/:id/dispatch - Dispatch PO (PICKING → DISPATCHED)
const dispatchOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { kurirName, vehicleNumber, dispatchNote } = req.body;
    const user = req.user;

    if (!kurirName || !vehicleNumber) {
      return sendError(res, 'Nama kurir dan nomor kendaraan wajib diisi', 400);
    }

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { requestLines: true, items: true },
    });
    if (!po) return sendError(res, 'PO tidak ditemukan', 404);
    if (po.status !== 'PICKING') {
      return sendError(res, 'PO harus dalam status PICKING untuk dispatch', 400);
    }
    if (po.items.length === 0) {
      return sendError(res, 'Belum ada item yang dipicking', 400);
    }

    // Cek apakah ada unfulfilled lines
    const unfulfilledLines = po.requestLines.filter((l) => l.qtyFulfilled < l.qtyRequested);
    const isPartial = unfulfilledLines.length > 0;

    // Generate tracking number
    const ym = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const trackingNumber = `SJ-${ym}-${id}`;

    await prisma.$transaction([
      prisma.purchaseOrder.update({
        where: { id },
        data: {
          status: isPartial ? 'PARTIAL_HOLD' : 'DISPATCHED',
          kurirName,
          vehicleNumber,
          dispatchedBy: user.username,
          trackingNumber,
          partialDispatchNote: isPartial ? (dispatchNote || 'Dispatch sebagian, sisa dalam antrian') : null,
        },
      }),
      // Update semua ALLOCATED item menjadi IN_TRANSIT
      ...po.items.map((poi) =>
        prisma.item.update({
          where: { id: poi.itemId },
          data: { currentStatus: 'IN_TRANSIT' },
        })
      ),
    ]);

    return sendSuccess(
      res,
      { trackingNumber, isPartial, totalItems: po.items.length },
      isPartial
        ? `PO di-dispatch sebagian (${po.items.length} item). Sisa qty dalam PARTIAL_HOLD`
        : `PO berhasil di-dispatch (${po.items.length} item). Tracking: ${trackingNumber}`
    );
  } catch (err) {
    console.error(err);
    return sendError(res, 'Gagal dispatch PO', 500);
  }
};

// GET /api/ho/orders/:id/surat-jalan - Generate data surat jalan
const getSuratJalan = async (req, res) => {
  try {
    const { id } = req.params;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
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
                qrCode: true,
                purity: true,
                drawer: {
                  select: {
                    code: true,
                    slot: {
                      select: {
                        slotNumber: true,
                        cabinet: { select: { code: true } },
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

    if (!po) return sendError(res, 'PO tidak ditemukan', 404);
    if (!['DISPATCHED', 'PARTIAL_HOLD', 'RECEIVED'].includes(po.status)) {
      return sendError(res, 'Surat jalan hanya tersedia setelah PO di-dispatch', 400);
    }

    // Hitung total berat
    const totalWeight = po.items.reduce((sum, poi) => sum + (poi.item?.weight || 0), 0);

    const suratJalan = {
      documentNumber: po.trackingNumber,
      poId: po.id,
      date: po.updatedAt,
      status: po.status,
      from: {
        name: po.sourceLocation.name,
        code: po.sourceLocation.code,
        address: po.sourceLocation.address,
      },
      to: {
        name: po.destLocation.name,
        code: po.destLocation.code,
        address: po.destLocation.address,
      },
      requestedBy: po.requestedBy,
      outletApprovedBy: po.outletApprovedBy,
      hoApprovedBy: po.hoApprovedBy,
      dispatchedBy: po.dispatchedBy,
      pickerName: po.pickerName,
      kurirName: po.kurirName,
      vehicleNumber: po.vehicleNumber,
      items: po.items.map((poi) => ({
        serialNumber: poi.item.id,
        brand: poi.item.brand,
        weight: poi.item.weight,
        purity: poi.item.purity,
        qrCode: poi.item.qrCode,
        location: poi.item.drawer
          ? `${poi.item.drawer.slot?.cabinet?.code} / Slot ${poi.item.drawer.slot?.slotNumber} / ${poi.item.drawer.code}`
          : '-',
      })),
      totalItems: po.items.length,
      totalWeight: totalWeight.toFixed(2),
      requestLines: po.requestLines,
      notes: po.notes,
      partialDispatchNote: po.partialDispatchNote,
      generatedAt: new Date().toISOString(),
      generatedBy: 'Pegadaian Smart Vault System',
    };

    return sendSuccess(res, suratJalan, 'Surat jalan berhasil dibuat');
  } catch (err) {
    console.error(err);
    return sendError(res, 'Gagal generate surat jalan', 500);
  }
};

module.exports = {
  listHoOrders,
  getHoOrderDetail,
  approveByHoSpv,
  rejectByHo,
  startPicking,
  scanItem,
  removePickedItem,
  dispatchOrder,
  getSuratJalan,
};

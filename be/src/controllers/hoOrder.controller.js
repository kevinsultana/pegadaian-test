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

// Helper: Analisis ketersediaan stok fisik di HO untuk requestLines
async function analyzeStockForLines(requestLines) {
  const linesWithStock = await Promise.all(
    (requestLines || []).map(async (line) => {
      const availableItems = await prisma.item.findMany({
        where: {
          currentStatus: 'IN_HO',
          weight: Number(line.weightGrams),
          drawerId: { not: null },
          OR: [
            { brand: { equals: line.goldBrand, mode: 'insensitive' } },
            { brand: { contains: line.goldBrand, mode: 'insensitive' } },
          ],
        },
        select: { id: true, brand: true, weight: true },
      });

      const availableStock = availableItems.length;
      const shortage = Math.max(0, line.qtyRequested - availableStock);
      let stockStatus = 'FULL';
      if (availableStock === 0) stockStatus = 'EMPTY';
      else if (availableStock < line.qtyRequested) stockStatus = 'PARTIAL';

      return {
        ...line,
        availableStock,
        shortage,
        stockStatus, // 'FULL' | 'PARTIAL' | 'EMPTY'
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

  return { linesWithStock, overallStockStatus };
}

// GET /api/ho/orders/:id - Detail PO dengan Analisis Stok HO & Panduan Lokasi
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
          select: {
            id: true,
            itemId: true,
            isPicked: true,
            pickedAt: true,
            item: {
              select: {
                id: true,
                brand: true,
                weight: true,
                qrCode: true,
                purity: true,
                currentStatus: true,
                createdAt: true,
                drawerId: true,
                drawer: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    qrCode: true,
                    slot: {
                      select: {
                        id: true,
                        slotNumber: true,
                        qrCode: true,
                        modularType: true,
                        cabinet: {
                          select: {
                            id: true,
                            code: true,
                            name: true,
                            qrCode: true,
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
      },
    });

    if (!po) return sendError(res, 'PO tidak ditemukan', 404);

    const { linesWithStock, overallStockStatus } = await analyzeStockForLines(po.requestLines);

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

// GET /api/ho/orders/:id/check-stock - Cek status ketersediaan stok fisik HO
const checkStock = async (req, res) => {
  try {
    const { id } = req.params;
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { requestLines: true },
    });
    if (!po) return sendError(res, 'PO tidak ditemukan', 404);

    const { linesWithStock, overallStockStatus } = await analyzeStockForLines(po.requestLines);

    return sendSuccess(
      res,
      {
        poId: id,
        overallStockStatus, // 'ALL_AVAILABLE' | 'PARTIALLY_AVAILABLE' | 'OUT_OF_STOCK'
        requestLines: linesWithStock,
      },
      'Pengecekan stok fisik HO berhasil'
    );
  } catch (err) {
    console.error(err);
    return sendError(res, 'Gagal mengecek stok HO', 500);
  }
};

// GET /api/ho/orders/:id/available-items - Mengambil daftar item fisik di HO untuk dipilih oleh SPV (dengan rekomendasi FIFO)
const getAvailableItemsForPo = async (req, res) => {
  try {
    const { id } = req.params;
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { requestLines: true },
    });
    if (!po) return sendError(res, 'PO tidak ditemukan', 404);

    const linesWithItems = await Promise.all(
      (po.requestLines || []).map(async (line) => {
        const items = await prisma.item.findMany({
          where: {
            currentStatus: 'IN_HO',
            weight: Number(line.weightGrams),
            drawerId: { not: null },
            OR: [
              { brand: { equals: line.goldBrand, mode: 'insensitive' } },
              { brand: { contains: line.goldBrand, mode: 'insensitive' } },
            ],
          },
          include: {
            drawer: {
              select: {
                id: true,
                code: true,
                name: true,
                qrCode: true,
                slot: {
                  select: {
                    id: true,
                    slotNumber: true,
                    qrCode: true,
                    modularType: true,
                    cabinet: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                        qrCode: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' }, // FIFO: Barang tertua / masuk pertama berada di posisi teratas
        });

        const itemsWithFifo = items.map((item, idx) => ({
          id: item.id,
          brand: item.brand,
          weight: item.weight,
          purity: item.purity,
          qrCode: item.qrCode,
          inboundDate: item.createdAt,
          location: {
            cabinetCode: item.drawer?.slot?.cabinet?.code,
            cabinetQr: item.drawer?.slot?.cabinet?.qrCode,
            slotNumber: item.drawer?.slot?.slotNumber,
            slotQr: item.drawer?.slot?.qrCode,
            drawerCode: item.drawer?.code,
            drawerQr: item.drawer?.qrCode,
            display: `${item.drawer?.slot?.cabinet?.code} • Slot ${item.drawer?.slot?.slotNumber} • ${item.drawer?.code}`,
          },
          isFifoRecommended: idx < line.qtyRequested,
          fifoRank: idx + 1,
        }));

        return {
          requestLineId: line.id,
          goldBrand: line.goldBrand,
          weightGrams: line.weightGrams,
          qtyRequested: line.qtyRequested,
          availableCount: items.length,
          shortage: Math.max(0, line.qtyRequested - items.length),
          items: itemsWithFifo,
        };
      })
    );

    return sendSuccess(res, { poId: id, requestLines: linesWithItems }, 'Daftar item fisik tersedia di HO berhasil diambil');
  } catch (err) {
    console.error(err);
    return sendError(res, 'Gagal mengambil daftar item ketersediaan HO', 500);
  }
};

// PATCH /api/ho/orders/:id/approve - HO SPV approve dengan alokasi item fisik (FIFO / Pilihan SPV)
const approveByHoSpv = async (req, res) => {
  try {
    const { id } = req.params;
    const { isPartial, approvedLines, note, selectedItemIds } = req.body;
    const user = req.user;

    if (!['HO_SUPERVISOR', 'SUPER_ADMIN'].includes(user.role)) {
      return sendError(res, 'Hanya Supervisor HO yang bisa approve PO', 403);
    }

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { requestLines: true },
    });
    if (!po) return sendError(res, 'PO tidak ditemukan', 404);
    if (!['SUBMITTED_TO_HO', 'WAITING_RESTOCK'].includes(po.status)) {
      return sendError(res, `PO tidak bisa di-approve karena status saat ini: ${po.status}`, 400);
    }

    // 1. Cek ketersediaan stok fisik di HO
    const { linesWithStock, overallStockStatus } = await analyzeStockForLines(po.requestLines);

    if (overallStockStatus === 'OUT_OF_STOCK') {
      return sendError(
        res,
        'Tidak dapat menyetujui PO: Stok seluruh emas yang diminta saat ini KOSONG di Vault HO. Silakan pilih opsi "Tahan (Menunggu Restock)" atau "Tolak PO".',
        400
      );
    }

    if (overallStockStatus === 'PARTIALLY_AVAILABLE' && !isPartial) {
      return sendError(
        res,
        'Stok di HO hanya tersedia SEBAGIAN. Silakan pilih opsi "Setujui Parsial" (kirim stok yang ada terlebih dahulu) atau "Tahan (Menunggu Restock)".',
        400
      );
    }

    // 2. Kumpulkan item-item yang akan dialokasikan ke PO
    let allocatedItems = [];

    if (selectedItemIds && Array.isArray(selectedItemIds) && selectedItemIds.length > 0) {
      // Supervisor memilih item secara manual
      allocatedItems = await prisma.item.findMany({
        where: {
          id: { in: selectedItemIds },
          currentStatus: 'IN_HO',
          drawerId: { not: null },
        },
      });

      if (allocatedItems.length !== selectedItemIds.length) {
        return sendError(res, 'Beberapa item yang dipilih tidak tersedia atau sudah dialokasikan ke PO lain', 400);
      }
    } else {
      // Otomatis pilih item berdasarkan urutan FIFO (First In First Out: createdAt ASC)
      for (const line of linesWithStock) {
        let approvedQty = line.qtyRequested;
        if (isPartial) {
          const customApproved = approvedLines?.find((al) => al.id === line.id)?.qtyApproved;
          approvedQty = customApproved !== undefined
            ? Math.min(Number(customApproved), line.availableStock)
            : Math.min(line.qtyRequested, line.availableStock);
        }

        if (approvedQty > 0) {
          const fifoItems = await prisma.item.findMany({
            where: {
              currentStatus: 'IN_HO',
              weight: Number(line.weightGrams),
              drawerId: { not: null },
              OR: [
                { brand: { equals: line.goldBrand, mode: 'insensitive' } },
                { brand: { contains: line.goldBrand, mode: 'insensitive' } },
              ],
            },
            orderBy: { createdAt: 'asc' }, // FIFO: Barang tertua diambil pertama
            take: approvedQty,
          });
          allocatedItems.push(...fifoItems);
        }
      }
    }

    // 3. Set kuantitas yang disetujui (qtyApproved) untuk masing-masing baris
    const transactions = [];

    for (const line of linesWithStock) {
      // Hitung berapa item yang terpilih untuk line ini
      const itemsForThisLine = allocatedItems.filter((item) => {
        const brandMatch =
          line.goldBrand.toUpperCase() === item.brand.toUpperCase() ||
          item.brand.toUpperCase().includes(line.goldBrand.toUpperCase()) ||
          line.goldBrand.toUpperCase().includes(item.brand.toUpperCase());
        return brandMatch && Number(line.weightGrams) === Number(item.weight);
      });

      const approvedQty = itemsForThisLine.length;

      transactions.push(
        prisma.pORequestLine.update({
          where: { id: line.id },
          data: { qtyApproved: approvedQty },
        })
      );
    }

    // 4. Hubungkan item terpilih ke POItem dengan isPicked = false dan kunci status Item
    // Hapus alokasi lama jika ada
    transactions.push(
      prisma.pOItem.deleteMany({ where: { poId: id } })
    );

    for (const item of allocatedItems) {
      transactions.push(
        prisma.pOItem.create({
          data: {
            poId: id,
            itemId: item.id,
            isPicked: false,
          },
        })
      );
      transactions.push(
        prisma.item.update({
          where: { id: item.id },
          data: { currentStatus: 'ALLOCATED_PO' },
        })
      );
    }

    const hoNoteText = note
      ? note
      : isPartial
      ? `Disetujui sebagian (${allocatedItems.length} keping dialokasikan FIFO). Sisa akan diproses setelah restock HO.`
      : `Disetujui penuh oleh HO Supervisor (${allocatedItems.length} keping dialokasikan FIFO).`;

    transactions.push(
      prisma.purchaseOrder.update({
        where: { id },
        data: {
          status: 'APPROVED_HO',
          hoApprovedBy: user.username,
          hoNote: hoNoteText,
        },
      })
    );

    await prisma.$transaction(transactions);

    const updated = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        requestLines: true,
        items: {
          include: {
            item: {
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
        },
      },
    });

    return sendSuccess(
      res,
      updated,
      isPartial
        ? `PO disetujui sebagian (${allocatedItems.length} item dialokasikan). Siap untuk picking.`
        : `PO berhasil disetujui (${allocatedItems.length} item dialokasikan). Siap untuk picking.`
    );
  } catch (err) {
    console.error(err);
    return sendError(res, 'Gagal approve PO', 500);
  }
};

// PATCH /api/ho/orders/:id/hold-restock - Tahan PO karena stok belum lengkap (Mitigasi Restock)
const holdForRestock = async (req, res) => {
  try {
    const { id } = req.params;
    const { note, estimatedDate } = req.body;
    const user = req.user;

    if (!['HO_SUPERVISOR', 'SUPER_ADMIN'].includes(user.role)) {
      return sendError(res, 'Hanya Supervisor HO yang bisa menahan PO', 403);
    }

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { requestLines: true },
    });
    if (!po) return sendError(res, 'PO tidak ditemukan', 404);
    if (!['SUBMITTED_TO_HO', 'WAITING_RESTOCK'].includes(po.status)) {
      return sendError(res, `PO tidak bisa ditahan karena status saat ini: ${po.status}`, 400);
    }

    const defaultNote = `Stok emas di HO sedang menunggu pengadaan / inbound fisik.${
      estimatedDate ? ` Estimasi ketersediaan: ${estimatedDate}.` : ''
    }`;

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'WAITING_RESTOCK',
        hoApprovedBy: user.username,
        hoNote: note || defaultNote,
      },
    });

    return sendSuccess(
      res,
      updated,
      'PO berhasil ditahan dengan status Menunggu Restock HO. Outlet telah diinformasikan.'
    );
  } catch (err) {
    console.error(err);
    return sendError(res, 'Gagal menahan PO', 500);
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

// Helper parsing QR code inputs for robust picking matching
const parseSlotNumber = (slotInput) => {
  if (slotInput === null || slotInput === undefined) return null;
  const s = String(slotInput).trim();
  const m1 = s.match(/SLOT-?\s*0*(\d+)/i);
  if (m1) return parseInt(m1[1], 10);
  const m2 = s.match(/SL-?\s*0*(\d+)/i);
  if (m2) return parseInt(m2[1], 10);
  const m3 = s.match(/slot\s*0*(\d+)/i);
  if (m3) return parseInt(m3[1], 10);
  const m4 = s.match(/^0*(\d+)$/);
  if (m4) return parseInt(m4[1], 10);
  return null;
};

const cleanCabinetCode = (cabInput) => {
  if (!cabInput) return '';
  return String(cabInput).replace(/^PGD-HO-CAB:/i, '').trim();
};

const cleanDrawerCode = (drwInput) => {
  if (!drwInput) return '';
  return String(drwInput).replace(/^PGD-HO-DRW:/i, '').trim();
};

const cleanItemCode = (itemInput) => {
  if (!itemInput) return '';
  const s = String(itemInput).trim();
  if (s.startsWith('PGD-HO-GOLD:')) {
    const parts = s.replace(/^PGD-HO-GOLD:/i, '').split('|');
    return parts[0] || s;
  }
  return s;
};

// PATCH /api/ho/orders/:id/scan-item - Scan item QR ke dalam picking list
// Flow: cabinet QR → slot QR → drawer QR → item QR
const scanItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { cabinetQr, slotQr, slotNumber, drawerQr, itemQr, targetItemId } = req.body;

    const slotCode = (slotQr || slotNumber || '').toString().trim();
    if (!cabinetQr || !slotCode || !drawerQr || !itemQr) {
      return sendError(res, 'Semua parameter diperlukan: cabinetQr, slotQr (atau slotNumber), drawerQr, itemQr', 400);
    }

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        requestLines: true,
        items: {
          include: {
            item: {
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
        },
      },
    });
    if (!po) return sendError(res, 'PO tidak ditemukan', 404);
    if (po.status !== 'PICKING') {
      return sendError(res, 'PO tidak sedang dalam proses picking', 400);
    }

    // Identifikasi target keping emas yang sedang dipicking
    let targetPoItem = null;
    if (targetItemId) {
      targetPoItem = po.items.find((pi) => pi.itemId === targetItemId);
    }
    if (!targetPoItem) {
      targetPoItem = po.items.find((pi) => !pi.isPicked) || po.items[0];
    }
    const targetItemObj = targetPoItem?.item;
    const targetDrawerObj = targetItemObj?.drawer;
    const targetSlotObj = targetDrawerObj?.slot;
    const targetCabinetObj = targetSlotObj?.cabinet;

    // 1. Validasi Cabinet
    const cleanedCab = cleanCabinetCode(cabinetQr);
    const cabinet = await prisma.cabinet.findFirst({
      where: {
        OR: [
          { qrCode: cabinetQr },
          { code: cabinetQr },
          { code: cleanedCab },
          { qrCode: cleanedCab },
        ],
      },
    });
    if (!cabinet) return sendError(res, 'QR Code Lemari tidak valid', 400);

    if (targetCabinetObj && cabinet.id !== targetCabinetObj.id) {
      return sendError(
        res,
        `Salah tempat, bukan di sini ya! Emas target (${targetItemObj.brand} ${targetItemObj.weight}g) berada di ${targetCabinetObj.name} (${targetCabinetObj.code}), bukan di ${cabinet.name} (${cabinet.code}). Silakan pindah ke lemari yang benar.`,
        400
      );
    }

    // 2. Validasi Slot (Mendukung slotQr misal "QR-HO-CAB-01-SLOT-07" atau angka nomor slot 7)
    const parsedNum = parseSlotNumber(slotCode);
    const slot = await prisma.cabinetSlot.findFirst({
      where: {
        cabinetId: cabinet.id,
        OR: [
          { qrCode: slotCode },
          ...(parsedNum ? [
            { slotNumber: parsedNum },
            { qrCode: `QR-${cabinet.code}-SLOT-${String(parsedNum).padStart(2, '0')}` },
            { qrCode: `QR-${cabinet.code}-SL${String(parsedNum).padStart(2, '0')}` },
          ] : []),
        ],
      },
    });
    if (!slot) return sendError(res, `Slot (${slotCode}) tidak ditemukan di lemari ${cabinet.code}`, 400);

    if (targetSlotObj && slot.slotNumber !== targetSlotObj.slotNumber) {
      return sendError(
        res,
        `Salah tempat, bukan di sini ya! Emas target berada di Slot ${targetSlotObj.slotNumber}, bukan di Slot ${slot.slotNumber}. Silakan pindah ke Slot ${targetSlotObj.slotNumber}.`,
        400
      );
    }

    // 3. Validasi Drawer
    const cleanedDrw = cleanDrawerCode(drawerQr);
    const drawer = await prisma.drawer.findFirst({
      where: {
        OR: [
          { qrCode: drawerQr },
          { code: drawerQr },
          { code: cleanedDrw },
          { qrCode: cleanedDrw },
        ],
        slotId: slot.id,
      },
    });
    if (!drawer) return sendError(res, `QR Code Laci tidak sesuai dengan Slot ${slot.slotNumber} di ${cabinet.code}`, 400);

    if (targetDrawerObj && drawer.id !== targetDrawerObj.id) {
      return sendError(
        res,
        `Salah tempat, bukan di sini ya! Emas target berada di Laci ${targetDrawerObj.name || targetDrawerObj.code}, bukan di ${drawer.name || drawer.code}. Silakan buka laci yang benar.`,
        400
      );
    }

    // 4. Validasi Item
    const cleanedItm = cleanItemCode(itemQr);
    const item = await prisma.item.findFirst({
      where: {
        OR: [
          { qrCode: itemQr },
          { id: itemQr },
          { id: cleanedItm },
          { qrCode: cleanedItm },
        ],
        drawerId: drawer.id,
      },
    });
    if (!item) return sendError(res, 'QR Code / Serial Emas tidak ditemukan atau tidak ada di laci ini', 400);

    if (targetItemObj && item.id !== targetItemObj.id) {
      return sendError(
        res,
        `Salah keping emas, bukan ini ya! Anda memindai emas ${item.brand} ${item.weight}g (SN: ${item.id}). Target yang harus diambil adalah ${targetItemObj.brand} ${targetItemObj.weight}g (SN: ${targetItemObj.id}).`,
        400
      );
    }

    // 5. Cek apakah item ini sudah pernah di-pick dalam PO
    const existingPoItem = po.items.find((pi) => pi.itemId === item.id);
    if (existingPoItem && existingPoItem.isPicked) {
      return sendError(res, 'Item ini sudah berhasil dipicking sebelumnya', 400);
    }

    // 6. Validasi status item (bisa ALLOCATED_PO jika dialokasikan saat approval, atau IN_HO)
    if (!['IN_HO', 'ALLOCATED_PO'].includes(item.currentStatus)) {
      return sendError(res, `Item tidak tersedia untuk picking (status saat ini: ${item.currentStatus})`, 400);
    }

    // 7. Validasi apakah item sesuai dengan salah satu request line
    const matchedLine = po.requestLines.find((line) => {
      const brandMatch =
        line.goldBrand.toUpperCase() === item.brand.toUpperCase() ||
        item.brand.toUpperCase().includes(line.goldBrand.toUpperCase()) ||
        line.goldBrand.toUpperCase().includes(item.brand.toUpperCase());
      return brandMatch && Number(line.weightGrams) === Number(item.weight);
    });
    if (!matchedLine) {
      return sendError(res, `Item (${item.brand} ${item.weight}g) tidak sesuai dengan spesifikasi permintaan PO ini`, 400);
    }

    // 8. Cek batas kuantitas
    const maxQty = matchedLine.qtyApproved ?? matchedLine.qtyRequested;
    if (matchedLine.qtyFulfilled >= maxQty) {
      return sendError(res, `Permintaan untuk ${matchedLine.goldBrand} ${matchedLine.weightGrams}g sudah mencapai batas disetujui (${matchedLine.qtyFulfilled}/${maxQty})`, 400);
    }

    // 9. Update / Create POItem dan tandai isPicked = true
    const transactions = [];

    if (existingPoItem) {
      transactions.push(
        prisma.pOItem.update({
          where: { id: existingPoItem.id },
          data: { isPicked: true, pickedAt: new Date() },
        })
      );
    } else {
      transactions.push(
        prisma.pOItem.create({
          data: { poId: id, itemId: item.id, isPicked: true, pickedAt: new Date() },
        })
      );
    }

    transactions.push(
      prisma.item.update({
        where: { id: item.id },
        data: { currentStatus: 'ALLOCATED_PO' },
      }),
      prisma.pORequestLine.update({
        where: { id: matchedLine.id },
        data: { qtyFulfilled: { increment: 1 } },
      })
    );

    await prisma.$transaction(transactions);

    return sendSuccess(
      res,
      {
        item: { id: item.id, brand: item.brand, weight: item.weight, qrCode: item.qrCode },
        location: `${cabinet.code} / Slot ${slot.slotNumber} / ${drawer.code}`,
      },
      `Item ${item.brand} ${item.weight}g berhasil dipicking`
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
    const matchedLine = po.requestLines.find((line) => {
      const brandMatch =
        line.goldBrand.toUpperCase() === item.brand.toUpperCase() ||
        item.brand.toUpperCase().includes(line.goldBrand.toUpperCase()) ||
        line.goldBrand.toUpperCase().includes(item.brand.toUpperCase());
      return brandMatch && Number(line.weightGrams) === Number(item.weight);
    });

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

// POST /api/ho/orders/:id/verify-step - Verifikasi langkah scan picking
const verifyPickingStep = async (req, res) => {
  try {
    const { id } = req.params;
    const { step, cabinetQr, slotNumber, drawerQr, itemQr, targetItemId } = req.body;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        requestLines: true,
        items: {
          include: {
            item: {
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
        },
      },
    });
    if (!po) return sendError(res, 'PO tidak ditemukan', 404);
    if (po.status !== 'PICKING') {
      return sendError(res, 'PO tidak sedang dalam proses picking', 400);
    }

    // Identifikasi target keping emas yang sedang dipicking
    let targetPoItem = null;
    if (targetItemId) {
      targetPoItem = po.items.find((pi) => pi.itemId === targetItemId);
    }
    if (!targetPoItem) {
      targetPoItem = po.items.find((pi) => !pi.isPicked) || po.items[0];
    }
    const targetItemObj = targetPoItem?.item;
    const targetDrawerObj = targetItemObj?.drawer;
    const targetSlotObj = targetDrawerObj?.slot;
    const targetCabinetObj = targetSlotObj?.cabinet;

    if (step === 'cabinet') {
      if (!cabinetQr) return sendError(res, 'QR Code Lemari diperlukan', 400);
      const cleanedCab = cleanCabinetCode(cabinetQr);
      const cabinet = await prisma.cabinet.findFirst({
        where: {
          OR: [
            { qrCode: cabinetQr },
            { code: cabinetQr },
            { code: cleanedCab },
            { qrCode: cleanedCab },
          ],
        },
        include: { location: { select: { name: true, code: true } } },
      });
      if (!cabinet) return sendError(res, `QR Code Lemari (${cabinetQr}) tidak ditemukan di database HO`, 404);

      // Validasi lokasi fisik target item
      if (targetCabinetObj && cabinet.id !== targetCabinetObj.id) {
        return sendError(
          res,
          `Salah tempat, bukan di sini ya! Emas target (${targetItemObj.brand} ${targetItemObj.weight}g) berada di ${targetCabinetObj.name} (${targetCabinetObj.code}), bukan di ${cabinet.name} (${cabinet.code}). Silakan pindah ke lemari yang benar.`,
          400
        );
      }

      return sendSuccess(res, {
        valid: true,
        step: 'cabinet',
        locationName: `${cabinet.name} (${cabinet.code})`,
        details: `Lokasi: ${cabinet.location?.name || 'Vault HO'} • Kapasitas: ${cabinet.totalSlots} Slot`,
        cabinet: { id: cabinet.id, code: cabinet.code, name: cabinet.name, qrCode: cabinet.qrCode },
      }, `Lemari ${cabinet.code} terverifikasi`);
    }

    const slotCode = (req.body.slotQr || req.body.slotNumber || '').toString().trim();
    const parsedSlotNum = parseSlotNumber(slotCode);

    if (step === 'slot') {
      if (!cabinetQr || !slotCode) return sendError(res, 'QR Code Lemari dan QR Code Slot diperlukan', 400);
      const cleanedCab = cleanCabinetCode(cabinetQr);
      const cabinet = await prisma.cabinet.findFirst({
        where: {
          OR: [
            { qrCode: cabinetQr },
            { code: cabinetQr },
            { code: cleanedCab },
            { qrCode: cleanedCab },
          ],
        },
      });
      if (!cabinet) return sendError(res, 'Lemari tidak valid', 404);

      const slot = await prisma.cabinetSlot.findFirst({
        where: {
          cabinetId: cabinet.id,
          OR: [
            { qrCode: slotCode },
            ...(parsedSlotNum ? [
              { slotNumber: parsedSlotNum },
              { qrCode: `QR-${cabinet.code}-SLOT-${String(parsedSlotNum).padStart(2, '0')}` },
              { qrCode: `QR-${cabinet.code}-SL${String(parsedSlotNum).padStart(2, '0')}` },
            ] : []),
          ],
        },
        include: { drawers: true },
      });
      if (!slot) return sendError(res, `QR Code Slot (${slotCode}) tidak ditemukan pada lemari ${cabinet.code}`, 404);

      // Validasi lokasi slot target item
      if (targetSlotObj && slot.slotNumber !== targetSlotObj.slotNumber) {
        return sendError(
          res,
          `Salah tempat, bukan di sini ya! Emas target berada di Slot ${targetSlotObj.slotNumber}, bukan di Slot ${slot.slotNumber}. Silakan pindah ke Slot ${targetSlotObj.slotNumber}.`,
          400
        );
      }

      const slotType = slot.modularType === 'BIG_DRAWER' ? 'Laci Besar (1 Unit)' : 'Klaster Laci Kecil (8 Unit)';
      return sendSuccess(res, {
        valid: true,
        step: 'slot',
        slotNumber: slot.slotNumber,
        slotQr: slot.qrCode,
        locationName: `Slot ${slot.slotNumber} - ${cabinet.code}`,
        details: `Tipe: ${slotType} • QR: ${slot.qrCode || '-'} • Tersedia: ${slot.drawers.length} laci`,
        slot: { id: slot.id, slotNumber: slot.slotNumber, qrCode: slot.qrCode, modularType: slot.modularType },
      }, `Slot ${slot.slotNumber} (${slot.qrCode}) terverifikasi`);
    }

    if (step === 'drawer') {
      if (!cabinetQr || !slotCode || !drawerQr) return sendError(res, 'Data lemari, slot, dan QR laci diperlukan', 400);
      const cleanedCab = cleanCabinetCode(cabinetQr);
      const cabinet = await prisma.cabinet.findFirst({
        where: {
          OR: [
            { qrCode: cabinetQr },
            { code: cabinetQr },
            { code: cleanedCab },
            { qrCode: cleanedCab },
          ],
        },
      });
      if (!cabinet) return sendError(res, 'Lemari tidak valid', 404);

      const slot = await prisma.cabinetSlot.findFirst({
        where: {
          cabinetId: cabinet.id,
          OR: [
            { qrCode: slotCode },
            ...(parsedSlotNum ? [
              { slotNumber: parsedSlotNum },
              { qrCode: `QR-${cabinet.code}-SLOT-${String(parsedSlotNum).padStart(2, '0')}` },
              { qrCode: `QR-${cabinet.code}-SL${String(parsedSlotNum).padStart(2, '0')}` },
            ] : []),
          ],
        },
      });
      if (!slot) return sendError(res, `Slot (${slotCode}) tidak valid`, 404);

      const cleanedDrw = cleanDrawerCode(drawerQr);
      const drawer = await prisma.drawer.findFirst({
        where: {
          OR: [
            { qrCode: drawerQr },
            { code: drawerQr },
            { code: cleanedDrw },
            { qrCode: cleanedDrw },
          ],
          slotId: slot.id,
        },
      });
      if (!drawer) return sendError(res, `QR Code Laci (${drawerQr}) tidak sesuai dengan Slot ${slot.slotNumber} pada lemari ${cabinet.code}`, 404);

      // Validasi lokasi laci target item
      if (targetDrawerObj && drawer.id !== targetDrawerObj.id) {
        return sendError(
          res,
          `Salah tempat, bukan di sini ya! Emas target berada di Laci ${targetDrawerObj.name || targetDrawerObj.code}, bukan di ${drawer.name || drawer.code}. Silakan buka laci yang benar.`,
          400
        );
      }

      return sendSuccess(res, {
        valid: true,
        step: 'drawer',
        locationName: `Laci ${drawer.name || drawer.code}`,
        details: `Kode: ${drawer.code} • Kapasitas: ${drawer.capacity} keping (${drawer.category || 'Multi-Brand'})`,
        drawer: { id: drawer.id, code: drawer.code, name: drawer.name, qrCode: drawer.qrCode },
      }, `Laci ${drawer.code} terverifikasi`);
    }

    if (step === 'item') {
      if (!cabinetQr || !slotCode || !drawerQr || !itemQr) return sendError(res, 'Semua parameter diperlukan', 400);
      const cleanedCab = cleanCabinetCode(cabinetQr);
      const cabinet = await prisma.cabinet.findFirst({
        where: {
          OR: [
            { qrCode: cabinetQr },
            { code: cabinetQr },
            { code: cleanedCab },
            { qrCode: cleanedCab },
          ],
        },
      });
      if (!cabinet) return sendError(res, 'Lemari tidak valid', 404);

      const slot = await prisma.cabinetSlot.findFirst({
        where: {
          cabinetId: cabinet.id,
          OR: [
            { qrCode: slotCode },
            ...(parsedSlotNum ? [
              { slotNumber: parsedSlotNum },
              { qrCode: `QR-${cabinet.code}-SLOT-${String(parsedSlotNum).padStart(2, '0')}` },
              { qrCode: `QR-${cabinet.code}-SL${String(parsedSlotNum).padStart(2, '0')}` },
            ] : []),
          ],
        },
      });
      if (!slot) return sendError(res, `Slot (${slotCode}) tidak valid`, 404);

      const cleanedDrw = cleanDrawerCode(drawerQr);
      const drawer = await prisma.drawer.findFirst({
        where: {
          OR: [
            { qrCode: drawerQr },
            { code: drawerQr },
            { code: cleanedDrw },
            { qrCode: cleanedDrw },
          ],
          slotId: slot.id,
        },
      });
      if (!drawer) return sendError(res, 'Laci tidak valid', 404);

      const cleanedItm = cleanItemCode(itemQr);
      const item = await prisma.item.findFirst({
        where: {
          OR: [
            { qrCode: itemQr },
            { id: itemQr },
            { id: cleanedItm },
            { qrCode: cleanedItm },
          ],
          drawerId: drawer.id,
        },
      });
      if (!item) return sendError(res, `QR Code / Serial Emas (${itemQr}) tidak ditemukan di laci ini`, 404);

      // Validasi identitas target item
      if (targetItemObj && item.id !== targetItemObj.id) {
        return sendError(
          res,
          `Salah keping emas, bukan ini ya! Anda memindai emas ${item.brand} ${item.weight}g (SN: ${item.id}). Target yang harus diambil adalah ${targetItemObj.brand} ${targetItemObj.weight}g (SN: ${targetItemObj.id}).`,
          400
        );
      }

      if (!['IN_HO', 'ALLOCATED_PO'].includes(item.currentStatus)) {
        return sendError(res, `Item tidak tersedia untuk picking (Status: ${item.currentStatus})`, 400);
      }
      const alreadyPicked = po.items.find((pi) => pi.itemId === item.id);
      if (alreadyPicked && alreadyPicked.isPicked) {
        return sendError(res, 'Item ini sudah berhasil dipicking sebelumnya di PO ini', 400);
      }
      if (item.currentStatus === 'ALLOCATED_PO' && !alreadyPicked) {
        return sendError(res, 'Item ini telah dialokasikan untuk PO lain', 400);
      }

      const matchedLine = po.requestLines.find((line) => {
        const brandMatch =
          line.goldBrand.toUpperCase() === item.brand.toUpperCase() ||
          item.brand.toUpperCase().includes(line.goldBrand.toUpperCase()) ||
          line.goldBrand.toUpperCase().includes(item.brand.toUpperCase());
        return brandMatch && Number(line.weightGrams) === Number(item.weight);
      });
      if (!matchedLine) {
        return sendError(res, `Item (${item.brand} ${item.weight}g) tidak sesuai dengan spesifikasi permintaan PO`, 400);
      }
      if (matchedLine.qtyFulfilled >= matchedLine.qtyRequested) {
        return sendError(res, `Permintaan ${matchedLine.goldBrand} ${matchedLine.weightGrams}g sudah terpenuhi (${matchedLine.qtyFulfilled}/${matchedLine.qtyRequested})`, 400);
      }

      return sendSuccess(res, {
        valid: true,
        step: 'item',
        locationName: `${item.brand} ${item.weight}g (Serial: ${item.id})`,
        details: `Kemurnian: ${item.purity} • Status: Siap Dipicking`,
        item: { id: item.id, brand: item.brand, weight: item.weight, qrCode: item.qrCode },
      }, `Emas ${item.brand} ${item.weight}g cocok dengan permintaan PO`);
    }

    return sendError(res, 'Step tidak dikenal', 400);
  } catch (err) {
    console.error(err);
    return sendError(res, 'Gagal memverifikasi langkah picking', 500);
  }
};

module.exports = {
  listHoOrders,
  getHoOrderDetail,
  checkStock,
  getAvailableItemsForPo,
  approveByHoSpv,
  holdForRestock,
  rejectByHo,
  startPicking,
  verifyPickingStep,
  scanItem,
  removePickedItem,
  dispatchOrder,
  getSuratJalan,
};

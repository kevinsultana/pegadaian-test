const prisma = require('../config/prisma');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Get PO list that are in APPROVED / PICKING status ready for HO fulfillment
 */
const getPendingPOs = async (req, res, next) => {
  try {
    const pos = await prisma.purchaseOrder.findMany({
      where: {
        status: { in: ['REQUESTED', 'APPROVED', 'PICKING'] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sourceLocation: true,
        destLocation: true,
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

    return sendSuccess(res, pos, 'Daftar PO Siap Diproses di HO');
  } catch (err) {
    next(err);
  }
};

/**
 * Checkout / Picking single item for PO by scanning Item QR Code
 * Directly deducts the item from HO drawer storage
 */
const checkoutItemForPO = async (req, res, next) => {
  try {
    const { poId, itemQrPayload } = req.body;

    if (!poId || !itemQrPayload) {
      return sendError(res, 'ID Dokumen PO dan Payload QR Code Barang wajib diisi', 400);
    }

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: {
        items: {
          include: { item: true },
        },
        destLocation: true,
      },
    });

    if (!po) {
      return sendError(res, `Dokumen PO ${poId} tidak ditemukan`, 404);
    }

    if (po.status !== 'APPROVED' && po.status !== 'PICKING') {
      return sendError(res, `Dokumen PO ${poId} berstatus ${po.status}, tidak dapat melakukan picking!`, 400);
    }

    // Match item in PO
    const matchedPoItem = po.items.find(
      (pi) => pi.item.qrCode === itemQrPayload || pi.item.id === itemQrPayload
    );

    if (!matchedPoItem) {
      return sendError(res, 'Keping emas ini tidak terdaftar dalam dokumen PO yang dimaksud!', 400);
    }

    const targetItem = await prisma.item.findUnique({
      where: { id: matchedPoItem.item.id },
      include: {
        drawer: {
          include: {
            slot: { include: { cabinet: true } },
          },
        },
      },
    });

    if (!targetItem || !targetItem.drawerId) {
      return sendError(res, 'Barang ini sudah pernah di-checkout atau tidak berada di laci HO!', 400);
    }

    const previousLocationText = `${targetItem.drawer.slot.cabinet.code} -> ${targetItem.drawer.name} (${targetItem.slotPosition})`;

    // Atomic transaction: deduct item from drawer, update status to IN_TRANSIT, record history & audit
    const updated = await prisma.$transaction(async (tx) => {
      const updatedItem = await tx.item.update({
        where: { id: targetItem.id },
        data: {
          currentStatus: 'IN_TRANSIT',
          drawerId: null, // POTONG STOK: dilepas dari laci lemari HO!
          slotPosition: null, // Slot laci kini bebas!
        },
      });

      // Update PO status to PICKING if still APPROVED
      if (po.status === 'APPROVED') {
        await tx.purchaseOrder.update({
          where: { id: po.id },
          data: { status: 'PICKING' },
        });
      }

      // Record item history
      await tx.itemHistory.create({
        data: {
          itemId: targetItem.id,
          event: 'HO_PICKING',
          actor: req.user.username,
          locationCode: 'HO-CENTRAL',
          details: `Fisik keping emas ${targetItem.id} berhasil di-picking dari ${previousLocationText} untuk ${po.id} (Tujuan: ${po.destLocation.name}). Stok laci resmi terpotong.`,
        },
      });

      // Audit trail
      await tx.auditTrail.create({
        data: {
          action: 'HO_CHECKOUT_PICKING',
          actor: req.user.username,
          locationCode: 'HO-CENTRAL',
          details: `Checkout picking item ${targetItem.id} dari ${previousLocationText} untuk PO ${po.id}`,
          ipAddress: req.ip,
        },
      });

      return updatedItem;
    });

    return sendSuccess(
      res,
      {
        itemId: updated.id,
        brand: updated.brand,
        poId,
        previousLocation: previousLocationText,
        currentStatus: updated.currentStatus,
      },
      `Barang ${updated.id} berhasil di-checkout dari lemari HO dan siap dikirim!`
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Dispatch PO and generate delivery manifest / Surat Jalan
 */
const dispatchPO = async (req, res, next) => {
  try {
    const { poId } = req.params;
    const { courierName, vehicleNumber, notes } = req.body;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: {
        items: { include: { item: true } },
        destLocation: true,
      },
    });

    if (!po) {
      return sendError(res, `Dokumen PO ${poId} tidak ditemukan`, 404);
    }

    const trackingNumber = `SJ-PGD/${new Date().getFullYear()}/${poId.replace('PO-', '')}`;

    const updatedPO = await prisma.$transaction(async (tx) => {
      const result = await tx.purchaseOrder.update({
        where: { id: poId },
        data: {
          status: 'DISPATCHED',
          trackingNumber,
          dispatchedBy: req.user.username,
          notes: notes ? `${po.notes || ''} | ${notes}` : po.notes,
        },
      });

      // Ensure all items are IN_TRANSIT
      for (const pi of po.items) {
        await tx.item.update({
          where: { id: pi.itemId },
          data: { currentStatus: 'IN_TRANSIT', drawerId: null, slotPosition: null },
        });

        await tx.itemHistory.create({
          data: {
            itemId: pi.itemId,
            event: 'DISPATCHED',
            actor: req.user.username,
            locationCode: 'HO-CENTRAL',
            details: `Barang dikirim via kurir ekspedisi (${courierName || 'Pengawalan Internal'}). Nomor Surat Jalan: ${trackingNumber}`,
          },
        });
      }

      await tx.auditTrail.create({
        data: {
          action: 'HO_DISPATCH_PO',
          actor: req.user.username,
          locationCode: 'HO-CENTRAL',
          details: `Dokumen PO ${poId} resmi dikirim ke ${po.destLocation.name}. Surat Jalan: ${trackingNumber}`,
          ipAddress: req.ip,
        },
      });

      return result;
    });

    return sendSuccess(
      res,
      {
        poId: updatedPO.id,
        trackingNumber,
        status: updatedPO.status,
        destination: po.destLocation.name,
        totalItems: po.items.length,
      },
      `PO ${poId} resmi diberangkatkan dengan Surat Jalan ${trackingNumber}!`
    );
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPendingPOs,
  checkoutItemForPO,
  dispatchPO,
};

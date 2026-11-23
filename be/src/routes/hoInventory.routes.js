const express = require('express');
const {
  getHoInventory,
  registerInboundItem,
  getItemByQrCode,
  getItemPrintableLabel,
  getHoDashboardStats,
  updateItem,
  deleteItem,
} = require('../controllers/hoInventory.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRoles, requireHeadOffice } = require('../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate, requireHeadOffice);

/**
 * @openapi
 * /ho/stats:
 *   get:
 *     summary: Ambil statistik KPI inventori vault HO
 *     tags: [Inventori Emas HO]
 *     responses:
 *       200:
 *         description: Ringkasan statistik
 */
router.get('/stats', getHoDashboardStats);
router.get('/inventory/summary', getHoDashboardStats);

/**
 * @openapi
 * /ho/items:
 *   get:
 *     summary: Ambil daftar seluruh keping emas di lemari HO
 *     tags: [Inventori Emas HO]
 *     responses:
 *       200:
 *         description: Daftar inventori keping emas
 */
router.get('/items', getHoInventory);
router.get('/inventory', getHoInventory);

/**
 * @openapi
 * /ho/items/scan:
 *   get:
 *     summary: Cari keping emas berdasarkan scan QR Code
 *     tags: [Inventori Emas HO]
 *     parameters:
 *       - in: query
 *         name: qr
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Data keping emas ditemukan
 */
router.get('/items/scan', getItemByQrCode);

/**
 * @openapi
 * /ho/items/{itemId}/label:
 *   get:
 *     summary: Ambil data gambar QR Code untuk dicetak stiker keping emas
 *     tags: [Inventori Emas HO]
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Base64 data URL QR Code
 */
router.get('/items/:itemId/label', getItemPrintableLabel);
router.get('/items/:itemId', getItemPrintableLabel);
router.get('/inventory/:itemId', getItemPrintableLabel);
router.get('/inventory/:itemId/label', getItemPrintableLabel);

/**
 * @openapi
 * /ho/items/inbound:
 *   post:
 *     summary: Inbound pendaftaran keping emas baru masuk ke laci lemari HO
 *     tags: [Inventori Emas HO]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InboundGoldRequest'
 *     responses:
 *       201:
 *         description: Keping emas berhasil didaftarkan
 */
router.post(
  '/items/inbound',
  requireRoles(['HO_STAFF', 'HO_SUPERVISOR', 'SUPER_ADMIN']),
  registerInboundItem
);
router.post(
  '/inventory/inbound',
  requireRoles(['HO_STAFF', 'HO_SUPERVISOR', 'SUPER_ADMIN']),
  registerInboundItem
);

router.put(
  '/items/:id',
  requireRoles(['HO_STAFF', 'HO_SUPERVISOR', 'SUPER_ADMIN']),
  updateItem
);
router.delete(
  '/items/:id',
  requireRoles(['HO_STAFF', 'HO_SUPERVISOR', 'SUPER_ADMIN']),
  deleteItem
);
router.put(
  '/inventory/:id',
  requireRoles(['HO_STAFF', 'HO_SUPERVISOR', 'SUPER_ADMIN']),
  updateItem
);
router.delete(
  '/inventory/:id',
  requireRoles(['HO_STAFF', 'HO_SUPERVISOR', 'SUPER_ADMIN']),
  deleteItem
);

module.exports = router;

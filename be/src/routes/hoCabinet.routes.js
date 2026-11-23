const express = require('express');
const {
  getAllCabinets,
  getCabinetByCode,
  switchSlotModularType,
  getDrawerDetails,
  updateDrawerCapacity,
  createCabinet,
  updateCabinet,
  deleteCabinet,
} = require('../controllers/hoCabinet.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRoles, requireHeadOffice } = require('../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate, requireHeadOffice);

/**
 * @openapi
 * /ho/cabinets:
 *   get:
 *     summary: Ambil seluruh lemari besi Vault HO Central HO beserta statistik slot
 *   post:
 *     summary: Buat lemari besi baru dengan 8 slot modular
 */
router.get('/cabinets', getAllCabinets);
router.post('/cabinets', requireRoles(['HO_SUPERVISOR', 'SUPER_ADMIN']), createCabinet);
router.put('/cabinets/:id', requireRoles(['HO_SUPERVISOR', 'SUPER_ADMIN']), updateCabinet);
router.delete('/cabinets/:id', requireRoles(['HO_SUPERVISOR', 'SUPER_ADMIN']), deleteCabinet);

/**
 * @openapi
 * /ho/cabinets/{code}:
 *   get:
 *     summary: Ambil detail 1 lemari besi beserta 8 slot modular dan laci-lacinya
 *     tags: [Vault Head Office (HO)]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *         example: HO-CAB-01
 *     responses:
 *       200:
 *         description: Detail lemari dan slot
 */
router.get('/cabinets/:code', getCabinetByCode);

/**
 * @openapi
 * /ho/drawers/{drawerCode}:
 *   get:
 *     summary: Ambil detail spesifik laci beserta data QR Code dan daftar emas
 *     tags: [Vault Head Office (HO)]
 *     parameters:
 *       - in: path
 *         name: drawerCode
 *         required: true
 *         schema: { type: string }
 *         example: HO-CAB-01-SL01-DRW-BIG
 *     responses:
 *       200:
 *         description: Detail laci
 */
router.get('/drawers/:drawerCode', getDrawerDetails);

/**
 * @openapi
 * /ho/cabinets/{cabinetCode}/slots/{slotNumber}/modular-type:
 *   patch:
 *     summary: Konversi format modular slot (BIG_DRAWER <-> SMALL_CLUSTER) (Supervisor only)
 *     tags: [Vault Head Office (HO)]
 *     parameters:
 *       - in: path
 *         name: cabinetCode
 *         required: true
 *         schema: { type: string }
 *         example: HO-CAB-01
 *       - in: path
 *         name: slotNumber
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ModularSwitchRequest'
 *     responses:
 *       200:
 *         description: Tipe modular slot berhasil dikonversi
 */
router.patch(
  '/cabinets/:cabinetCode/slots/:slotNumber/modular-type',
  requireRoles(['HO_SUPERVISOR', 'SUPER_ADMIN']),
  switchSlotModularType
);

/**
 * @openapi
 * /ho/drawers/:drawerCode/capacity:
 *   patch:
 *     summary: Kustomisasi kapasitas eksplisit & dimensi grid laci (Supervisor only)
 *     tags: [Vault Head Office (HO)]
 *     parameters:
 *       - in: path
 *         name: drawerCode
 *         required: true
 *         schema: { type: string }
 *         example: HO-CAB-01-SL01-DRW-BIG
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateDrawerCapacityRequest'
 *     responses:
 *       200:
 *         description: Kapasitas laci berhasil diperbarui
 */
router.patch(
  '/drawers/:drawerCode/capacity',
  requireRoles(['HO_SUPERVISOR', 'SUPER_ADMIN']),
  updateDrawerCapacity
);

module.exports = router;

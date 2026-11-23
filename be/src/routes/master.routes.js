const express = require('express');
const {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  getAllLocations,
  createLocation,
  updateLocation,
  deleteLocation,
} = require('../controllers/masterUserLocation.controller');
const {
  getAllPermissions,
  getAllRoles,
  createRole,
  updateRole,
  deleteRole,
} = require('../controllers/roleMaster.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRoles } = require('../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate);

/**
 * @openapi
 * /master/locations:
 *   get:
 *     summary: Ambil daftar seluruh titik vault (HO & Outlet Hub)
 *     tags: [Master Data]
 *     responses:
 *       200:
 *         description: Berhasil mengambil daftar lokasi
 *   post:
 *     summary: Daftarkan unit / lokasi vault baru (Super Admin only)
 *     tags: [Master Data]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name, type]
 *             properties:
 *               code: { type: string, example: 'OUTLET-DEPOK' }
 *               name: { type: string, example: 'Pegadaian Cabang Depok' }
 *               type: { type: string, enum: ['HEAD_OFFICE', 'OUTLET_HUB'], example: 'OUTLET_HUB' }
 *               address: { type: string, example: 'Jl. Margonda Raya No. 45' }
 *     responses:
 *       201:
 *         description: Lokasi berhasil dibuat
 */
router.get('/locations', getAllLocations);
router.post('/locations', requireRoles(['SUPER_ADMIN']), createLocation);

/**
 * @openapi
 * /master/locations/{id}:
 *   put:
 *     summary: Update data titik unit lokasi vault (Super Admin only)
 *     tags: [Master Data]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Data lokasi berhasil diperbarui
 *   delete:
 *     summary: Hapus unit lokasi vault (Super Admin only)
 *     tags: [Master Data]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lokasi berhasil dihapus
 *       400:
 *         description: Lokasi masih memiliki keterkaitan lemari / pengguna
 */
router.put('/locations/:id', requireRoles(['SUPER_ADMIN']), updateLocation);
router.delete('/locations/:id', requireRoles(['SUPER_ADMIN']), deleteLocation);

/**
 * @openapi
 * /master/users:
 *   get:
 *     summary: Ambil seluruh daftar pengguna RBAC (Super Admin only)
 *     tags: [Master Data]
 *     responses:
 *       200:
 *         description: Daftar pengguna berhasil diambil
 *   post:
 *     summary: Buat akun pengguna baru (Super Admin only)
 *     tags: [Master Data]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *     responses:
 *       201:
 *         description: Pengguna baru berhasil dibuat
 */
router.get('/users', requireRoles(['SUPER_ADMIN']), getAllUsers);
router.post('/users', requireRoles(['SUPER_ADMIN']), createUser);

/**
 * @openapi
 * /master/users/{id}:
 *   put:
 *     summary: Update data, status, role, atau password pengguna (Super Admin only)
 *     tags: [Master Data]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Data pengguna berhasil diperbarui
 *   delete:
 *     summary: Hapus pengguna dari sistem (Super Admin only)
 *     tags: [Master Data]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Pengguna berhasil dihapus
 *       400:
 *         description: Tidak dapat menghapus akun sendiri
 *       404:
 *         description: Pengguna tidak ditemukan
 */
router.put('/users/:id', requireRoles(['SUPER_ADMIN']), updateUser);
router.delete('/users/:id', requireRoles(['SUPER_ADMIN']), deleteUser);

/**
 * @openapi
 * /master/roles:
 *   get:
 *     summary: Ambil seluruh daftar master peran dinamis RBAC (Super Admin only)
 *     tags: [Master Data Roles]
 *     responses:
 *       200:
 *         description: Daftar seluruh peran
 *   post:
 *     summary: Buat peran baru dan hak akses dinamis (Super Admin only)
 *     tags: [Master Data Roles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name]
 *             properties:
 *               code: { type: string, example: 'REGIONAL_AUDITOR' }
 *               name: { type: string, example: 'Auditor Regional Wilayah' }
 *               description: { type: string }
 *               permissions: { type: array, items: { type: string } }
 *     responses:
 *       201:
 *         description: Peran berhasil dibuat
 */
router.get('/roles/permissions', requireRoles(['SUPER_ADMIN']), getAllPermissions);
router.get('/roles', requireRoles(['SUPER_ADMIN']), getAllRoles);
router.post('/roles', requireRoles(['SUPER_ADMIN']), createRole);
router.put('/roles/:id', requireRoles(['SUPER_ADMIN']), updateRole);
router.delete('/roles/:id', requireRoles(['SUPER_ADMIN']), deleteRole);

module.exports = router;

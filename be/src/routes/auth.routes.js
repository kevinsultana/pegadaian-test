const express = require('express');
const { login, getMe } = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Autentikasi Pengguna & Dapatkan Token JWT
 *     tags: [Autentikasi]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login berhasil, mengembalikan token JWT dan profil pengguna
 *       401:
 *         description: Username atau password salah
 */
router.post('/login', login);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Ambil profil data pengguna aktif
 *     tags: [Autentikasi]
 *     responses:
 *       200:
 *         description: Informasi profil dan wewenang pengguna
 *       401:
 *         description: Belum terautentikasi
 */
router.get('/me', authenticate, getMe);

module.exports = router;

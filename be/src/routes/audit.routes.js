const express = require('express');
const { getAuditTrails } = require('../controllers/audit.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authenticate);

/**
 * @openapi
 * /audit/logs:
 *   get:
 *     summary: Ambil catatan audit trail log keamanan dan aktivitas vault
 *     tags: [Audit Trail]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, example: 50 }
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *       - in: query
 *         name: actor
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Berhasil mengambil log audit
 */
router.get('/', getAuditTrails);
router.get('/logs', getAuditTrails);

module.exports = router;

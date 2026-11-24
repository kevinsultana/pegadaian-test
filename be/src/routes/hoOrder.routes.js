const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const {
  listHoOrders,
  getHoOrderDetail,
  approveByHoSpv,
  rejectByHo,
  startPicking,
  verifyPickingStep,
  scanItem,
  removePickedItem,
  dispatchOrder,
  getSuratJalan,
} = require('../controllers/hoOrder.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: HO Orders
 *   description: Manajemen Purchase Order di sisi Head Office
 */

router.get('/', authenticate, listHoOrders);
router.get('/:id/surat-jalan', authenticate, getSuratJalan);
router.get('/:id', authenticate, getHoOrderDetail);
router.patch('/:id/approve', authenticate, approveByHoSpv);
router.patch('/:id/reject', authenticate, rejectByHo);
router.patch('/:id/start-picking', authenticate, startPicking);
router.post('/:id/verify-step', authenticate, verifyPickingStep);
router.patch('/:id/scan-item', authenticate, scanItem);
router.patch('/:id/remove-item', authenticate, removePickedItem);
router.patch('/:id/dispatch', authenticate, dispatchOrder);

module.exports = router;

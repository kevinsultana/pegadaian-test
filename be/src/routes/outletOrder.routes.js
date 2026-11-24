const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const {
  listOutletOrders,
  getOutletOrderDetail,
  createDraftOrder,
  submitToOutletSpv,
  approveByOutletSpv,
  rejectByOutletSpv,
  receiveOrder,
  updateDraftOrder,
  deleteDraftOrder,
  getOutletDrawers,
  pairItemRfid,
} = require('../controllers/outletOrder.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Outlet Orders
 *   description: Purchase Order dari Outlet ke HO
 */

router.get('/drawers', authenticate, getOutletDrawers);
router.get('/', authenticate, listOutletOrders);
router.get('/:id', authenticate, getOutletOrderDetail);
router.post('/', authenticate, createDraftOrder);
router.put('/:id', authenticate, updateDraftOrder);
router.delete('/:id', authenticate, deleteDraftOrder);
router.patch('/:id/submit-to-spv', authenticate, submitToOutletSpv);
router.patch('/:id/approve-outlet', authenticate, approveByOutletSpv);
router.patch('/:id/reject-outlet', authenticate, rejectByOutletSpv);
router.patch('/:id/receive', authenticate, receiveOrder);
router.post('/:id/pair-item-rfid', authenticate, pairItemRfid);

module.exports = router;

const express = require('express');
const {
  getPendingPOs,
  checkoutItemForPO,
  dispatchPO,
} = require('../controllers/hoCheckout.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRoles, requireHeadOffice } = require('../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate, requireHeadOffice);

// List POs ready for picking
router.get('/pos', getPendingPOs);

// Picking / checkout item by scanning QR code (Logistics, Staff, Supervisor)
router.post(
  '/checkout-item',
  requireRoles(['HO_LOGISTICS', 'HO_STAFF', 'HO_SUPERVISOR', 'SUPER_ADMIN']),
  checkoutItemForPO
);

// Dispatch PO & generate Surat Jalan
router.post(
  '/pos/:poId/dispatch',
  requireRoles(['HO_LOGISTICS', 'HO_SUPERVISOR', 'SUPER_ADMIN']),
  dispatchPO
);

module.exports = router;

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const {
  getAvailableOutletItems,
  getDestinationOutlets,
  createCustomerSale,
  createExternalMutationPO,
  createInternalMutation,
  getOutboundOrders,
} = require('../controllers/outletOutbound.controller');

// All routes require authentication
router.use(authenticate);

// GET /api/outlet/outbound - List all outbound & mutation orders
router.get('/', getOutboundOrders);

// GET /api/outlet/outbound/available-items - Items available for outbound
router.get('/available-items', getAvailableOutletItems);

// GET /api/outlet/outbound/destinations - Target outlets for external mutation
router.get('/destinations', getDestinationOutlets);

// POST /api/outlet/outbound/customer-sale - Checkout / sale to customer
router.post('/customer-sale', createCustomerSale);

// POST /api/outlet/outbound/external-mutation - Inter-outlet mutation PO
router.post('/external-mutation', createExternalMutationPO);

// POST /api/outlet/outbound/internal-mutation - Relocate between drawers
router.post('/internal-mutation', createInternalMutation);

module.exports = router;

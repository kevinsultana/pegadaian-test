const express = require('express');
const {
  getInboundOrders,
  getInboundOrderById,
  createInboundOrder,
  submitInboundOrder,
  approveInboundOrder,
  rejectInboundOrder,
  receiveInboundGoods,
  getDrawerRecommendations,
  putAwayItem,
} = require('../controllers/hoInbound.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireHeadOffice, requireRoles } = require('../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate, requireHeadOffice);

// Drawer recommendations for put-away
router.get('/recommendations', getDrawerRecommendations);

// Inbound Orders CRUD & Workflow
router.get('/', getInboundOrders);
router.post('/', createInboundOrder);
router.get('/:id', getInboundOrderById);

// Workflow state transitions
router.patch('/:id/submit', submitInboundOrder);
router.patch('/:id/approve', requireRoles(['SUPER_ADMIN', 'HO_SUPERVISOR']), approveInboundOrder);
router.patch('/:id/reject', requireRoles(['SUPER_ADMIN', 'HO_SUPERVISOR']), rejectInboundOrder);
router.patch('/:id/receive', receiveInboundGoods);

// Put-away item per keping
router.post('/:id/put-away', putAwayItem);

module.exports = router;

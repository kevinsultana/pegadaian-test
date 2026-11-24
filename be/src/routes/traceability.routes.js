const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const {
  getTraceabilityItems,
  getItemLifecycleDetail,
} = require('../controllers/traceability.controller');

// All routes require authentication
router.use(authenticate);

// GET /api/traceability/items - List gold items with current location & filters
router.get('/items', getTraceabilityItems);

// GET /api/traceability/items/:id - Full lifecycle timeline of a specific gold bar
router.get('/items/:id', getItemLifecycleDetail);

module.exports = router;

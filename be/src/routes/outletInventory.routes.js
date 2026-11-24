const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const {
  getOutletInventory,
  getOutletItemDetail,
} = require('../controllers/outletInventory.controller');

// All routes require authentication
router.use(authenticate);

// GET /api/outlet/inventory
router.get('/', getOutletInventory);

// GET /api/outlet/inventory/:id
router.get('/:id', getOutletItemDetail);

module.exports = router;

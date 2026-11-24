const express = require('express');
const {
  getOutletDashboard,
  simulateRfidScan,
} = require('../controllers/outletDashboard.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', getOutletDashboard);
router.post('/simulate-rfid-scan', simulateRfidScan);

module.exports = router;

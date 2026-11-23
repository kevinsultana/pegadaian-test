const express = require('express');
const authRoutes = require('./auth.routes');
const hoCabinetRoutes = require('./hoCabinet.routes');
const hoInventoryRoutes = require('./hoInventory.routes');
const hoCheckoutRoutes = require('./hoCheckout.routes');
const auditRoutes = require('./audit.routes');
const masterRoutes = require('./master.routes');

const router = express.Router();

// Health Check
router.get('/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'Pegadaian Smart Vault Enterprise API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Authentication
router.use('/auth', authRoutes);

// Master Data Management (Users & Locations)
router.use('/master', masterRoutes);

// Head Office (HO) Management
router.use('/ho', hoCabinetRoutes);
router.use('/ho', hoInventoryRoutes);
router.use('/ho', hoCheckoutRoutes);

// Audit Trail & Logs
router.use('/audit', auditRoutes);

module.exports = router;

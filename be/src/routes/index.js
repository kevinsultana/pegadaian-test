const express = require('express');
const authRoutes = require('./auth.routes');
const hoCabinetRoutes = require('./hoCabinet.routes');
const hoInventoryRoutes = require('./hoInventory.routes');
const hoCheckoutRoutes = require('./hoCheckout.routes');
const hoOrderRoutes = require('./hoOrder.routes');
const hoInboundRoutes = require('./hoInbound.routes');
const outletOrderRoutes = require('./outletOrder.routes');
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
router.use('/ho/orders', hoOrderRoutes);
router.use('/ho/inbound', hoInboundRoutes);

// Outlet Management
router.use('/outlet/orders', outletOrderRoutes);

// Audit Trail & Logs
router.use('/audit', auditRoutes);

module.exports = router;

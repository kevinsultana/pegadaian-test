const express = require('express');
const {
  getOutletCabinets,
  getOutletCabinetDetail,
  createOutletCabinet,
  updateOutletDrawer,
  deleteOutletCabinet,
} = require('../controllers/outletCabinet.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', getOutletCabinets);
router.post('/', createOutletCabinet);
router.get('/:code', getOutletCabinetDetail);
router.put('/drawers/:drawerId', updateOutletDrawer);
router.delete('/:id', deleteOutletCabinet);

module.exports = router;

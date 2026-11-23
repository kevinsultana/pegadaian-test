const prisma = require('../config/prisma');
const { sendSuccess } = require('../utils/response');

/**
 * Get chronological audit trail logs
 */
const getAuditTrails = async (req, res, next) => {
  try {
    const { action, actor, locationCode, limit = 100 } = req.query;

    const where = {};
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (actor) where.actor = { contains: actor, mode: 'insensitive' };
    if (locationCode) where.locationCode = locationCode;

    const logs = await prisma.auditTrail.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit, 10) || 100,
    });

    return sendSuccess(res, { logs }, 'Audit Trail Log Vault Pegadaian');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAuditTrails,
};

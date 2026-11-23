const { sendError } = require('../utils/response');

/**
 * RBAC Role Check Middleware
 * @param {string[]} allowedRoles - Array of roles permitted to access
 */
const requireRoles = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Autentikasi diperlukan', 401);
    }

    // SUPER_ADMIN has global privileges
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(
        res,
        `Akses terbatas: Peran ${req.user.role} tidak memiliki izin untuk aksi ini`,
        403
      );
    }

    next();
  };
};

/**
 * Require Head Office affiliation
 */
const requireHeadOffice = (req, res, next) => {
  if (!req.user) {
    return sendError(res, 'Autentikasi diperlukan', 401);
  }

  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  if (req.user.location?.type !== 'HEAD_OFFICE') {
    return sendError(res, 'Modul ini hanya dapat diakses dari Head Office (HO)', 403);
  }

  next();
};

module.exports = {
  requireRoles,
  requireHeadOffice,
};

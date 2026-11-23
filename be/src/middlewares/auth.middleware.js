const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const prisma = require('../config/prisma');
const { sendError } = require('../utils/response');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Akses ditolak: Token autentikasi tidak ditemukan', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        location: true,
      },
    });

    if (!user || !user.isActive) {
      return sendError(res, 'Sesi tidak valid atau pengguna dinonaktifkan', 401);
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 'Sesi login telah kedaluwarsa, silakan login kembali', 401);
    }
    return sendError(res, 'Token tidak valid', 401);
  }
};

module.exports = {
  authenticate,
};

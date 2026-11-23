const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/env');
const { sendSuccess, sendError } = require('../utils/response');

const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return sendError(res, 'Username dan password wajib diisi', 400);
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: { location: true },
    });

    if (!user || !user.isActive) {
      return sendError(res, 'Username atau password salah', 401);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return sendError(res, 'Username atau password salah', 401);
    }

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        locationId: user.locationId,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Audit log
    await prisma.auditTrail.create({
      data: {
        action: 'USER_LOGIN',
        actor: user.username,
        locationCode: user.location?.code || '-',
        details: `Pengguna ${user.fullName} (${user.role}) berhasil masuk ke sistem`,
        ipAddress: req.ip,
      },
    });

    // Fetch dynamic permissions from role_masters
    let permissions = [];
    try {
      const roleRow = await prisma.$queryRawUnsafe(
        'SELECT permissions FROM role_masters WHERE code = $1 LIMIT 1',
        user.role
      );
      if (roleRow.length > 0 && Array.isArray(roleRow[0].permissions)) {
        permissions = roleRow[0].permissions;
      }
    } catch (e) {
      // fallback
    }

    return sendSuccess(
      res,
      {
        token,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          location: user.location,
          permissions,
        },
      },
      'Login berhasil'
    );
  } catch (err) {
    next(err);
  }
};

const getMe = async (req, res) => {
  let permissions = [];
  try {
    const roleRow = await prisma.$queryRawUnsafe(
      'SELECT permissions FROM role_masters WHERE code = $1 LIMIT 1',
      req.user.role
    );
    if (roleRow.length > 0 && Array.isArray(roleRow[0].permissions)) {
      permissions = roleRow[0].permissions;
    }
  } catch (e) {}

  return sendSuccess(
    res,
    {
      user: {
        id: req.user.id,
        username: req.user.username,
        fullName: req.user.fullName,
        role: req.user.role,
        location: req.user.location,
        permissions,
      },
    },
    'Profil pengguna terautentikasi'
  );
};

module.exports = {
  login,
  getMe,
};

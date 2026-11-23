const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * List all users with filtering by location and role
 */
const getAllUsers = async (req, res, next) => {
  try {
    const { locationId, role, search } = req.query;

    const where = {};
    if (locationId) where.locationId = locationId;
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        locationId: true,
        createdAt: true,
        updatedAt: true,
        location: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
          },
        },
      },
    });

    return sendSuccess(
      res,
      {
        total: users.length,
        users,
      },
      'Daftar pengguna berhasil diambil'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new user (Super Admin only)
 */
const createUser = async (req, res, next) => {
  try {
    const { username, password, fullName, role, locationId } = req.body;

    if (!username || !password || !fullName || !role || !locationId) {
      return sendError(
        res,
        'Field username, password, fullName, role, dan locationId wajib diisi',
        400
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { username: username.toLowerCase().trim() },
    });

    if (existingUser) {
      return sendError(res, `Username '${username}' sudah terdaftar`, 409);
    }

    const location = await prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location) {
      return sendError(res, 'Lokasi yang dipilih tidak ditemukan', 404);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        username: username.toLowerCase().trim(),
        passwordHash,
        fullName,
        role,
        locationId,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        locationId: true,
        createdAt: true,
        location: true,
      },
    });

    // Audit log
    await prisma.auditTrail.create({
      data: {
        action: 'CREATE_USER',
        actor: req.user.username,
        locationCode: location.code,
        details: `Membuat akun baru: ${newUser.fullName} (${newUser.username}) dengan peran ${newUser.role}`,
        ipAddress: req.ip,
      },
    });

    return sendSuccess(res, { user: newUser }, 'Pengguna berhasil dibuat', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Update user details or status
 */
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fullName, role, locationId, isActive, password } = req.body;

    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: { location: true },
    });

    if (!targetUser) {
      return sendError(res, 'Pengguna tidak ditemukan', 404);
    }

    const updateData = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (role !== undefined) updateData.role = role;
    if (locationId !== undefined) updateData.locationId = locationId;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    if (password && password.trim().length >= 6) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(password, salt);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        locationId: true,
        updatedAt: true,
        location: true,
      },
    });

    await prisma.auditTrail.create({
      data: {
        action: 'UPDATE_USER',
        actor: req.user.username,
        locationCode: updated.location?.code || '-',
        details: `Memperbarui akun pengguna: ${updated.fullName} (${updated.username})`,
        ipAddress: req.ip,
      },
    });

    return sendSuccess(res, { user: updated }, 'Data pengguna berhasil diperbarui');
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a user (Super Admin only)
 */
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: { location: true },
    });

    if (!targetUser) {
      return sendError(res, 'Pengguna tidak ditemukan', 404);
    }

    // Prevent user from deleting their own account
    if (req.user && req.user.id === targetUser.id) {
      return sendError(
        res,
        'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif digunakan',
        400
      );
    }

    await prisma.user.delete({
      where: { id },
    });

    // Audit log
    await prisma.auditTrail.create({
      data: {
        action: 'DELETE_USER',
        actor: req.user.username,
        locationCode: targetUser.location?.code || '-',
        details: `Menghapus akun pengguna: ${targetUser.fullName} (${targetUser.username}) dengan peran ${targetUser.role}`,
        ipAddress: req.ip,
      },
    });

    return sendSuccess(
      res,
      null,
      `Pengguna ${targetUser.fullName} (${targetUser.username}) berhasil dihapus`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get all locations (HO and Outlets)
 */
const getAllLocations = async (req, res, next) => {
  try {
    const locations = await prisma.location.findMany({
      orderBy: { code: 'asc' },
      include: {
        _count: {
          select: {
            users: true,
            cabinets: true,
          },
        },
      },
    });

    return sendSuccess(res, { locations }, 'Daftar lokasi berhasil diambil');
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new location (Outlet or Office)
 */
const createLocation = async (req, res, next) => {
  try {
    const { code, name, type, address } = req.body;

    if (!code || !name || !type) {
      return sendError(res, 'Field code, name, dan type wajib diisi', 400);
    }

    const existing = await prisma.location.findUnique({
      where: { code: code.toUpperCase().trim() },
    });

    if (existing) {
      return sendError(res, `Kode lokasi '${code}' sudah digunakan`, 409);
    }

    const newLoc = await prisma.location.create({
      data: {
        code: code.toUpperCase().trim(),
        name,
        type,
        address,
      },
    });

    await prisma.auditTrail.create({
      data: {
        action: 'CREATE_LOCATION',
        actor: req.user.username,
        locationCode: newLoc.code,
        details: `Mendaftarkan master lokasi baru: ${newLoc.name} (${newLoc.code}) bertipe ${newLoc.type}`,
        ipAddress: req.ip,
      },
    });

    return sendSuccess(res, { location: newLoc }, 'Lokasi berhasil ditambahkan', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing location (Super Admin only)
 */
const updateLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { code, name, type, address } = req.body;

    const existingLoc = await prisma.location.findUnique({
      where: { id },
    });

    if (!existingLoc) {
      return sendError(res, 'Lokasi tidak ditemukan', 404);
    }

    if (code && code.toUpperCase().trim() !== existingLoc.code) {
      const duplicate = await prisma.location.findUnique({
        where: { code: code.toUpperCase().trim() },
      });

      if (duplicate && duplicate.id !== id) {
        return sendError(res, `Kode lokasi '${code}' sudah digunakan oleh unit lain`, 409);
      }
    }

    const updateData = {};
    if (code !== undefined) updateData.code = code.toUpperCase().trim();
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (address !== undefined) updateData.address = address;

    const updated = await prisma.location.update({
      where: { id },
      data: updateData,
    });

    await prisma.auditTrail.create({
      data: {
        action: 'UPDATE_LOCATION',
        actor: req.user.username,
        locationCode: updated.code,
        details: `Memperbarui data lokasi: ${updated.name} (${updated.code}) bertipe ${updated.type}`,
        ipAddress: req.ip,
      },
    });

    return sendSuccess(res, { location: updated }, 'Data lokasi berhasil diperbarui');
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a location (Super Admin only)
 */
const deleteLocation = async (req, res, next) => {
  try {
    const { id } = req.params;

    const targetLoc = await prisma.location.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            cabinets: true,
            posFrom: true,
            posTo: true,
          },
        },
      },
    });

    if (!targetLoc) {
      return sendError(res, 'Lokasi tidak ditemukan', 404);
    }

    // Prevent deleting user's current active assignment location
    if (req.user && req.user.locationId === id) {
      return sendError(
        res,
        'Anda tidak dapat menghapus lokasi tempat akun Anda bertugas saat ini',
        400
      );
    }

    // Check relations constraints
    const usersCount = targetLoc._count?.users || 0;
    const cabinetsCount = targetLoc._count?.cabinets || 0;
    const posCount = (targetLoc._count?.posFrom || 0) + (targetLoc._count?.posTo || 0);

    if (usersCount > 0 || cabinetsCount > 0 || posCount > 0) {
      const reasons = [];
      if (usersCount > 0) reasons.push(`${usersCount} akun pengguna`);
      if (cabinetsCount > 0) reasons.push(`${cabinetsCount} lemari vault`);
      if (posCount > 0) reasons.push(`${posCount} transaksi transfer PO`);

      return sendError(
        res,
        `Lokasi '${targetLoc.name}' tidak dapat dihapus karena masih memiliki data terkait: ${reasons.join(', ')}. Harap pindahkan atau hapus data terkait terlebih dahulu.`,
        400
      );
    }

    await prisma.location.delete({
      where: { id },
    });

    await prisma.auditTrail.create({
      data: {
        action: 'DELETE_LOCATION',
        actor: req.user.username,
        locationCode: targetLoc.code,
        details: `Menghapus master lokasi: ${targetLoc.name} (${targetLoc.code})`,
        ipAddress: req.ip,
      },
    });

    return sendSuccess(
      res,
      null,
      `Lokasi ${targetLoc.name} (${targetLoc.code}) berhasil dihapus`
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  getAllLocations,
  createLocation,
  updateLocation,
  deleteLocation,
};

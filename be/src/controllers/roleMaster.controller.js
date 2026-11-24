const prisma = require('../config/prisma');
const { sendSuccess, sendError } = require('../utils/response');
const { ALL_PERMISSIONS } = require('../scripts/setupRoles');

/**
 * Get all available permissions list grouped by modules
 */
const getAllPermissions = async (req, res, next) => {
  try {
    return sendSuccess(res, ALL_PERMISSIONS, 'Daftar hak akses izin sistem');
  } catch (error) {
    next(error);
  }
};

/**
 * List all master roles with assigned permissions and user counts
 */
const getAllRoles = async (req, res, next) => {
  try {
    const roles = await prisma.$queryRawUnsafe(`
      SELECT 
        r.id,
        r.code,
        r.name,
        r.description,
        r.permissions,
        r."isSystem",
        r."createdAt",
        r."updatedAt",
        (SELECT COUNT(*)::int FROM users u WHERE u.role::text = r.code) as "userCount"
      FROM role_masters r
      ORDER BY r."isSystem" DESC, r."createdAt" ASC
    `);

    return sendSuccess(res, { roles }, 'Daftar seluruh peran RBAC berhasil diambil');
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new dynamic master role (Super Admin only)
 */
const createRole = async (req, res, next) => {
  try {
    const { code, name, description, permissions } = req.body;

    if (!code || !name) {
      return sendError(res, 'Kode peran (code) dan Nama peran (name) wajib diisi', 400);
    }

    const cleanCode = code.toUpperCase().trim().replace(/[^A-Z0-9_]/g, '_');

    // Check duplicate code
    const existing = await prisma.$queryRawUnsafe(
      'SELECT id FROM role_masters WHERE code = $1 LIMIT 1',
      cleanCode
    );

    if (existing.length > 0) {
      return sendError(res, `Kode peran '${cleanCode}' sudah digunakan di sistem`, 409);
    }

    const finalPermissions = Array.isArray(permissions) ? permissions : [];
    const id = 'role-' + cleanCode.toLowerCase().replace(/_/g, '-');

    // Ensure PostgreSQL Role enum accepts this new custom role
    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS '${cleanCode}'`);
    } catch (enumErr) {
      // Ignore if already exists or fails
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO role_masters (id, code, name, description, permissions, "isSystem", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, FALSE, NOW(), NOW())`,
      id,
      cleanCode,
      name.trim(),
      description || null,
      finalPermissions
    );

    const newRole = {
      id,
      code: cleanCode,
      name: name.trim(),
      description: description || null,
      permissions: finalPermissions,
      isSystem: false,
      userCount: 0,
    };

    // Audit log
    await prisma.auditTrail.create({
      data: {
        action: 'CREATE_ROLE',
        actor: req.user.username,
        locationCode: req.user.location?.code || 'HO-CENTRAL',
        details: `Membuat definisi peran baru: ${newRole.name} (${newRole.code}) dengan ${finalPermissions.length} hak akses`,
        ipAddress: req.ip,
      },
    });

    return sendSuccess(res, { role: newRole }, 'Peran baru berhasil dibuat', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing role (Super Admin only)
 */
const updateRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, permissions } = req.body;

    const existing = await prisma.$queryRawUnsafe(
      'SELECT * FROM role_masters WHERE id = $1 LIMIT 1',
      id
    );

    if (existing.length === 0) {
      return sendError(res, 'Peran tidak ditemukan', 404);
    }

    const currentRole = existing[0];
    const updateName = name !== undefined ? name.trim() : currentRole.name;
    const updateDesc = description !== undefined ? description : currentRole.description;

    let updatePerms = currentRole.permissions;
    if (Array.isArray(permissions)) {
      // If SUPER_ADMIN, enforce all permissions (both modern and legacy keys)
      if (currentRole.code === 'SUPER_ADMIN') {
        updatePerms = [
          ...ALL_PERMISSIONS.map((p) => p.key),
          ...ALL_PERMISSIONS.map((p) => p.legacyKey).filter(Boolean),
        ];
      } else {
        updatePerms = permissions;
      }
    }

    await prisma.$executeRawUnsafe(
      `UPDATE role_masters 
       SET name = $1, description = $2, permissions = $3, "updatedAt" = NOW()
       WHERE id = $4`,
      updateName,
      updateDesc,
      updatePerms,
      id
    );

    // Audit log
    await prisma.auditTrail.create({
      data: {
        action: 'UPDATE_ROLE',
        actor: req.user.username,
        locationCode: req.user.location?.code || 'HO-CENTRAL',
        details: `Memperbarui peran: ${updateName} (${currentRole.code}) hak akses: ${updatePerms.length} izin`,
        ipAddress: req.ip,
      },
    });

    const updated = {
      ...currentRole,
      name: updateName,
      description: updateDesc,
      permissions: updatePerms,
    };

    return sendSuccess(res, { role: updated }, 'Data peran berhasil diperbarui');
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a role (Super Admin only)
 */
const deleteRole = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.$queryRawUnsafe(
      'SELECT * FROM role_masters WHERE id = $1 LIMIT 1',
      id
    );

    if (existing.length === 0) {
      return sendError(res, 'Peran tidak ditemukan', 404);
    }

    const role = existing[0];

    if (role.isSystem || role.code === 'SUPER_ADMIN') {
      return sendError(res, `Peran sistem bawaan '${role.name}' tidak dapat dihapus`, 400);
    }

    // Check if any users have this role
    const usersWithRole = await prisma.$queryRawUnsafe(
      'SELECT COUNT(*)::int as count FROM users WHERE role::text = $1',
      role.code
    );

    const userCount = usersWithRole[0]?.count || 0;
    if (userCount > 0) {
      return sendError(
        res,
        `Peran '${role.name}' masih digunakan oleh ${userCount} akun pengguna. Pindahkan peran pengguna tersebut terlebih dahulu sebelum menghapus.`,
        400
      );
    }

    await prisma.$executeRawUnsafe('DELETE FROM role_masters WHERE id = $1', id);

    // Audit log
    await prisma.auditTrail.create({
      data: {
        action: 'DELETE_ROLE',
        actor: req.user.username,
        locationCode: req.user.location?.code || 'HO-CENTRAL',
        details: `Menghapus master peran: ${role.name} (${role.code})`,
        ipAddress: req.ip,
      },
    });

    return sendSuccess(res, null, `Peran ${role.name} (${role.code}) berhasil dihapus`);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllPermissions,
  getAllRoles,
  createRole,
  updateRole,
  deleteRole,
};

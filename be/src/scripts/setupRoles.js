const prisma = require('../config/prisma');

/**
 * Hak Akses Menu Dinamis (Menu-Based RBAC Permissions)
 * Dikelompokkan per modul: Head Office (HO), Outlet / Cabang, Super Admin, dan Sistem & Audit
 */
const ALL_PERMISSIONS = [
  // ==========================================
  // MODUL 1: HEAD OFFICE (HO)
  // ==========================================
  {
    key: 'MENU_HO_DASHBOARD',
    legacyKey: 'DASHBOARD_HO',
    module: 'Head Office (HO)',
    category: 'HO',
    name: 'Dashboard Vault HO',
    description: 'Akses monitoring KPI, kapasitas lemari vault, dan status operasional HO',
    path: '/ho/dashboard',
    badge: 'HO Vault',
  },
  {
    key: 'MENU_HO_INBOUND',
    legacyKey: 'HO_INBOUND',
    module: 'Head Office (HO)',
    category: 'HO',
    name: 'PO Inbound (Pengadaan)',
    description: 'Penerimaan emas baru supplier, cetak surat bukti, dan put-away vault HO',
    path: '/ho/inbound',
    badge: 'HO Pengadaan',
  },
  {
    key: 'MENU_HO_CABINETS',
    legacyKey: 'HO_CABINETS',
    module: 'Head Office (HO)',
    category: 'HO',
    name: 'Lemari & Slot Modular HO',
    description: 'Konfigurasi lemari besi vault 01-32, slot modular, dan penataan laci HO',
    path: '/ho/cabinets',
    badge: 'HO Fisik',
  },
  {
    key: 'MENU_HO_INVENTORY',
    legacyKey: 'HO_INVENTORY',
    module: 'Head Office (HO)',
    category: 'HO',
    name: 'Inventori & QR Emas HO',
    description: 'Katalog stok keping emas vault HO dan cetak stiker barcode / QR code',
    path: '/ho/inventory',
    badge: 'HO Stok',
  },
  {
    key: 'MENU_HO_ORDERS',
    legacyKey: 'HO_ORDERS',
    module: 'Head Office (HO)',
    category: 'HO',
    name: 'PO Outlet & Picking Emas',
    description: 'Approval permintaan cabang, alokasi FIFO keping, dan picking ekspedisi',
    path: '/ho/orders',
    badge: 'HO Distribusi',
  },
  {
    key: 'MENU_HO_HISTORY',
    legacyKey: 'HO_HISTORY',
    module: 'Head Office (HO)',
    category: 'HO',
    name: 'Lacak & Riwayat Emas HO',
    description: 'Audit trail & jejak siklus hidup keping emas secara nasional',
    path: '/ho/history',
    badge: 'HO Traceability',
  },

  // ==========================================
  // MODUL 2: OUTLET / CABANG
  // ==========================================
  {
    key: 'MENU_OUTLET_DASHBOARD',
    legacyKey: 'DASHBOARD_OUTLET',
    module: 'Outlet / Cabang',
    category: 'OUTLET',
    name: 'Dashboard Outlet Hub',
    description: 'Monitoring sinyal sensor antena RFID dan status brankas cabang',
    path: '/outlet/dashboard',
    badge: 'Cabang Hub',
  },
  {
    key: 'MENU_OUTLET_INVENTORY',
    legacyKey: 'OUTLET_INVENTORY',
    module: 'Outlet / Cabang',
    category: 'OUTLET',
    name: 'Inventori Emas Cabang',
    description: 'Daftar fisik keping emas, deteksi RFID realtime, dan pencarian serial',
    path: '/outlet/inventory',
    badge: 'Cabang Stok',
  },
  {
    key: 'MENU_OUTLET_CABINETS',
    legacyKey: 'OUTLET_CABINETS',
    module: 'Outlet / Cabang',
    category: 'OUTLET',
    name: 'Lemari & Baki RFID Cabang',
    description: 'Visualisasi laci & slot grid baris (row) brankas cabang',
    path: '/outlet/cabinets',
    badge: 'Cabang Fisik',
  },
  {
    key: 'MENU_OUTLET_ORDERS',
    legacyKey: 'OUTLET_ORDERS',
    module: 'Outlet / Cabang',
    category: 'OUTLET',
    name: 'PO Inbound (Request ke HO)',
    description: 'Pengajuan restock emas ke HO dan penerimaan keping + pairing RFID',
    path: '/outlet/orders',
    badge: 'Cabang Order',
  },
  {
    key: 'MENU_OUTLET_OUTBOUND',
    legacyKey: 'OUTLET_OUTBOUND',
    module: 'Outlet / Cabang',
    category: 'OUTLET',
    name: 'PO Outbound & Mutasi Emas',
    description: 'Approval & mutasi laci/row, transfer cabang, atau serah terima nasabah',
    path: '/outlet/outbound',
    badge: 'Cabang Mutasi',
  },
  {
    key: 'MENU_OUTLET_HISTORY',
    legacyKey: 'OUTLET_HISTORY',
    module: 'Outlet / Cabang',
    category: 'OUTLET',
    name: 'Lacak & Riwayat Emas Cabang',
    description: 'Jejak riwayat keping emas yang ada / pernah mutasi di cabang ini',
    path: '/outlet/history',
    badge: 'Cabang Traceability',
  },

  // ==========================================
  // MODUL 3: SUPER ADMIN (PUSAT)
  // ==========================================
  {
    key: 'MENU_ADMIN_DASHBOARD',
    legacyKey: 'DASHBOARD_ADMIN',
    module: 'Super Admin',
    category: 'ADMIN',
    name: 'Dashboard Super Admin',
    description: 'Akses overview KPI sistem, lokasi, dan pengguna pusat',
    path: '/admin/dashboard',
    badge: 'Pusat KPI',
  },
  {
    key: 'MENU_ADMIN_USERS',
    legacyKey: 'MASTER_USERS',
    module: 'Super Admin',
    category: 'ADMIN',
    name: 'Master Pengguna (Users)',
    description: 'Kelola data pengguna, penetapan peran, dan status akun',
    path: '/admin/users',
    badge: 'Master Akun',
  },
  {
    key: 'MENU_ADMIN_LOCATIONS',
    legacyKey: 'MASTER_LOCATIONS',
    module: 'Super Admin',
    category: 'ADMIN',
    name: 'Master Unit & Lokasi',
    description: 'Kelola lokasi Head Office dan Outlet Hub',
    path: '/admin/locations',
    badge: 'Master Cabang',
  },
  {
    key: 'MENU_ADMIN_ROLES',
    legacyKey: 'MASTER_ROLES',
    module: 'Super Admin',
    category: 'ADMIN',
    name: 'Master Peran & Hak Akses',
    description: 'Kelola definisi peran dan izin hak akses menu dinamis sistem (RBAC)',
    path: '/admin/roles',
    badge: 'Master RBAC',
  },

  // ==========================================
  // MODUL 4: SISTEM & AUDIT
  // ==========================================
  {
    key: 'MENU_AUDIT_LOG',
    legacyKey: 'AUDIT_LOG',
    module: 'Sistem & Audit',
    category: 'AUDIT',
    name: 'Audit Trail & Log Aktivitas',
    description: 'Monitoring rekaman aktivitas dan log keamanan sistem',
    path: '/audit',
    badge: 'Audit & Kepatuhan',
  },
];

const INITIAL_ROLES = [
  {
    code: 'SUPER_ADMIN',
    name: 'Super Admin (Pusat)',
    description: 'Akses penuh tanpa batas ke seluruh konfigurasi, master data, dan seluruh modul menu sistem',
    permissions: [
      ...ALL_PERMISSIONS.map((p) => p.key),
      ...ALL_PERMISSIONS.map((p) => p.legacyKey).filter(Boolean),
    ],
    isSystem: true,
  },
  {
    code: 'HO_SUPERVISOR',
    name: 'HO Supervisor (Vault HO Central)',
    description: 'Penyelia operasional vault HO, persetujuan PO cabang, alokasi modular, dan audit sistem',
    permissions: [
      'MENU_HO_DASHBOARD',
      'MENU_HO_INBOUND',
      'MENU_HO_CABINETS',
      'MENU_HO_INVENTORY',
      'MENU_HO_ORDERS',
      'MENU_HO_HISTORY',
      'MENU_AUDIT_LOG',
      // Legacy
      'DASHBOARD_HO',
      'HO_INBOUND',
      'HO_CABINETS',
      'HO_INVENTORY',
      'HO_ORDERS',
      'HO_HISTORY',
      'AUDIT_LOG',
    ],
    isSystem: true,
  },
  {
    code: 'HO_STAFF',
    name: 'HO Staff Vault (Inbound & QR)',
    description: 'Petugas fisik vault HO, penerimaan barang inbound, penataan laci, dan pelabelan QR code',
    permissions: [
      'MENU_HO_DASHBOARD',
      'MENU_HO_INBOUND',
      'MENU_HO_CABINETS',
      'MENU_HO_INVENTORY',
      'MENU_HO_HISTORY',
      // Legacy
      'DASHBOARD_HO',
      'HO_INBOUND',
      'HO_CABINETS',
      'HO_INVENTORY',
      'HO_HISTORY',
    ],
    isSystem: true,
  },
  {
    code: 'HO_LOGISTICS',
    name: 'HO Logistics (Distribusi PO)',
    description: 'Petugas logistik pengiriman barang, alokasi keping, dan picking PO antar unit',
    permissions: [
      'MENU_HO_DASHBOARD',
      'MENU_HO_ORDERS',
      'MENU_HO_HISTORY',
      // Legacy
      'DASHBOARD_HO',
      'HO_ORDERS',
      'HO_HISTORY',
    ],
    isSystem: true,
  },
  {
    code: 'OUTLET_SUPERVISOR',
    name: 'Outlet Supervisor (Cabang)',
    description: 'Penyelia operasional cabang, approval mutasi emas, inventori, dan audit trail cabang',
    permissions: [
      'MENU_OUTLET_DASHBOARD',
      'MENU_OUTLET_INVENTORY',
      'MENU_OUTLET_CABINETS',
      'MENU_OUTLET_ORDERS',
      'MENU_OUTLET_OUTBOUND',
      'MENU_OUTLET_HISTORY',
      'MENU_AUDIT_LOG',
      // Legacy
      'DASHBOARD_OUTLET',
      'OUTLET_INVENTORY',
      'OUTLET_CABINETS',
      'OUTLET_ORDERS',
      'OUTLET_OUTBOUND',
      'OUTLET_HISTORY',
      'AUDIT_LOG',
    ],
    isSystem: true,
  },
  {
    code: 'OUTLET_STAFF',
    name: 'Outlet Staff (Operasional Cabang)',
    description: 'Petugas operasional harian cabang, permintaan restock ke HO, mutasi laci, dan pelayanan gadai',
    permissions: [
      'MENU_OUTLET_DASHBOARD',
      'MENU_OUTLET_INVENTORY',
      'MENU_OUTLET_ORDERS',
      'MENU_OUTLET_OUTBOUND',
      'MENU_OUTLET_HISTORY',
      // Legacy
      'DASHBOARD_OUTLET',
      'OUTLET_INVENTORY',
      'OUTLET_ORDERS',
      'OUTLET_OUTBOUND',
      'OUTLET_HISTORY',
    ],
    isSystem: true,
  },
  {
    code: 'OUTLET_PETUGAS',
    name: 'Outlet Petugas Lapangan (RFID & Brankas)',
    description: 'Petugas fisik brankas cabang, penataan baki/row RFID, dan eksekusi mutasi fisik emas',
    permissions: [
      'MENU_OUTLET_DASHBOARD',
      'MENU_OUTLET_CABINETS',
      'MENU_OUTLET_OUTBOUND',
      'MENU_OUTLET_HISTORY',
      // Legacy
      'DASHBOARD_OUTLET',
      'OUTLET_CABINETS',
      'OUTLET_OUTBOUND',
      'OUTLET_HISTORY',
    ],
    isSystem: true,
  },
  {
    code: 'SPI_AUDITOR',
    name: 'Satuan Pengawas Internal (Auditor)',
    description: 'Auditor kepatuhan, pelacakan histori keping emas HO & cabang, dan audit trail seluruh transaksi',
    permissions: [
      'MENU_AUDIT_LOG',
      'MENU_HO_DASHBOARD',
      'MENU_HO_HISTORY',
      'MENU_OUTLET_DASHBOARD',
      'MENU_OUTLET_HISTORY',
      // Legacy
      'AUDIT_LOG',
      'DASHBOARD_HO',
      'HO_HISTORY',
      'DASHBOARD_OUTLET',
      'OUTLET_HISTORY',
    ],
    isSystem: true,
  },
];

async function setupRolesTable() {
  console.log('1. Memastikan tabel role_masters siap...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS role_masters (
      id VARCHAR(255) PRIMARY KEY,
      code VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      permissions TEXT[] NOT NULL DEFAULT '{}',
      "isSystem" BOOLEAN NOT NULL DEFAULT FALSE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('2. Mendaftarkan & menyinkronkan peran awal (seeding default roles)...');
  for (const role of INITIAL_ROLES) {
    const existing = await prisma.$queryRawUnsafe(
      'SELECT id, permissions FROM role_masters WHERE code = $1 LIMIT 1',
      role.code
    );

    if (existing.length === 0) {
      const id = 'role-' + role.code.toLowerCase().replace(/_/g, '-');
      await prisma.$executeRawUnsafe(
        `INSERT INTO role_masters (id, code, name, description, permissions, "isSystem", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        id,
        role.code,
        role.name,
        role.description,
        role.permissions,
        role.isSystem
      );
      console.log(` - Role ${role.code} dibuat.`);
    } else {
      // Sync permissions for system roles to include new menu-based keys
      await prisma.$executeRawUnsafe(
        `UPDATE role_masters 
         SET name = $1, description = $2, permissions = $3, "updatedAt" = NOW()
         WHERE code = $4`,
        role.name,
        role.description,
        role.permissions,
        role.code
      );
      console.log(` - Role ${role.code} disinkronkan dengan hak akses menu baru.`);
    }
  }

  console.log('Setup Role Masters selesai dengan sukses!');
}

if (require.main === module) {
  setupRolesTable()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error setup roles:', err);
      process.exit(1);
    });
}

module.exports = {
  ALL_PERMISSIONS,
  INITIAL_ROLES,
  setupRolesTable,
};

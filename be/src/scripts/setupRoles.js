const prisma = require('../config/prisma');

const ALL_PERMISSIONS = [
  { key: 'DASHBOARD_ADMIN', module: 'Super Admin', name: 'Dashboard Super Admin', description: 'Akses overview KPI sistem, lokasi, dan pengguna pusat', path: '/admin/dashboard' },
  { key: 'MASTER_USERS', module: 'Super Admin', name: 'Master Pengguna (Users)', description: 'Kelola data pengguna, penetapan peran, dan status akun', path: '/admin/users' },
  { key: 'MASTER_LOCATIONS', module: 'Super Admin', name: 'Master Unit & Titik Vault', description: 'Kelola lokasi Head Office dan Outlet Hub', path: '/admin/locations' },
  { key: 'MASTER_ROLES', module: 'Super Admin', name: 'Master Peran & Hak Akses', description: 'Kelola definisi peran dan izin akses dinamis sistem', path: '/admin/roles' },
  { key: 'DASHBOARD_HO', module: 'Head Office', name: 'Dashboard Vault HO Central', description: 'Akses dashboard pusat penyimpanan emas HO', path: '/ho/dashboard' },
  { key: 'HO_CABINETS', module: 'Head Office', name: '32 Lemari & Slot Modular', description: 'Akses & konfigurasi lemari besi, slot modular, dan laci HO', path: '/ho/cabinets' },
  { key: 'HO_INVENTORY', module: 'Head Office', name: 'Inventori Emas & Cetak QR', description: 'Inbound penerimaan emas, pelabelan stiker QR, dan stok', path: '/ho/inventory' },
  { key: 'HO_ORDERS', module: 'Head Office', name: 'Purchase Order & Picking', description: 'Proses alokasi, picking QR, dan distribusi emas ke outlet', path: '/ho/orders' },
  { key: 'DASHBOARD_OUTLET', module: 'Outlet Hub', name: 'Dashboard Outlet Hub', description: 'Akses tracking RFID keping emas di cabang pembantu', path: '/outlet/dashboard' },
  { key: 'AUDIT_LOG', module: 'Audit & Compliance', name: 'Audit Trail & Log Aktivitas', description: 'Monitoring rekaman aktivitas dan log keamanan sistem', path: '/audit' },
];

const INITIAL_ROLES = [
  {
    code: 'SUPER_ADMIN',
    name: 'Super Admin (Pusat)',
    description: 'Akses penuh tanpa batas ke seluruh konfigurasi, master data, dan modul sistem',
    permissions: ALL_PERMISSIONS.map(p => p.key),
    isSystem: true,
  },
  {
    code: 'HO_SUPERVISOR',
    name: 'HO Supervisor (Vault HO Central)',
    description: 'Pengawas operasional vault HO, persetujuan PO, dan konfigurasi modular laci',
    permissions: ['DASHBOARD_HO', 'HO_CABINETS', 'HO_INVENTORY', 'HO_ORDERS', 'AUDIT_LOG'],
    isSystem: true,
  },
  {
    code: 'HO_STAFF',
    name: 'HO Staff Vault (Inbound & QR)',
    description: 'Petugas fisik vault HO, penerimaan barang inbound, dan pelabelan QR code',
    permissions: ['DASHBOARD_HO', 'HO_CABINETS', 'HO_INVENTORY'],
    isSystem: true,
  },
  {
    code: 'HO_LOGISTICS',
    name: 'HO Logistics (Distribusi PO)',
    description: 'Petugas logistik pengiriman barang dan picking PO antar unit',
    permissions: ['DASHBOARD_HO', 'HO_ORDERS'],
    isSystem: true,
  },
  {
    code: 'OUTLET_SUPERVISOR',
    name: 'Outlet Supervisor',
    description: 'Penyelia operasional vault cabang/outlet dan verifikasi mutasi emas',
    permissions: ['DASHBOARD_OUTLET', 'AUDIT_LOG'],
    isSystem: true,
  },
  {
    code: 'OUTLET_STAFF',
    name: 'Outlet Staff',
    description: 'Petugas operasional harian outlet dan pelayanan nasabah gadai',
    permissions: ['DASHBOARD_OUTLET'],
    isSystem: true,
  },
  {
    code: 'OUTLET_PETUGAS',
    name: 'Outlet Petugas Lapangan (RFID)',
    description: 'Petugas pemindaian RFID fisik dan penempatan emas di laci cabang',
    permissions: ['DASHBOARD_OUTLET'],
    isSystem: true,
  },
  {
    code: 'SPI_AUDITOR',
    name: 'Satuan Pengawas Internal (Auditor)',
    description: 'Auditor kepatuhan dan audit trail log operasional seluruh unit',
    permissions: ['AUDIT_LOG', 'DASHBOARD_HO', 'DASHBOARD_OUTLET'],
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

  console.log('2. Mendaftarkan peran awal (seeding default roles)...');
  for (const role of INITIAL_ROLES) {
    const existing = await prisma.$queryRawUnsafe(
      'SELECT id FROM role_masters WHERE code = $1 LIMIT 1',
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
      console.log(` - Role ${role.code} sudah ada.`);
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

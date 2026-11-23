const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('--- Memulai Seeding Database Pegadaian Enterprise Smart Vault ---');

  // 1. Bersihkan data lama jika ada (urutan penghapusan sesuai relasi)
  console.log('1. Membersihkan data lama...');
  await prisma.auditTrail.deleteMany();
  await prisma.itemHistory.deleteMany();
  await prisma.pOItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.item.deleteMany();
  await prisma.drawer.deleteMany();
  await prisma.cabinetSlot.deleteMany();
  await prisma.cabinet.deleteMany();
  await prisma.user.deleteMany();
  await prisma.location.deleteMany();

  // 2. Buat Lokasi (HO & Outlet)
  console.log('2. Mendaftarkan Lokasi HO & Outlet...');
  const hoLocation = await prisma.location.create({
    data: {
      id: 'loc-ho-central',
      code: 'HO-CENTRAL',
      name: 'Head Office Pegadaian Vault HO Central',
      type: 'HEAD_OFFICE',
      address: 'Jl. Kramat Raya No. 162, Jakarta Pusat 10430',
    },
  });

  const outletKramat = await prisma.location.create({
    data: {
      id: 'loc-outlet-kramat',
      code: 'OUTLET-KRAMAT',
      name: 'Pegadaian Cabang Pembantu Kramat Raya',
      type: 'OUTLET_HUB',
      address: 'Jl. Kramat Raya No. 164, Jakarta Pusat',
    },
  });

  const outletSenen = await prisma.location.create({
    data: {
      id: 'loc-outlet-senen',
      code: 'OUTLET-SENEN',
      name: 'Pegadaian Kantor Cabang Senen',
      type: 'OUTLET_HUB',
      address: 'Jl. Senen Raya No. 12, Jakarta Pusat',
    },
  });

  // 3. Buat Pengguna Default (RBAC Multi-Level)
  console.log('3. Mendaftarkan Akun Pengguna RBAC...');
  const salt = await bcrypt.genSalt(10);
  const defaultPasswordHash = await bcrypt.hash('Password123!', salt);

  const users = [
    {
      username: 'admin',
      fullName: 'Super Administrator',
      role: 'SUPER_ADMIN',
      locationId: hoLocation.id,
    },
    {
      username: 'ho.spv',
      fullName: 'Bambang Hartono (Supervisor HO)',
      role: 'HO_SUPERVISOR',
      locationId: hoLocation.id,
    },
    {
      username: 'ho.staff',
      fullName: 'Dewi Lestari (Staff Inbound HO)',
      role: 'HO_STAFF',
      locationId: hoLocation.id,
    },
    {
      username: 'ho.logistics',
      fullName: 'Agus Santoso (Petugas Logistik HO)',
      role: 'HO_LOGISTICS',
      locationId: hoLocation.id,
    },
    {
      username: 'outlet.spv',
      fullName: 'Wahyudi Pratama (Supervisor Outlet)',
      role: 'OUTLET_SUPERVISOR',
      locationId: outletKramat.id,
    },
    {
      username: 'outlet.staff',
      fullName: 'Siti Rahma (Staff Bisnis Outlet)',
      role: 'OUTLET_STAFF',
      locationId: outletKramat.id,
    },
    {
      username: 'outlet.petugas',
      fullName: 'Rizky Fadilah (Petugas Vault Outlet)',
      role: 'OUTLET_PETUGAS',
      locationId: outletKramat.id,
    },
    {
      username: 'spi.auditor',
      fullName: 'Ir. Hendra Gunawan (Auditor Internal SPI)',
      role: 'SPI_AUDITOR',
      locationId: hoLocation.id,
    },
  ];

  for (const u of users) {
    await prisma.user.create({
      data: {
        ...u,
        passwordHash: defaultPasswordHash,
      },
    });
  }

  // 4. Buat 32 Lemari Besi di Head Office (HO)
  console.log('4. Menginisialisasi 32 Lemari Besi Vault HO...');
  const cabinets = [];

  for (let c = 1; c <= 32; c++) {
    const cabNum = String(c).padStart(2, '0');
    const cabCode = `HO-CAB-${cabNum}`;
    const cabQr = `QR-CAB-HO-${cabNum}`;

    const cab = await prisma.cabinet.create({
      data: {
        code: cabCode,
        name: `Lemari Besi Vault ${cabNum} (HO)`,
        locationId: hoLocation.id,
        qrCode: cabQr,
        totalSlots: 8,
        description: `Lemari Vault Grade V Khusus HO - Kompartemen Modular 8 Slot`,
      },
    });

    // Setiap lemari memiliki 8 slot modular:
    // Slot 1-6: BIG_DRAWER (1 Laci Besar per slot)
    // Slot 7-8: SMALL_CLUSTER (8 Laci Kecil per slot)
    for (let s = 1; s <= 8; s++) {
      const isSmallCluster = s >= 7;
      const modularType = isSmallCluster ? 'SMALL_CLUSTER' : 'BIG_DRAWER';

      const slot = await prisma.cabinetSlot.create({
        data: {
          slotNumber: s,
          cabinetId: cab.id,
          modularType,
        },
      });

      if (!isSmallCluster) {
        // 1 Laci Besar
        await prisma.drawer.create({
          data: {
            code: `${cabCode}-SL0${s}-DRW-BIG`,
            name: `Laci Besar S0${s} (${cabCode})`,
            slotId: slot.id,
            qrCode: `QR-${cabCode}-SL0${s}-BIG`,
            category: 'Emas Batangan Besar (>= 25g)',
            capacity: 24,
            rows: 4,
            cols: 6,
          },
        });
      } else {
        // 8 Laci Kecil dalam 1 slot
        for (let k = 1; k <= 8; k++) {
          await prisma.drawer.create({
            data: {
              code: `${cabCode}-SL0${s}-DRW-S0${k}`,
              name: `Laci Kecil S0${s} Cluster ${k} (${cabCode})`,
              slotId: slot.id,
              qrCode: `QR-${cabCode}-SL0${s}-S0${k}`,
              category: 'Emas Pecahan Retail (0.5g - 10g)',
              capacity: 12,
              rows: 3,
              cols: 4,
            },
          });
        }
      }
    }

    cabinets.push(cab);
  }

  // 5. Inisialisasi Keping Emas di Lemari HO (Contoh di HO-CAB-01 dan HO-CAB-02)
  console.log('5. Mengisi Stok Awal Keping Emas di Lemari HO...');
  const firstCabDrawers = await prisma.drawer.findMany({
    where: { slot: { cabinet: { code: 'HO-CAB-01' } } },
    take: 5,
  });

  const sampleGoldItems = [
    {
      id: 'E0040001',
      brand: 'ANTAM 10 g',
      weight: 10.0,
      purity: '999.9',
      sbgNumber: 'SBG-HO-2026-001',
      drawerId: firstCabDrawers[0]?.id,
      slotPosition: 'SLOT-01',
    },
    {
      id: 'E0040002',
      brand: 'ANTAM 5 g',
      weight: 5.0,
      purity: '999.9',
      sbgNumber: 'SBG-HO-2026-002',
      drawerId: firstCabDrawers[0]?.id,
      slotPosition: 'SLOT-02',
    },
    {
      id: 'E0040003',
      brand: 'UBS 25 g',
      weight: 25.0,
      purity: '999.9',
      sbgNumber: 'SBG-HO-2026-003',
      drawerId: firstCabDrawers[1]?.id,
      slotPosition: 'SLOT-01',
    },
    {
      id: 'E0040004',
      brand: 'ANTAM 50 g',
      weight: 50.0,
      purity: '999.9',
      sbgNumber: 'SBG-HO-2026-004',
      drawerId: firstCabDrawers[1]?.id,
      slotPosition: 'SLOT-02',
    },
    {
      id: 'E0040005',
      brand: 'Galeri24 10 g',
      weight: 10.0,
      purity: '999.9',
      sbgNumber: 'SBG-HO-2026-005',
      drawerId: firstCabDrawers[2]?.id,
      slotPosition: 'SLOT-01',
    },
    {
      id: 'E0040006',
      brand: 'ANTAM 100 g',
      weight: 100.0,
      purity: '999.9',
      sbgNumber: 'SBG-HO-2026-006',
      drawerId: firstCabDrawers[2]?.id,
      slotPosition: 'SLOT-02',
    },
    {
      id: 'E0040007',
      brand: 'UBS 10 g',
      weight: 10.0,
      purity: '999.9',
      sbgNumber: 'SBG-HO-2026-007',
      drawerId: firstCabDrawers[3]?.id,
      slotPosition: 'SLOT-01',
    },
    {
      id: 'E0040008',
      brand: 'Galeri24 5 g',
      weight: 5.0,
      purity: '999.9',
      sbgNumber: 'SBG-HO-2026-008',
      drawerId: firstCabDrawers[3]?.id,
      slotPosition: 'SLOT-02',
    },
    {
      id: 'E0040009',
      brand: 'ANTAM 25 g',
      weight: 25.0,
      purity: '999.9',
      sbgNumber: 'SBG-HO-2026-009',
      drawerId: firstCabDrawers[4]?.id,
      slotPosition: 'SLOT-01',
    },
    {
      id: 'E0040010',
      brand: 'ANTAM 10 g',
      weight: 10.0,
      purity: '999.9',
      sbgNumber: 'SBG-HO-2026-010',
      drawerId: firstCabDrawers[4]?.id,
      slotPosition: 'SLOT-02',
    },
  ];

  for (const item of sampleGoldItems) {
    const qrPayload = `PGD-QR-HO-${item.id}-${item.weight}G-9999`;
    const createdItem = await prisma.item.create({
      data: {
        id: item.id,
        qrCode: qrPayload,
        brand: item.brand,
        weight: item.weight,
        purity: item.purity,
        sbgNumber: item.sbgNumber,
        currentStatus: 'IN_HO',
        drawerId: item.drawerId,
        slotPosition: item.slotPosition,
        notes: 'Penerimaan batch perdana vault HO',
      },
    });

    await prisma.itemHistory.create({
      data: {
        itemId: createdItem.id,
        event: 'HO_INBOUND',
        actor: 'ho.staff',
        locationCode: 'HO-CENTRAL',
        details: `Keping emas ${createdItem.id} (${createdItem.brand}) diregistrasi di HO dan dialokasikan ke ${item.slotPosition}. QR Code: ${qrPayload}`,
      },
    });
  }

  // 6. Buat Contoh Purchase Order (PO) Aktif
  console.log('6. Membuat Dokumen PO Distribusi Perdana...');
  const samplePO = await prisma.purchaseOrder.create({
    data: {
      id: 'PO-202611-0001',
      sourceLocId: hoLocation.id,
      destLocId: outletKramat.id,
      status: 'APPROVED',
      trackingNumber: 'MANIFEST-EXP-202611001',
      requestedBy: 'outlet.staff',
      approvedBy: 'ho.spv',
      notes: 'Permintaan restok emas 10g & 25g untuk pesanan nasabah di CP Kramat Raya',
    },
  });

  // Hubungkan keping E0040009 ke PO ini
  await prisma.pOItem.create({
    data: {
      poId: samplePO.id,
      itemId: 'E0040009',
    },
  });

  // Update item E0040009 status to ALLOCATED_PO
  await prisma.item.update({
    where: { id: 'E0040009' },
    data: { currentStatus: 'ALLOCATED_PO' },
  });

  // 7. Audit Trail
  console.log('7. Mencatat Log Audit Perdana...');
  await prisma.auditTrail.create({
    data: {
      action: 'SYSTEM_INITIALIZATION',
      actor: 'system',
      locationCode: 'HO-CENTRAL',
      details: 'Inisialisasi sistem vault HO: 32 lemari besi modular, 10 item emas, dan akun pengguna aktif.',
    },
  });

  console.log('=== SEEDING SELESAI DENGAN SUKSES! ===');
  console.log('Kredensial Default Login:');
  console.log('  - Super Admin   : admin / Password123!');
  console.log('  - HO Supervisor : ho.spv / Password123!');
  console.log('  - HO Staff      : ho.staff / Password123!');
  console.log('  - HO Logistik   : ho.logistics / Password123!');
  console.log('  - Outlet SPV    : outlet.spv / Password123!');
  console.log('  - Outlet Staff  : outlet.staff / Password123!');
  console.log('  - Outlet Petugas: outlet.petugas / Password123!');
  console.log('  - Auditor SPI   : spi.auditor / Password123!');
}

main()
  .catch((e) => {
    console.error('Error saat seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

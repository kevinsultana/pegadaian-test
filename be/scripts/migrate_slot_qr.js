const prisma = require('../src/config/prisma');

async function migrate() {
  console.log('Adding columns...');
  await prisma.$executeRawUnsafe('ALTER TABLE cabinet_slots ADD COLUMN IF NOT EXISTS "qrCode" TEXT;');
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS cabinet_slots_qr_code_key ON cabinet_slots ("qrCode");');
  await prisma.$executeRawUnsafe('ALTER TABLE po_items ADD COLUMN IF NOT EXISTS "isPicked" BOOLEAN DEFAULT false;');
  await prisma.$executeRawUnsafe('ALTER TABLE po_items ADD COLUMN IF NOT EXISTS "pickedAt" TIMESTAMP(3);');
  console.log('Columns added successfully.');

  const count = await prisma.$executeRawUnsafe(`
    UPDATE cabinet_slots 
    SET "qrCode" = 'QR-' || cabinets.code || '-SLOT-' || LPAD(cabinet_slots."slotNumber"::text, 2, '0')
    FROM cabinets 
    WHERE cabinet_slots."cabinetId" = cabinets.id AND cabinet_slots."qrCode" IS NULL;
  `);
  console.log('Populated slot qrCode rows:', count);

  const sample = await prisma.cabinetSlot.findFirst({
    where: { slotNumber: 7, cabinet: { code: 'HO-CAB-01' } },
    select: { id: true, slotNumber: true, qrCode: true, cabinet: { select: { code: true } } }
  });
  console.log('Verified sample HO-CAB-01 Slot 7:', sample);
}

migrate().catch(console.error).finally(() => process.exit());

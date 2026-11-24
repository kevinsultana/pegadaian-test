const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function exec(sql, label) {
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log(`✓ ${label}`);
  } catch (err) {
    if (err.message && (err.message.includes('already exists') || err.message.includes('IF NOT EXISTS'))) {
      console.log(`~ ${label} (already exists)`);
    } else {
      console.error(`✗ ${label}:`, err.message);
      throw err;
    }
  }
}

async function main() {
  console.log('Migrating database for Stock Verification & Restock Mitigations...');

  // 1. Add WAITING_RESTOCK enum value
  await exec(`ALTER TYPE "POStatus" ADD VALUE IF NOT EXISTS 'WAITING_RESTOCK'`, 'Add WAITING_RESTOCK enum value');

  // 2. Add columns to purchase_orders
  await exec(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "hoNote" TEXT`, 'Add hoNote column to purchase_orders');

  // 3. Add columns to po_request_lines
  await exec(`ALTER TABLE po_request_lines ADD COLUMN IF NOT EXISTS "qtyApproved" INTEGER`, 'Add qtyApproved column to po_request_lines');

  console.log('✅ Migration done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

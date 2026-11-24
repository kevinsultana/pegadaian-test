/**
 * Manual migration script: Update POStatus enum and add PORequestLine table
 * Run from be/ directory: node scripts/migrate_po_status.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function exec(sql, label) {
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log(`✓ ${label}`);
  } catch (err) {
    if (err.message && (err.message.includes('already exists') || err.message.includes('IF NOT EXISTS'))) {
      console.log(`~ ${label} (skipped - already exists)`);
    } else {
      console.error(`✗ ${label}:`, err.message);
      throw err;
    }
  }
}

async function main() {
  console.log('Starting migration...\n');

  // Step 1: Add new enum values one by one
  await exec(`ALTER TYPE "POStatus" ADD VALUE IF NOT EXISTS 'DRAFT'`, 'Add DRAFT enum value');
  await exec(`ALTER TYPE "POStatus" ADD VALUE IF NOT EXISTS 'PENDING_OUTLET_SPV'`, 'Add PENDING_OUTLET_SPV enum value');
  await exec(`ALTER TYPE "POStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED_TO_HO'`, 'Add SUBMITTED_TO_HO enum value');
  await exec(`ALTER TYPE "POStatus" ADD VALUE IF NOT EXISTS 'APPROVED_HO'`, 'Add APPROVED_HO enum value');
  await exec(`ALTER TYPE "POStatus" ADD VALUE IF NOT EXISTS 'PARTIAL_HOLD'`, 'Add PARTIAL_HOLD enum value');

  // Step 2: Migrate existing PO status values
  await exec(`UPDATE purchase_orders SET status = 'SUBMITTED_TO_HO' WHERE status = 'REQUESTED'`, 'Migrate REQUESTED → SUBMITTED_TO_HO');
  await exec(`UPDATE purchase_orders SET status = 'APPROVED_HO' WHERE status = 'APPROVED'`, 'Migrate APPROVED → APPROVED_HO');

  // Step 3: Add new columns to purchase_orders
  await exec(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "outletApprovedBy" TEXT`, 'Add outletApprovedBy column');
  await exec(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "hoApprovedBy" TEXT`, 'Add hoApprovedBy column');
  await exec(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "kurirName" TEXT`, 'Add kurirName column');
  await exec(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "vehicleNumber" TEXT`, 'Add vehicleNumber column');
  await exec(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "pickerName" TEXT`, 'Add pickerName column');
  await exec(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "partialDispatchNote" TEXT`, 'Add partialDispatchNote column');

  // Migrate approvedBy → hoApprovedBy
  await exec(`UPDATE purchase_orders SET "hoApprovedBy" = "approvedBy" WHERE "approvedBy" IS NOT NULL`, 'Migrate approvedBy → hoApprovedBy');

  // Step 4: Create po_request_lines table
  await exec(`
    CREATE TABLE IF NOT EXISTS po_request_lines (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "poId" TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      "goldBrand" TEXT NOT NULL,
      "weightGrams" DOUBLE PRECISION NOT NULL,
      "qtyRequested" INTEGER NOT NULL,
      "qtyFulfilled" INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `, 'Create po_request_lines table');

  console.log('\n✅ Migration complete!');
  console.log('Now run: npx prisma generate');
}

main()
  .catch((e) => { console.error('\n❌ Migration failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());

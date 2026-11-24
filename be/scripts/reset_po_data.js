const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Checking current PO data...');

  const poCount = await prisma.purchaseOrder.count();
  const lineCount = await prisma.pORequestLine.count();
  const poItemCount = await prisma.pOItem.count();
  console.log(`Found: ${poCount} POs, ${lineCount} request lines, ${poItemCount} PO items`);

  // 1. Reset all items that were allocated or moved in tests back to IN_HO
  const resetItems = await prisma.item.updateMany({
    where: {
      currentStatus: {
        in: ['ALLOCATED_PO', 'IN_TRANSIT', 'IN_OUTLET'],
      },
      drawerId: { not: null },
    },
    data: {
      currentStatus: 'IN_HO',
    },
  });
  console.log(`Reset ${resetItems.count} items back to IN_HO status`);

  // 2. Delete all PO Items
  const deletedPoItems = await prisma.pOItem.deleteMany({});
  console.log(`Deleted ${deletedPoItems.count} PO items`);

  // 3. Delete all PO Request Lines
  const deletedLines = await prisma.pORequestLine.deleteMany({});
  console.log(`Deleted ${deletedLines.count} PO request lines`);

  // 4. Delete all Purchase Orders
  const deletedPOs = await prisma.purchaseOrder.deleteMany({});
  console.log(`Deleted ${deletedPOs.count} Purchase Orders`);

  console.log('✅ All PO data has been completely cleared and items restored to HO cabinets!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

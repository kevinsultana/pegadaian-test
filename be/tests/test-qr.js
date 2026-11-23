const {
  generateQrDataUrl,
  buildItemQrPayload,
  buildCabinetQrPayload,
  buildDrawerQrPayload,
} = require('../src/utils/qrcode');

async function testQrUtils() {
  console.log('Testing QR Code Utilities...');

  const itemPayload = buildItemQrPayload('E0040001', 'ANTAM 10 g', 10, '999.9', 'SBG-00121');
  if (!itemPayload.includes('E0040001')) throw new Error('Item payload failed');

  const cabPayload = buildCabinetQrPayload('HO-CAB-01');
  if (!cabPayload.includes('HO-CAB-01')) throw new Error('Cabinet payload failed');

  const drwPayload = buildDrawerQrPayload('HO-CAB-01-SL01-DRW-BIG');
  if (!drwPayload.includes('HO-CAB-01-SL01-DRW-BIG')) throw new Error('Drawer payload failed');

  const qrImage = await generateQrDataUrl(itemPayload);
  if (!qrImage.startsWith('data:image/png;base64,')) throw new Error('QR Image format invalid');

  console.log('✔ All QR code utilities passed!');
}

testQrUtils().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

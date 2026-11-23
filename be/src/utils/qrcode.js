const QRCode = require('qrcode');

/**
 * Generate QR Code as Data URL (Base64 PNG) for label printing
 * @param {string} text - Payload to encode
 * @returns {Promise<string>} Data URL
 */
const generateQrDataUrl = async (text) => {
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      margin: 2,
      width: 250,
      color: {
        dark: '#0f233a',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Error generating QR code:', err);
    throw err;
  }
};

/**
 * Build standard QR payload for Gold Items in HO
 */
const buildItemQrPayload = (itemId, brand, weight, purity, serialNumber = '') => {
  return `PGD-HO-GOLD:${itemId}|${brand}|${weight}G|${purity}|${serialNumber || itemId}`;
};

/**
 * Build standard QR payload for Cabinets in HO
 */
const buildCabinetQrPayload = (cabinetCode) => {
  return `PGD-HO-CAB:${cabinetCode}`;
};

/**
 * Build standard QR payload for Drawers in HO
 */
const buildDrawerQrPayload = (drawerCode) => {
  return `PGD-HO-DRW:${drawerCode}`;
};

module.exports = {
  generateQrDataUrl,
  buildItemQrPayload,
  buildCabinetQrPayload,
  buildDrawerQrPayload,
};

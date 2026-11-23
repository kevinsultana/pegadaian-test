const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Pegadaian Smart Vault Enterprise API',
      version: '1.0.0',
      description: `
Dokumentasi Resmi REST API **Pegadaian Smart Vault Management**.
Sistem manajemen vault emas terintegrasi antara **Head Office (HO Central - QR Code)** dan **Outlet Hub (Cabang - RFID Tracking)**.

### Peran Pengguna (RBAC):
- **SUPER_ADMIN**: Hak akses penuh (kelola user, lokasi, HO, outlet)
- **HO_SUPERVISOR**: Persetujuan PO, konversi slot modular, kustomisasi laci
- **HO_STAFF**: Inbound emas, generate QR code, penataan laci
- **HO_LOGISTICS**: Pengambilan (picking) dan ekspedisi distribusi emas ke outlet
- **OUTLET_SUPERVISOR**: Pembuatan PO permintaan emas & persetujuan tebusan
- **OUTLET_STAFF**: Pendaftaran tebusan & transaksi nasabah
- **OUTLET_PETUGAS**: Tagging RFID & pemindahan keping ke parking lot matrix
- **SPI_AUDITOR**: Audit trail seluruh log transaksi & keamanan
      `,
      contact: {
        name: 'Tim Teknologi Informasi PT Pegadaian (Persero)',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000/api',
        description: 'Development Server (Local)',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Masukkan Token JWT hasil login: Bearer <token>',
        },
      },
      schemas: {
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', example: 'admin' },
            password: { type: 'string', example: 'Password123!' },
          },
        },
        CreateUserRequest: {
          type: 'object',
          required: ['username', 'password', 'fullName', 'role', 'locationId'],
          properties: {
            username: { type: 'string', example: 'ahmad.spv' },
            password: { type: 'string', example: 'Password123!' },
            fullName: { type: 'string', example: 'Ahmad Dahlan' },
            role: {
              type: 'string',
              enum: [
                'SUPER_ADMIN',
                'HO_SUPERVISOR',
                'HO_STAFF',
                'HO_LOGISTICS',
                'OUTLET_SUPERVISOR',
                'OUTLET_STAFF',
                'OUTLET_PETUGAS',
                'SPI_AUDITOR',
              ],
              example: 'HO_STAFF',
            },
            locationId: { type: 'string', example: 'loc-ho-central' },
          },
        },
        InboundGoldRequest: {
          type: 'object',
          required: ['serialNumber', 'goldType', 'weightGrams', 'drawerCode', 'slotPosition'],
          properties: {
            serialNumber: { type: 'string', example: 'LM-2026-8801' },
            goldType: { type: 'string', example: 'ANTAM_BAR' },
            weightGrams: { type: 'number', example: 10 },
            purity: { type: 'string', example: '99.99%' },
            drawerCode: { type: 'string', example: 'HO-CAB-01-SL01-DRW-BIG' },
            slotPosition: { type: 'integer', example: 1 },
            notes: { type: 'string', example: 'Penerimaan batch emas baru HO' },
          },
        },
        ModularSwitchRequest: {
          type: 'object',
          required: ['targetModularType'],
          properties: {
            targetModularType: {
              type: 'string',
              enum: ['BIG_DRAWER', 'SMALL_CLUSTER'],
              example: 'SMALL_CLUSTER',
            },
          },
        },
        UpdateDrawerCapacityRequest: {
          type: 'object',
          properties: {
            capacity: { type: 'integer', example: 16 },
            rows: { type: 'integer', example: 4 },
            cols: { type: 'integer', example: 4 },
            category: { type: 'string', example: 'Antam & UBS 10g+' },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;

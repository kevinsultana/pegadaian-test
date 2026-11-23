# Pegadaian Enterprise Smart Vault Backend Service
> **Backend API Khazanah Emas Pegadaian (Khusus Head Office - Fase 1)**  
> Dibangun dengan **Express.js (JavaScript)**, **Prisma ORM**, dan **PostgreSQL**.

---

## 1. Persiapan & Konfigurasi Database PostgreSQL

### A. Konfigurasi File `.env`
Buka file `.env` di dalam folder `be/` dan sesuaikan kredensial PostgreSQL server Anda:

```env
PORT=5000
NODE_ENV=development

# Sesuaikan USER, PASSWORD, HOST, PORT, dan NAMA_DATABASE Anda:
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pegadaian_vault?schema=public"

JWT_SECRET="pegadaian_super_secret_jwt_key_2026_unotek_vault"
JWT_EXPIRES_IN="1d"
CORS_ORIGIN="http://localhost:3000"
```

---

## 2. Langkah Instalasi & Menjalankan Service

Di terminal, arahkan ke folder `be/`:

```bash
cd be

# 1. Install seluruh dependencies
npm install

# 2. Generate Prisma Client
npm run prisma:generate

# 3. Sinkronisasi Skema Database ke PostgreSQL (Otomatis membuat tabel-tabel)
npm run prisma:push

# 4. Jalankan Seeder Otomatis (Mengisi 32 Lemari Besi HO, Akun RBAC, & Emas Contoh)
npm run prisma:seed

# 5. Jalankan Backend Server
npm run dev
```

Server akan aktif di: **`http://localhost:5000`**

---

## 3. Akun Pengguna Default (Hasil Seeder)

Semua akun default menggunakan password: **`Password123!`**

| Username | Peran (RBAC) | Lokasi | Deskripsi Tugas |
| :--- | :--- | :--- | :--- |
| `admin` | `SUPER_ADMIN` | Global | Kelola seluruh sistem, user, & master data. |
| `ho.spv` | `HO_SUPERVISOR` | HO Central | Otorisasi PO & konfigurasi 32 lemari besi HO. |
| `ho.staff` | `HO_STAFF` | HO Central | Pendaftaran emas masuk & cetak label QR Code. |
| `ho.logistics` | `HO_LOGISTICS` | HO Central | Picking barang pesanan & cetak Surat Jalan. |
| `outlet.spv` | `OUTLET_SUPERVISOR` | Outlet Kramat | Supervisor cabang pembantu. |
| `outlet.staff` | `OUTLET_STAFF` | Outlet Kramat | Staff bisnis penerima barang & pairing RFID. |
| `outlet.petugas` | `OUTLET_PETUGAS` | Outlet Kramat | Petugas vault fisik cabang. |
| `spi.auditor` | `SPI_AUDITOR` | HO Central | Auditor internal pengawasan read-only. |

---

## 4. Daftar Endpoint API (Fase 1: Head Office)

Semua endpoint dilindungi JWT kecuali endpoint login dan health-check. Sertakan header:  
`Authorization: Bearer <TOKEN>`

### A. Autentikasi
* `POST /api/auth/login` : Login user (mengembalikan Token JWT & profil).
* `GET /api/auth/me` : Ambil profil user yang sedang login.

### B. Master 32 Lemari Besi HO
* `GET /api/ho/cabinets` : Ambil daftar 32 lemari besi HO lengkap dengan statistik okupansi, jumlah slot, dan laci.
* `GET /api/ho/cabinets/:code` : Ambil detail lemari tertentu (contoh: `/api/ho/cabinets/HO-CAB-01`) beserta 8 slot modular dan laci-lacinya.
* `GET /api/ho/drawers/:drawerCode` : Ambil detail laci tertentu beserta keping emas di dalamnya.
* `PATCH /api/ho/cabinets/:cabinetCode/slots/:slotNumber/modular-type` : **(Khusus HO Supervisor)** Mengubah tipe modular slot antara `BIG_DRAWER` (1 Laci Besar) $\leftrightarrow$ `SMALL_CLUSTER` (8 Laci Kecil).

### C. Inventori & Registrasi Emas Pusat (QR Code)
* `GET /api/ho/stats` : Ringkasan KPI dashboard HO (total gramatur emas, total keping, breakdown merek).
* `GET /api/ho/items` : Ambil katalog inventori emas di HO (bisa filter `?brand=ANTAM`, `?cabinetCode=HO-CAB-01`, `?search=...`).
* `POST /api/ho/items/inbound` : Mendaftarkan keping emas baru masuk ke HO, generate payload QR Code, dan tempatkan di laci lemari.
* `GET /api/ho/items/scan?qrPayload=...` : Scan QR Code fisik untuk melacak keberadaan keping emas di lemari HO.
* `GET /api/ho/items/:itemId/label` : Ambil data label cetak keping emas beserta **QR Code Image (Data URL)** beresolusi tinggi siap cetak.

### D. Checkout & Pemotongan Stok HO (PO Fulfillment)
* `GET /api/ho/pos` : Ambil antrean PO dari outlet yang disetujui untuk di-picking.
* `POST /api/ho/checkout-item` : **(Pemotongan Stok Otomatis)** Petugas logistik scan QR Code keping emas di lemari HO $\rightarrow$ keping emas terlepas dari laci lemari $\rightarrow$ status beralih menjadi `IN_TRANSIT`.
* `POST /api/ho/pos/:poId/dispatch` : Terbitkan nomor Surat Jalan / Manifest Ekspedisi dan berangkatkan pesanan.

### E. Audit Trail & Log
* `GET /api/audit` : Memeriksa jejak audit digital kronologis seluruh aktivitas sistem.

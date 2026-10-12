# PRD — PT. VRCHINDO Digital Solutions ERP

## Original problem statement
Buatkan saya aplikasi untuk pendataan gudang dan juga data pengiriman paket internal yang dapat terintegrasi langsung dengan beberapa marketplace seperti situs BIG SELLER https://www.bigseller.com/web/statis/board.htm yang dimana nantinya aplikasi tersebut dapat di gunakan oleh berbagai marketplace dengan beberapa akun berbeda yang dapat terintegrasi langsung pada masing masing marketplace dengan cara login akun sehingga dapat memanage semua pesanan dan juga pesan chat masuk hanya dalam 1 aplikasi dashboard yang kita buat saat ini.
- Pastikan sheet online dan Data Internal dipisahkan
- Data Internal hanya Data GUDANG & Pengiriman Paket. Selebihnya Semua seperti BIG SELLER dapat setting Promo, Harga, Diskon, Deskripsi dan sebagainya.
- Data Internal GUDANG berjalan ada di spreadsheet (Google Sheet 1UhaT5RT...) silahkan kamu analisa semua sheet dan juga rumus logic yang ada serta logic UI UX nya seperti Formula bersyarat dan sebagainya.
- Buatkan juga saya Aplikasi versi mobile App nya juga agar dapat di install pada Mobile App agar lebih mobilitas.
(+ attached PRD-Pengiriman-Paket.md, implementation_plan.md, AGENTS.md, ERP PRD; screenshot of existing ERP UI)

User choices: marketplace = DEMO first (real Partner API later); internal data in app DB + CSV/Excel import (sheet not public); mobile = PWA + Expo native; auth = JWT (Admin/Staff, admin-created) + Emergent Google login; UI follows screenshot + dark mode, keep calculator, clock/date, etc.

## Architecture
- Backend FastAPI: core.py (db, auth helpers), logic.py (resi detection, stock formula), routes_auth / routes_gudang / routes_shipping / routes_marketplace / routes_misc, seed.py
- Collections: users, user_sessions, login_attempts, products, stock_adjustments, packages (submenu: process|pengiriman|cancel|rts), notifications, pos_transactions; marketplace (separate): mp_stores, mp_orders, mp_products, mp_promos, mp_chats
- Frontend React + shadcn, PWA (manifest.json, sw.js, icons)

## User personas
Admin/owner, staff gudang/packing, staff pengiriman, CS marketplace (chat), kasir.

## Core requirements
- Data Internal (Gudang + Pengiriman) separated from Marketplace Online
- Pengiriman rules per PRD: resi detection, DOUBLE → JANGAN DIKIRIMKAN, pengiriman requires process, cancel tindakan sync, risk ≥24h SEGERA KIRIMKAN/BERESIKO TERLAMBAT, ≥48h BESOK BATAL
- Gudang: Stok Riil = Awal + In + Return − Out; status STOCK AMAN / RESTOCK !! / NEW STOCK / STOCK BARANG SUSAH; kondisi PUBLISHED/SLOW MOVING/DEAD STOCK/URGENT

## Implemented (2026-10-12)
- Auth JWT + Google (allow-listed), user management
- Gudang products (image per SKU, import/export), penyesuaian stok
- Pengiriman: process, pengiriman, beresiko, cancel, RTS, dashboard, laporan, KPI w/ kemarin, camera scanner, import/export, clear all
- Marketplace DEMO (MOCKED): toko multi-akun, pesanan, chat inbox, produk & harga (bulk diskon), promo
- POS kasir, dashboard, header calculator/clock/date/dark mode/notifications, PWA installable
- Testing iteration_1: backend 28/28, frontend critical flows pass
- Google Sheet Gudang berhasil dianalisis melalui halaman edit publik: 27 tab terpetakan,
  termasuk master inventory, stok masuk, stok keluar, restock, dan RTS/retur.
- Import CSV/Excel Gudang sekarang kompatibel dengan struktur master sheet yang diawali judul
  laporan: mendeteksi header BARCODE/KODE BARANG dan NAMA, melewati baris satuan, lalu memetakan
  barcode, stok minimum, stok aktual, HPP, harga normal/promo, action summary, supplier, dan
  kondisi produk.
- Untuk impor snapshot master dengan REAL STOCK INVENTORY, stok aplikasi disamakan dengan nilai
  aktual sheet tanpa mengurangkan STOCK KELUAR kedua kali. Form dan tabel Gudang juga mendukung
  Barcode, To Do, supplier, lokasi supplier, harga promo, serta catatan operasional.
- Testing iteration_2: backend dan frontend 100% lulus untuk impor format master, form Gudang,
  dan responsivitas mobile.

## Backlog
- P0: Real marketplace Partner API connectors (needs App Key/Secret per marketplace)
- P1: Verifikasi alur edit password Pengguna serta cetak resi marketplace end-to-end
- P1: Sinkronisasi Google Sheet berkala dua arah (memerlukan akses ekspor stabil atau service
  account; impor Excel/CSV lokal sudah tersedia dan teruji)
- P1: Expo/React Native native app (not built yet; PWA available)
- P2: Purchase orders, akuntansi, CRM modules from implementation_plan

# Telegram Drive Web Server

Telegram Drive Web Server adalah porting dari aplikasi desktop Telegram Drive (Tauri + React + Rust) menjadi aplikasi web mandiri berbasis **Node.js (Express + gram.js)** dan **React (Vite + TypeScript)**. Sangat cocok untuk di-deploy secara lokal atau di server seperti **CasaOS** menggunakan Docker.

## Fitur Utama

- **Penyimpanan Tak Terbatas**: Memanfaatkan penyimpanan cloud gratis dari infrastruktur Telegram.
- **Dua Lapis Keamanan**:
  - **Access Password**: Password pelindung ketika URL Telegram Drive dibuka di public domain.
  - **Telegram Auth**: Keamanan menggunakan flow resmi OTP dan 2FA langsung ke akun Telegram Anda.
- **Manajemen Folder**: Membuat folder baru (sebagai channel private) langsung dari UI Web.
- **Upload & Download**: Upload file menggunakan drag and drop atau file selector dengan progress bar real-time, serta download file langsung ke perangkat.
- **Caching Cepat**: Menggunakan caching berbasis SQLite (`sql.js`) agar navigasi folder dan loading file terasa cepat tanpa membebani limit API Telegram.
- **Siap Docker**: Disediakan `Dockerfile` multi-stage dan `docker-compose.yml` untuk deployment yang mudah dan aman di CasaOS.

---

## Persiapan Awal (Prerequisites)

1. **Telegram API Credentials**:
   Dapatkan `TELEGRAM_API_ID` dan `TELEGRAM_API_HASH` Anda:
   - Login ke [my.telegram.org](https://my.telegram.org).
   - Masuk ke menu **API development tools**.
   - Buat aplikasi baru dan catat API ID serta API Hash Anda.
   
2. **Access Password**:
   Siapkan password rahasia untuk mengunci antarmuka web Anda agar tidak bisa diakses orang lain saat di-hosting di public domain.

---

## Deployment di CasaOS

### Cara 1: Menggunakan App store / Custom Install (Rekomendasi)

1. Masuk ke dashboard CasaOS Anda.
2. Klik **App Store** -> **Custom Install** (di kanan atas).
3. Isi konfigurasi kontainer:
   - **Docker Image**: `irnhakim/telegram-drive-web:latest` (atau build lokal menggunakan Compose di bawah jika belum ter-publish)
   - **App Name**: `Telegram Drive Web`
   - **Port (Host)**: `3001` -> **Target (Container)**: `3001`
   - **Environment Variables**:
     - `TELEGRAM_API_ID` = `[API ID Anda]`
     - `TELEGRAM_API_HASH` = `[API Hash Anda]`
     - `ACCESS_PASSWORD` = `[Password Akses Web Anda]`
   - **Volumes**:
     - Host path: `/DATA/AppData/telegram-drive/data` -> Container path: `/app/data`
4. Klik **Install**.

---

### Cara 2: Docker Compose (Terminal / SSH)

1. Buat folder untuk proyek di server CasaOS Anda:
   ```bash
   mkdir -p /DATA/AppData/telegram-drive
   cd /DATA/AppData/telegram-drive
   ```
2. Buat file `.env` dan isi data berikut:
   ```env
   TELEGRAM_API_ID=12345678         # Ganti dengan API ID Anda
   TELEGRAM_API_HASH=abcdef12345... # Ganti dengan API Hash Anda
   ACCESS_PASSWORD=mysecurepass     # Password untuk login ke web UI Anda
   ```
3. Unduh atau buat file `docker-compose.yml` di folder yang sama:
   ```yaml
   services:
     telegram-drive:
       image: irnhakim/telegram-drive-web:latest # Atau build dari Dockerfile lokal
       container_name: telegram-drive-web
       restart: unless-stopped
       ports:
         - "3001:3001"
       environment:
         - TELEGRAM_API_ID=${TELEGRAM_API_ID}
         - TELEGRAM_API_HASH=${TELEGRAM_API_HASH}
         - ACCESS_PASSWORD=${ACCESS_PASSWORD}
       volumes:
         - ./data:/app/data
   ```
4. Jalankan aplikasi:
   ```bash
   docker compose up -d
   ```
5. Buka browser dan arahkan ke alamat IP server CasaOS Anda di port `3001` (contoh: `http://192.168.1.100:3001`).

---

## Development / Uji Coba Lokal

Jika ingin menjalankan aplikasi secara lokal di komputer Windows/Linux Anda tanpa Docker:

1. Pastikan Anda sudah menginstall **Node.js (v18+)**.
2. Clone repository ini dan masuk ke direktori proyek.
3. Buat file `.env` di root direktori dengan struktur yang sama seperti `.env.example`.
4. Install dependencies backend dan build:
   ```bash
   cd server
   npm install
   npm run build
   ```
5. Install dependencies frontend dan run development server:
   ```bash
   cd ../client
   npm install
   npm run dev
   ```
6. Jalankan backend server:
   ```bash
   cd ../server
   npm run dev
   ```
7. Buka browser di URL yang ditunjukkan oleh terminal (biasanya `http://localhost:5173` untuk dev server client).

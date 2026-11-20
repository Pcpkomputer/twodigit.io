# TikTok Live Voting & Meme SFX Listener 🗳️🔊

Aplikasi Node.js mandiri (standalone) yang menghubungkan komentar TikTok Live secara real-time ke sistem **Live Polling** dan **Meme Soundboard (SFX)** di `twodigit.io`.

---

## 🚀 Cara Penggunaan

### 1. Masuk ke Direktori Listener
```bash
cd tiktok-listener
```

### 2. Install Dependensi (Jika belum)
```bash
npm install
```

### 3. Konfigurasi File `.env`
Buka file `.env` dan sesuaikan nilainya:
```env
# Username akun TikTok yang sedang live (tanpa simbol @)
TIKTOK_USERNAME="username_tiktok_anda"

# URL Backend (gunakan http://localhost:3000 untuk lokal atau domain Vercel Anda)
BACKEND_URL="http://localhost:3000"

# Password yang sama dengan TEST_OVERLAY_PASSWORD di .env.local Next.js
LISTENER_SECRET="p3rw1rapc"

# Durasi global cooldown untuk SFX dalam detik (Opsi 1: Local In-Memory)
SFX_COOLDOWN_SECONDS=30
```

### 4. Jalankan Listener
Pastikan akun TikTok Anda sudah **sedang LIVE** terlebih dahulu, lalu jalankan:
```bash
npm start
```

---

## 💬 Perintah Chat Penonton yang Didukung

### 1. 📊 Live Voting
Penonton mengetik angka pilihan:
- `!1` atau `!2`
- `#1` atau `#2`
- `/1` atau `/2`
- `1` atau `2`

### 2. 🔊 Meme SFX (Freemium Soundboard)
Penonton dapat mengetik perintah efek suara berikut di live chat untuk memicu suara lucu di OBS:
- `!klakson` 🚗 -> Suara Klakson Mobil Klasik
- `!kaget` 😱 -> Suara Jeritan Kaget Lucu
- `!wasted` 💀 -> Efek Suara GTA Wasted
- `!bruh` 🗿 -> Suara Meme Bruh
- `!error` ⚠️ -> Efek Suara Windows Error

---

## ⏱️ Cara Kerja Cooldown (Opsi 1: Local In-Memory)
- **Global Cooldown (Default 30 Detik):** Hanya 1 suara SFX yang dapat berbunyi tiap 30 detik agar stream tidak bising.
- **Per-User Cooldown (45 Detik):** Setiap penonton diberi jeda 45 detik agar penonton lain bergantian.
- **Tanpa Beban Server Vercel:** Jika penonton mengirim chat saat masih dalam waktu cooldown, request langsung ditolak dan di-drop di laptop lokal Anda tanpa memakan bandwidth atau kuota serverless Vercel!
- **Freemium Hook:** Penonton yang tidak sabar menunggu cooldown diarahkan untuk berdonasi via QRIS di **twodigit.io** untuk bypass cooldown.

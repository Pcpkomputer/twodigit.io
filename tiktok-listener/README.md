# TikTok Live Voting Listener 🗳️

Aplikasi Node.js mandiri (standalone) yang menghubungkan komentar TikTok Live secara real-time ke sistem Live Polling di `twodigit.io`.

---

## 🚀 Cara Penggunaan

### 1. Masuk ke Direktori Listener
```bash
cd tiktok-listener
```

### 2. Install Dependensi
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
```

### 4. Jalankan Listener
Pastikan akun TikTok Anda sudah **sedang LIVE** terlebih dahulu, lalu jalankan:
```bash
npm start
```

---

## 💬 Format Komentar Penonton yang Didukung
Penonton cukup mengetik angka opsi di kolom komentar live chat TikTok:
- `!1` atau `!2`
- `#1` atau `#2`
- `/1` atau `/2`
- `1` atau `2`
- `!vote 1` atau `vote 2`

Listener akan otomatis mendeteksi komentar tersebut dan mengirimkannya ke endpoint `/api/poll/vote` di backend twodigit.io.

---

## 🔒 Fitur Pencegah Kecurangan (Anti-Spam)
- Setiap penonton (berdasarkan TikTok `uniqueId`) hanya dihitung **1 kali vote** per sesi voting.
- Jika penonton yang sama mengirim vote lagi, backend akan menolaknya (`status 409`).

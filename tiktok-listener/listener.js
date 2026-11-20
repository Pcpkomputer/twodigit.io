import { TikTokLiveConnection } from "tiktok-live-connector";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME?.replace(/^@/, "").trim();
const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:3000").replace(/\/+$/, "");
const LISTENER_SECRET = process.env.LISTENER_SECRET || "p3rw1rapc";
const SFX_COOLDOWN_SECONDS = parseInt(process.env.SFX_COOLDOWN_SECONDS || "30", 10);
const SFX_COOLDOWN_MS = SFX_COOLDOWN_SECONDS * 1000;

if (!TIKTOK_USERNAME || TIKTOK_USERNAME === "username_streamer") {
  console.error("=====================================================================");
  console.error("⚠️  PERINGATAN: TIKTOK_USERNAME belum diatur di file .env!");
  console.error("Silakan buka file .env dan isi TIKTOK_USERNAME dengan username TikTok Anda.");
  console.error("Contoh: TIKTOK_USERNAME=\"yudhacode\"");
  console.error("=====================================================================");
  process.exit(1);
}

console.log("=====================================================================");
console.log("🎯 TikTok Live Voting & Meme SFX Listener by twodigit.io");
console.log(`📡 Target Streamer   : @${TIKTOK_USERNAME}`);
console.log(`🌐 Backend Server     : ${BACKEND_URL}`);
console.log(`⏱️  Global SFX Cooldown: ${SFX_COOLDOWN_SECONDS} detik (Opsi 1: Local In-Memory)`);
console.log("=====================================================================");

// In-Memory Cooldown Tracker (Option 1: Node.js Local Variable)
let lastGlobalSfxTime = 0;
const userSfxCooldownMap = new Map();

// Supported Meme SFX Commands
const SFX_COMMANDS = {
  "!klakson": { id: "klakson", name: "Klakson Mobil", emoji: "🚗" },
  "klakson": { id: "klakson", name: "Klakson Mobil", emoji: "🚗" },
  "!kaget": { id: "kaget", name: "Jeritan Kaget", emoji: "😱" },
  "kaget": { id: "kaget", name: "Jeritan Kaget", emoji: "😱" },
  "!wasted": { id: "wasted", name: "GTA Wasted", emoji: "💀" },
  "wasted": { id: "wasted", name: "GTA Wasted", emoji: "💀" },
  "!bruh": { id: "bruh", name: "Meme Bruh", emoji: "🗿" },
  "bruh": { id: "bruh", name: "Meme Bruh", emoji: "🗿" },
  "!error": { id: "error", name: "Windows Error", emoji: "⚠️" },
  "error": { id: "error", name: "Windows Error", emoji: "⚠️" },
};

const tiktokLiveConnection = new TikTokLiveConnection(TIKTOK_USERNAME, {
  processInitialData: false,
});

// Regex to capture viewer vote commands:
// Matches: !1, !2, #1, #2, /1, 1, 2, or "!vote 1", "vote 1"
const VOTE_PATTERN = /^(?:[!#\/]?\s*([1-9])|(?:!vote|vote)\s+([1-9]))$/i;

// Connect to TikTok Live
tiktokLiveConnection
  .connect()
  .then((state) => {
    console.log(`\n✅ Terhubung ke TikTok Live! (Room ID: ${state.roomId})`);
    console.log("Menunggu komentar penonton:");
    console.log(" - Live Vote: !1, !2, 1, 2, dll.");
    console.log(" - Meme SFX : !klakson, !kaget, !wasted, !bruh, !error\n");
  })
  .catch((err) => {
    console.error("❌ Gagal terhubung ke TikTok Live:", err.message);
    console.error("Pastikan akun @", TIKTOK_USERNAME, "sedang LIVE dan username benar.");
  });

// Handle incoming chat messages
tiktokLiveConnection.on("chat", async (data) => {
  const comment = (data.content || data.comment || "").trim();
  const lowerComment = comment.toLowerCase();
  const userId = data.user?.displayId || data.user?.uniqueId || data.uniqueId || data.user?.id || "anonymous";
  const nickname = data.user?.nickname || data.nickname || userId;
  const now = Date.now();

  // -------------------------------------------------------------
  // 1. CEK MEME SFX COMMAND (!klakson, !kaget, !wasted, !bruh, dll)
  // -------------------------------------------------------------
  const matchedSfx = SFX_COMMANDS[lowerComment];
  if (matchedSfx) {
    // Cek Global Cooldown (Opsi 1: di lokal)
    const timeSinceLastSfx = now - lastGlobalSfxTime;
    if (timeSinceLastSfx < SFX_COOLDOWN_MS) {
      const remainingSec = Math.ceil((SFX_COOLDOWN_MS - timeSinceLastSfx) / 1000);
      console.log(
        `⏳ [SFX COOLDOWN] @${userId} mencoba ${matchedSfx.name}, sisa cooldown: ${remainingSec}s (request ditolak di lokal)`
      );
      return;
    }

    // Per-User Cooldown (minimal 45 detik antar-pengguna)
    const lastUserTime = userSfxCooldownMap.get(userId) || 0;
    if (now - lastUserTime < 45000) {
      const remainingUserSec = Math.ceil((45000 - (now - lastUserTime)) / 1000);
      console.log(
        `⏳ [USER COOLDOWN] @${userId} harus menunggu ${remainingUserSec}s lagi untuk memicu SFX pribadi.`
      );
      return;
    }

    // Cooldown lolos: catat timestamp
    lastGlobalSfxTime = now;
    userSfxCooldownMap.set(userId, now);

    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/sfx/trigger`,
        {
          sfxId: matchedSfx.id,
          sender: userId,
          nickname: nickname,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-listener-secret": LISTENER_SECRET,
          },
          timeout: 5000,
        }
      );

      if (response.data?.success) {
        console.log(
          `🔊 [SFX BERHASIL] @${userId} (${nickname}) memicu ${matchedSfx.emoji} ${matchedSfx.name}!`
        );
      }
    } catch (error) {
      console.error(
        `❌ [GAGAL SFX] Gagal memicu SFX ke server:`,
        error.response?.data || error.message
      );
    }
    return;
  }

  // -------------------------------------------------------------
  // 2. CEK VOTING COMMAND (!1, !2, 1, 2)
  // -------------------------------------------------------------
  const voteMatch = comment.match(VOTE_PATTERN);
  if (voteMatch) {
    const optionIndex = parseInt(voteMatch[1] || voteMatch[2], 10);

    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/poll/vote`,
        {
          optionIndex,
          userId,
          nickname,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-listener-secret": LISTENER_SECRET,
          },
          timeout: 5000,
        }
      );

      if (response.data?.success) {
        console.log(`🗳️  [VOTE DITERIMA] @${userId} (${nickname}) -> Opsi [${optionIndex}]`);
      }
    } catch (error) {
      if (error.response) {
        if (error.response.status === 409) {
          console.log(`⚠️  [SUDAH VOTE] @${userId} sudah memberikan suara sebelumnya.`);
        } else if (error.response.status === 400) {
          console.log(`ℹ️  [DIABAIKAN] ${error.response.data?.error || "Opsi tidak valid"}`);
        } else if (error.response.status === 401) {
          console.error("🔒 [UNAUTHORIZED] LISTENER_SECRET tidak cocok dengan password backend!");
        } else {
          console.error(`❌ [ERROR API] Status ${error.response.status}:`, error.response.data);
        }
      } else {
        console.error(
          `❌ [KONEKSI GAGAL] Tidak dapat menghubungi backend di ${BACKEND_URL}:`,
          error.message
        );
      }
    }
  }
});

// Stream lifecycle events
tiktokLiveConnection.on("streamEnd", () => {
  console.log("\n🛑 Sesi TikTok Live telah berakhir.");
});

tiktokLiveConnection.on("disconnected", () => {
  console.log("\n⚠️ Terputus dari TikTok Live. Mencoba menyambung kembali...");
});

tiktokLiveConnection.on("error", (err) => {
  console.error("⚠️ TikTok Connector Error:", err?.message || err);
});

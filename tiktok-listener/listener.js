import { TikTokLiveConnection } from "tiktok-live-connector";
import axios from "axios";
import dotenv from "dotenv";
import { exec } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from listener directory or root
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config();

const cliUser = process.argv[2]?.replace(/^@/, "").trim();
const TIKTOK_USERNAME = cliUser || process.env.TIKTOK_USERNAME?.replace(/^@/, "").trim();
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

// Connect to TikTok Live with auto-reconnect
let isConnecting = false;
let retryAttempt = 0;
let reconnectTimer = null;

function connectTikTok() {
  if (isConnecting) return;
  if (tiktokLiveConnection._connectState === "CONNECTED") return;

  isConnecting = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const attemptNum = retryAttempt + 1;
  console.log(`\n🔄 Menghubungkan ke TikTok Live @${TIKTOK_USERNAME}... (Percobaan #${attemptNum})`);

  tiktokLiveConnection
    .connect()
    .then((state) => {
      isConnecting = false;
      retryAttempt = 0;
      console.log(`\n✅ Terhubung ke TikTok Live! (Room ID: ${state.roomId})`);
      console.log("Menunggu komentar penonton:");
      console.log(" - Live Vote: !1, !2, 1, 2, dll.");
      console.log(" - Meme SFX : !klakson, !kaget, !wasted, !bruh, !error\n");
    })
    .catch((err) => {
      isConnecting = false;
      retryAttempt++;
      const delay = Math.min(30, 5 * retryAttempt);
      console.error(`❌ Gagal terhubung ke TikTok Live: ${err.message}`);
      console.log(`⏳ Mencoba menyambung kembali dalam ${delay} detik...`);
      reconnectTimer = setTimeout(connectTikTok, delay * 1000);
    });
}

// Initial connection
connectTikTok();

// Mainkan sound effect langsung di speaker / headset laptop streamer
function playLocalSound(sfxId) {
  const possiblePaths = [
    path.resolve(__dirname, `../public/sfx/${sfxId}.mp3`),
    path.resolve(__dirname, `./sfx/${sfxId}.mp3`),
  ];
  const soundFile = possiblePaths.find((p) => fs.existsSync(p));
  if (!soundFile) {
    return;
  }

  // macOS (afplay bawaan macOS, 0ms latency)
  if (process.platform === "darwin") {
    exec(`afplay "${soundFile}" &`, (err) => {
      if (err) console.error("⚠️ afplay error:", err.message);
    });
  }
  // Windows PowerShell
  else if (process.platform === "win32") {
    exec(`powershell -c (New-Object Media.SoundPlayer '${soundFile}').PlaySync()`, () => {});
  }
  // Linux
  else if (process.platform === "linux") {
    exec(`paplay "${soundFile}" 2>/dev/null || aplay "${soundFile}" 2>/dev/null &`, () => {});
  }
}

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

    // Putar audio langsung di laptop streamer (afplay) seketika!
    playLocalSound(matchedSfx.id);

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
    return;
  }

  // -------------------------------------------------------------
  // 3. REGULAR CHAT COMMENT (Dibacakan oleh TTS & Ditampilkan di Overlay)
  // -------------------------------------------------------------
  if (comment && comment.length <= 100) {
    console.log(`💬 [CHAT] @${userId} (${nickname}): "${comment}"`);
    sendTikTokEvent({
      eventType: "chat",
      uniqueId: userId,
      nickname,
      message: comment,
    });
  }
});

// -------------------------------------------------------------
// Helper untuk mengirim event ke backend
// -------------------------------------------------------------
async function sendTikTokEvent(payload) {
  try {
    await axios.post(`${BACKEND_URL}/api/tiktok-events`, payload, {
      headers: {
        "Content-Type": "application/json",
        "x-listener-secret": LISTENER_SECRET,
      },
      timeout: 5000,
    });
  } catch (err) {
    // Abaikan jika server sibuk / error sementara
  }
}

// -------------------------------------------------------------
// 4. MEMBER JOIN (Sapaan Penonton Masuk)
// -------------------------------------------------------------
const welcomedUsers = new Set();
let lastJoinWelcomeTime = 0;

tiktokLiveConnection.on("member", async (data) => {
  const userId = data.uniqueId || data.user?.uniqueId || "viewer";
  const nickname = data.nickname || data.user?.nickname || userId;
  const now = Date.now();

  // Deduplicate: User yang sama tidak disapa berulang kali jika re-join
  if (welcomedUsers.has(userId)) return;

  // Throttle: Jeda minimal 6 detik antar sapaan join agar TTS tidak menumpuk
  if (now - lastJoinWelcomeTime < 6000) return;

  welcomedUsers.add(userId);
  lastJoinWelcomeTime = now;

  console.log(`👋 [MEMBER JOIN] @${userId} (${nickname}) masuk ke stream.`);
  sendTikTokEvent({
    eventType: "join",
    uniqueId: userId,
    nickname,
  });
});

// -------------------------------------------------------------
// 5. GIFT (Saweran Hadiah TikTok)
// -------------------------------------------------------------
tiktokLiveConnection.on("gift", async (data) => {
  // Hanya proses jika streak sudah selesai atau gift non-streak (repeatEnd === true)
  if (data.giftType === 1 && !data.repeatEnd) {
    return;
  }

  const userId = data.uniqueId || data.user?.uniqueId || "viewer";
  const nickname = data.nickname || data.user?.nickname || userId;
  const giftName = data.giftName || "Hadiah";
  const giftCount = data.repeatCount || data.giftCount || 1;
  const diamondCount = data.diamondCount || 0;

  console.log(`🎁 [GIFT] @${userId} (${nickname}) kirim ${giftName} x${giftCount}!`);
  sendTikTokEvent({
    eventType: "gift",
    uniqueId: userId,
    nickname,
    giftName,
    giftCount,
    diamondCount,
  });
});

// -------------------------------------------------------------
// 6. FOLLOW & SHARE
// -------------------------------------------------------------
tiktokLiveConnection.on("follow", async (data) => {
  const userId = data.uniqueId || data.user?.uniqueId || "viewer";
  const nickname = data.nickname || data.user?.nickname || userId;

  console.log(`➕ [FOLLOW] @${userId} (${nickname}) mulai mengikuti stream.`);
  sendTikTokEvent({
    eventType: "follow",
    uniqueId: userId,
    nickname,
  });
});

tiktokLiveConnection.on("share", async (data) => {
  const userId = data.uniqueId || data.user?.uniqueId || "viewer";
  const nickname = data.nickname || data.user?.nickname || userId;

  console.log(`📢 [SHARE] @${userId} (${nickname}) membagikan live stream.`);
  sendTikTokEvent({
    eventType: "share",
    uniqueId: userId,
    nickname,
  });
});

// Stream lifecycle events with auto-reconnect
tiktokLiveConnection.on("streamEnd", () => {
  console.log("\n⚠️ TikTok Webcast melaporkan stream terputus / idle timeout.");
  console.log("⏳ Mencoba menyambung kembali dalam 10 detik...");
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connectTikTok, 10000);
});

tiktokLiveConnection.on("disconnected", () => {
  console.log("\n⚠️ Terputus dari TikTok Live. Mencoba menyambung kembali dalam 5 detik...");
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connectTikTok, 5000);
});

tiktokLiveConnection.on("error", (err) => {
  console.error("⚠️ TikTok Connector Error:", err?.message || err);
});

// -------------------------------------------------------------
// Vercel Serverless Keep-Alive Heartbeat (setiap 15 detik)
// -------------------------------------------------------------
// Vercel Serverless Function otomatis "tidur" (cold sleep) jika
// tidak ada traffic. Interval 15 detik ini menjamin server tetap
// panas (warm) dan memori voting tidak akan pernah terhapus!
setInterval(async () => {
  try {
    const res = await axios.get(`${BACKEND_URL}/api/poll/active`, { timeout: 7000 });
    if (res.data?.active && res.data?.poll) {
      // Server aktif & voting terdeteksi
    }
  } catch (err) {
    // Abaikan error koneksi heartbeat
  }
}, 15000);

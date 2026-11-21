import { TikTokLiveConnection } from "tiktok-live-connector";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from listener directory or project root
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
  console.error("Atau jalankan: npm run tiktok @username_anda");
  console.error("=====================================================================");
  process.exit(1);
}

console.log("=====================================================================");
console.log("🎯 TikTok Live Voting, SFX & Event TTS Listener by twodigit.io");
console.log(`📡 Target Streamer   : @${TIKTOK_USERNAME}`);
console.log(`🌐 Backend Server     : ${BACKEND_URL}`);
console.log(`⏱️  Global SFX Cooldown: ${SFX_COOLDOWN_SECONDS} detik`);
console.log("=====================================================================");

// In-Memory Cooldown Tracker
let lastGlobalSfxTime = 0;
const userSfxCooldownMap = new Map();

// Deduplication for recent message IDs to prevent double/triple processing
const processedMsgIds = new Set();
function isDuplicateMessage(msgId) {
  if (!msgId) return false;
  if (processedMsgIds.has(msgId)) return true;
  processedMsgIds.add(msgId);
  if (processedMsgIds.size > 1000) {
    const oldest = processedMsgIds.values().next().value;
    processedMsgIds.delete(oldest);
  }
  return false;
}

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

// Connection timing state to strictly ignore room history / old messages
let isConnecting = false;
let retryAttempt = 0;
let reconnectTimer = null;
let connectionStartTime = 0;
let isInitialSync = true;

/**
 * Checks whether an incoming message is from previous room history
 */
function isOldMessage(data) {
  // During initial sync window (first 3s after connect), consider everything historical
  if (isInitialSync) return true;

  const rawTime = data.common?.createTime || data.createTime;
  if (rawTime) {
    let msgTimeMs = parseInt(rawTime, 10);
    if (!isNaN(msgTimeMs)) {
      if (msgTimeMs < 10000000000) {
        msgTimeMs *= 1000;
      }
      // If message was created before our connection established
      if (msgTimeMs < connectionStartTime - 1000) {
        return true;
      }
    }
  }
  return false;
}

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
      connectionStartTime = Date.now();
      isInitialSync = true;

      console.log(`\n✅ Terhubung ke TikTok Live! (Room ID: ${state.roomId})`);
      console.log("⏳ Mengabaikan riwayat chat lama (membersihkan backlog room)...");

      // Give 2.5 seconds to flush any initial room backlog messages
      setTimeout(() => {
        isInitialSync = false;
        console.log("🟢 [LIVE LISTENER AKTIF] Sekarang mendengarkan komentar & event terbaru secara real-time!");
        console.log(" - Live Vote: !1, !2, 1, 2, dll.");
        console.log(" - Meme SFX : !klakson, !kaget, !wasted, !bruh, !error");
        console.log(" - Live Event: Sapaan join penonton baru, pembacaan chat TTS, gift, follow, share\n");
      }, 2500);
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

// Helper untuk mengirim event TikTok ke backend overlay
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
// 1. CHAT MESSAGES (Vote, SFX, & TTS Komentar)
// -------------------------------------------------------------
tiktokLiveConnection.on("chat", async (data) => {
  const comment = (data.content || data.comment || "").trim();
  const lowerComment = comment.toLowerCase();
  const user = data.user || {};
  const userId = (user.displayId || user.uniqueId || data.uniqueId || user.id || "viewer").replace(/^@/, "").trim();
  const nickname = (user.nickname || data.nickname || userId || "Penonton").trim();
  const msgId = data.msgId || data.common?.msgId || `${userId}-${comment}-${data.common?.createTime || Date.now()}`;
  const now = Date.now();

  // Deduplicate packets (TikTok Webcast sends retransmissions)
  if (isDuplicateMessage(msgId)) return;

  // STRICT FILTER: Abaikan semua pesan dari riwayat lama sebelum listener terhubung
  if (isOldMessage(data)) {
    // console.log(`⏳ [HISTORI DIABAIKAN] @${userId}: "${comment}"`);
    return;
  }

  // -----------------------------------------------------------
  // A. CEK MEME SFX COMMAND (!klakson, !kaget, !wasted, !bruh, dll)
  // -----------------------------------------------------------
  const cleanCmd = lowerComment.replace(/[!.,?]+$/, "").trim();
  const matchedSfx = SFX_COMMANDS[lowerComment] || SFX_COMMANDS[cleanCmd];

  if (matchedSfx) {
    // Cek Global Cooldown
    const timeSinceLastSfx = now - lastGlobalSfxTime;
    if (timeSinceLastSfx < SFX_COOLDOWN_MS) {
      const remainingSec = Math.ceil((SFX_COOLDOWN_MS - timeSinceLastSfx) / 1000);
      console.log(
        `⏳ [SFX COOLDOWN] @${userId} mencoba ${matchedSfx.name}, sisa cooldown: ${remainingSec}s (ditolak)`
      );
      return;
    }

    // Per-User Cooldown (minimal 45 detik per viewer)
    const lastUserTime = userSfxCooldownMap.get(userId) || 0;
    if (now - lastUserTime < 45000) {
      const remainingUserSec = Math.ceil((45000 - (now - lastUserTime)) / 1000);
      console.log(
        `⏳ [USER COOLDOWN] @${userId} harus menunggu ${remainingUserSec}s lagi untuk SFX pribadi.`
      );
      return;
    }

    // Cooldown lolos: catat timestamp
    lastGlobalSfxTime = now;
    userSfxCooldownMap.set(userId, now);

    try {
      // Broadcast SFX ke overlay OBS (/overlay/sfx)
      // Audio diputar secara terpusat oleh browser source OBS agar TIDAK bergema / double play!
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
          `🔊 [SFX DIPICU] @${userId} (${nickname}) memicu ${matchedSfx.emoji} ${matchedSfx.name}!`
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

  // -----------------------------------------------------------
  // B. CEK VOTING COMMAND (!1, !2, 1, 2)
  // -----------------------------------------------------------
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
          console.log(`ℹ️  [VOTE DIABAIKAN] ${error.response.data?.error || "Opsi tidak valid"}`);
        } else if (error.response.status === 401) {
          console.error("🔒 [UNAUTHORIZED] LISTENER_SECRET tidak cocok dengan password backend!");
        }
      }
    }
    return;
  }

  // -----------------------------------------------------------
  // C. REGULAR CHAT COMMENT (Dibacakan oleh TTS di Overlay)
  // -----------------------------------------------------------
  if (comment && comment.length <= 100) {
    console.log(`💬 [CHAT LIVE] @${userId} (${nickname}): "${comment}"`);
    sendTikTokEvent({
      eventType: "chat",
      uniqueId: userId,
      nickname,
      message: comment,
    });
  }
});

// -------------------------------------------------------------
// 2. MEMBER JOIN (Sapaan Penonton Masuk Stream)
// -------------------------------------------------------------
// Simpan timestamp kapan user terakhir disapa (deduplikasi 10 menit per user)
const welcomedUserTimestamps = new Map();
let lastJoinWelcomeTime = 0;

tiktokLiveConnection.on("member", async (data) => {
  // Abaikan event member dari riwayat sebelum listener terhubung
  if (isOldMessage(data)) return;

  const user = data.user || {};
  const userId = (user.displayId || user.uniqueId || data.uniqueId || user.id || data.userId || "").replace(/^@/, "").trim();
  const nickname = (user.nickname || data.nickname || userId || "Teman Baru").trim();
  const now = Date.now();

  // Pastikan ID valid dan bukan kosong
  if (!userId || userId === "viewer") return;

  // Deduplikasi: Jangan sapa orang yang sama berulang kali dalam 10 menit
  const lastWelcomed = welcomedUserTimestamps.get(userId);
  if (lastWelcomed && now - lastWelcomed < 10 * 60 * 1000) {
    return;
  }

  // Throttle: Jeda minimal 4 detik antar sapaan join agar TTS mengalir santai
  if (now - lastJoinWelcomeTime < 4000) {
    return;
  }

  welcomedUserTimestamps.set(userId, now);
  lastJoinWelcomeTime = now;

  console.log(`👋 [MEMBER JOIN] @${userId} (${nickname}) baru bergabung ke live stream!`);
  sendTikTokEvent({
    eventType: "join",
    uniqueId: userId,
    nickname,
  });
});

// -------------------------------------------------------------
// 3. GIFT (Saweran Hadiah TikTok)
// -------------------------------------------------------------
tiktokLiveConnection.on("gift", async (data) => {
  if (isOldMessage(data)) return;

  // Hanya proses jika streak sudah selesai atau gift non-streak (repeatEnd === true)
  if (data.giftType === 1 && !data.repeatEnd) {
    return;
  }

  const user = data.user || {};
  const userId = (user.displayId || user.uniqueId || data.uniqueId || user.id || "viewer").replace(/^@/, "").trim();
  const nickname = (user.nickname || data.nickname || userId || "Penonton").trim();
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
// 4. FOLLOW & SHARE
// -------------------------------------------------------------
tiktokLiveConnection.on("follow", async (data) => {
  if (isOldMessage(data)) return;

  const user = data.user || {};
  const userId = (user.displayId || user.uniqueId || data.uniqueId || user.id || "viewer").replace(/^@/, "").trim();
  const nickname = (user.nickname || data.nickname || userId || "Penonton").trim();

  console.log(`➕ [FOLLOW] @${userId} (${nickname}) mulai mengikuti stream.`);
  sendTikTokEvent({
    eventType: "follow",
    uniqueId: userId,
    nickname,
  });
});

tiktokLiveConnection.on("share", async (data) => {
  if (isOldMessage(data)) return;

  const user = data.user || {};
  const userId = (user.displayId || user.uniqueId || data.uniqueId || user.id || "viewer").replace(/^@/, "").trim();
  const nickname = (user.nickname || data.nickname || userId || "Penonton").trim();

  console.log(`📢 [SHARE] @${userId} (${nickname}) membagikan live stream.`);
  sendTikTokEvent({
    eventType: "share",
    uniqueId: userId,
    nickname,
  });
});

// -------------------------------------------------------------
// Lifecycle Events dengan Auto-Reconnect Bersih
// -------------------------------------------------------------
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

// Keep-Alive Heartbeat untuk menjaga backend Vercel tetap bangun
setInterval(async () => {
  try {
    await axios.get(`${BACKEND_URL}/api/poll/active`, { timeout: 7000 });
  } catch (err) {
    // Abaikan error heartbeat
  }
}, 15000);

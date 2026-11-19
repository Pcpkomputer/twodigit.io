import { WebcastPushConnection } from "tiktok-live-connector";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME?.replace(/^@/, "").trim();
const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:3000").replace(/\/+$/, "");
const LISTENER_SECRET = process.env.LISTENER_SECRET || "p3rw1rapc";

if (!TIKTOK_USERNAME || TIKTOK_USERNAME === "username_streamer") {
  console.error("=====================================================================");
  console.error("⚠️  PERINGATAN: TIKTOK_USERNAME belum diatur di file .env!");
  console.error("Silakan buka file .env dan isi TIKTOK_USERNAME dengan username TikTok Anda.");
  console.error("Contoh: TIKTOK_USERNAME=\"yudhacode\"");
  console.error("=====================================================================");
  process.exit(1);
}

console.log("=====================================================================");
console.log("🎯 TikTok Live Voting Listener by twodigit.io");
console.log(`📡 Target Streamer : @${TIKTOK_USERNAME}`);
console.log(`🌐 Backend URL     : ${BACKEND_URL}/api/poll/vote`);
console.log("=====================================================================");

const tiktokLiveConnection = new WebcastPushConnection(TIKTOK_USERNAME, {
  processInitialData: false,
  enableExtendedGiftInfo: false,
  enableWebsocketUpgrade: true,
  requestPollingIntervalMs: 1000,
  clientParams: {
    app_language: "id-ID",
    device_platform: "web"
  }
});

// Regex to capture viewer vote commands:
// Matches: !1, !2, #1, #2, /1, 1, 2, or "!vote 1", "vote 1"
const VOTE_PATTERN = /^(?:[!#\/]?\s*([1-9])|(?:!vote|vote)\s+([1-9]))$/i;

// Connect to TikTok Live
tiktokLiveConnection
  .connect()
  .then((state) => {
    console.log(`\n✅ Terhubung ke TikTok Live! (Room ID: ${state.roomId})`);
    console.log("Menunggu komentar vote dari penonton (!1, !2, 1, 2, dll)...\n");
  })
  .catch((err) => {
    console.error("❌ Gagal terhubung ke TikTok Live:", err.message);
    console.error("Pastikan akun @", TIKTOK_USERNAME, "sedang LIVE dan username benar.");
  });

// Handle incoming chat messages
tiktokLiveConnection.on("chat", async (data) => {
  const comment = (data.comment || "").trim();
  const match = comment.match(VOTE_PATTERN);

  if (!match) return;

  const optionIndex = parseInt(match[1] || match[2], 10);
  const userId = data.uniqueId;
  const nickname = data.nickname || data.uniqueId;

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
        // Already voted
        console.log(`⚠️  [SUDAH VOTE] @${userId} sudah memberikan suara sebelumnya.`);
      } else if (error.response.status === 400) {
        // No active poll or option out of range
        console.log(`ℹ️  [DIABAIKAN] ${error.response.data?.error || "Opsi tidak valid"}`);
      } else if (error.response.status === 401) {
        console.error("🔒 [UNAUTHORIZED] LISTENER_SECRET tidak cocok dengan password backend!");
      } else {
        console.error(`❌ [ERROR API] Status ${error.response.status}:`, error.response.data);
      }
    } else {
      console.error(`❌ [KONEKSI GAGAL] Tidak dapat menghubungi backend di ${BACKEND_URL}:`, error.message);
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

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { pusherServer } from "@/lib/pusher";
import { queryGeminiGta6Cohost } from "@/lib/gemini-cohost";

// Gemini Free Tier Rate Limiter
// Gemini Free Tier limit: 15 RPM. A 20s cooldown keeps live chat requests to <= 3 RPM,
// perfectly avoiding 429 quota exhaustion during live streams.
let lastQueryTimestamp = 0;
const COOLDOWN_SECONDS = 20;

const isAuthorized = (request: NextRequest) => {
  const sessionCookie = request.cookies.get("test_overlay_session")?.value;
  const configuredPassword = process.env.TEST_OVERLAY_PASSWORD || "p3rw1rapc";
  const expectedHash = crypto.createHash("sha256").update(configuredPassword).digest("hex");

  const authHeader = request.headers.get("x-test-password");
  if (authHeader && authHeader === configuredPassword) {
    return true;
  }

  const listenerSecret = request.headers.get("x-listener-secret");
  if (listenerSecret && listenerSecret === configuredPassword) {
    return true;
  }

  return Boolean(sessionCookie && sessionCookie === expectedHash);
};

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { error: "Unauthorized. Silakan login ke test overlay terlebih dahulu." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      prompt = "",
      source = "streamer", // "streamer" | "chat"
      sender = "Streamer",
      voice = "ardi", // "ardi" (default Cowok Natural) | "schoolgirl" | "anime" | "gadis"
      sessionContext = "",
    } = body;

    const cleanPrompt = (prompt || "").trim();
    if (!cleanPrompt) {
      return NextResponse.json(
        { error: "Prompt/pertanyaan tidak boleh kosong." },
        { status: 400 }
      );
    }

    // Rate Limit Check to protect Gemini Free Tier quota
    const now = Date.now();
    const elapsedSeconds = (now - lastQueryTimestamp) / 1000;
    // Allow 4s buffer for streamer testing, enforce 20s cooldown for live chat
    const requiredCooldown = source === "streamer" ? 4 : COOLDOWN_SECONDS;

    if (elapsedSeconds < requiredCooldown) {
      const remainingSeconds = Math.ceil(requiredCooldown - elapsedSeconds);
      return NextResponse.json(
        {
          error: `AI sedang cooldown. Silakan tunggu ${remainingSeconds} detik lagi.`,
          remainingSeconds,
          cooldownSeconds: COOLDOWN_SECONDS,
        },
        { status: 429 }
      );
    }

    // Update timestamp before query to prevent concurrent bursts
    lastQueryTimestamp = now;

    // Query Google Gemini Flash with injected GTA 6 knowledge
    const cohostReply = await queryGeminiGta6Cohost(cleanPrompt, sessionContext);

    const eventPayload = {
      id: `cohost-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      prompt: cleanPrompt,
      reply: cohostReply.reply,
      speechText: cohostReply.speechText,
      mood: cohostReply.mood,
      voice: voice || "ardi",
      source,
      sender: sender || "Budak Mimin",
      cooldownSeconds: COOLDOWN_SECONDS,
      timestamp: new Date().toISOString(),
    };

    // Broadcast via Pusher to donation-stream
    if (pusherServer) {
      await pusherServer.trigger("donation-stream", "ai-cohost-event", eventPayload);
    }

    return NextResponse.json({
      success: true,
      cohost: eventPayload,
      cooldownSeconds: COOLDOWN_SECONDS,
    });
  } catch (error: any) {
    console.error("AI Co-Host endpoint error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memproses respon AI Co-Host." },
      { status: 500 }
    );
  }
}

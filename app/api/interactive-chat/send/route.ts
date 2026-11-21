import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { pusherServer } from "@/lib/pusher";

const isAuthorized = (request: NextRequest) => {
  const sessionCookie = request.cookies.get("test_overlay_session")?.value;
  const configuredPassword = process.env.TEST_OVERLAY_PASSWORD || "p3rw1rapc";
  const expectedHash = crypto.createHash("sha256").update(configuredPassword).digest("hex");

  // Also support direct header authorization
  const authHeader = request.headers.get("x-test-password");
  if (authHeader && authHeader === configuredPassword) {
    return true;
  }

  return Boolean(sessionCookie && sessionCookie === expectedHash);
};

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { error: "Unauthorized. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      sender = "Streamer",
      message = "",
      badge = "🎙️ Host",
      theme = "streamer",
      voice = "schoolgirl",
    } = body;

    const cleanMessage = (message || "").trim();
    if (!cleanMessage) {
      return NextResponse.json(
        { error: "Pesan tidak boleh kosong." },
        { status: 400 }
      );
    }

    const cleanSender = (sender || "Streamer").trim();
    const cleanBadge = (badge || "🎙️ Host").trim();
    const cleanVoice = (voice || "schoolgirl").trim();
    const nowIso = new Date().toISOString();
    const chatId = `chat-${Date.now()}`;

    const chatPayload = {
      id: chatId,
      sender: cleanSender,
      message: cleanMessage,
      badge: cleanBadge,
      theme,
      voice: cleanVoice,
      createdAt: nowIso,
    };

    // Broadcast to Pusher 'donation-stream' channel on 'interactive-chat' event
    await pusherServer.trigger("donation-stream", "interactive-chat", chatPayload);

    return NextResponse.json({
      success: true,
      message: "Chat interaktif berhasil dikirim ke overlay!",
      chat: chatPayload,
    });
  } catch (error: any) {
    console.error("Interactive chat error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

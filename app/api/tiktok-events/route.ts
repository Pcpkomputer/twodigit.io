import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  formatTikTokEvent,
  broadcastTikTokEvent,
  getTikTokSettings,
  updateTikTokSettings,
  TikTokEventType,
} from "@/lib/tiktok-events";

const isAuthorized = (request: NextRequest) => {
  const configuredPassword = process.env.TEST_OVERLAY_PASSWORD || "p3rw1rapc";

  // Check header from tiktok-listener worker
  const listenerSecret = request.headers.get("x-listener-secret");
  if (listenerSecret && listenerSecret === configuredPassword) {
    return true;
  }

  // Check direct admin password header
  const authHeader = request.headers.get("x-test-password");
  if (authHeader && authHeader === configuredPassword) {
    return true;
  }

  // Check admin session cookie
  const sessionCookie = request.cookies.get("test_overlay_session")?.value;
  const expectedHash = crypto.createHash("sha256").update(configuredPassword).digest("hex");
  if (sessionCookie && sessionCookie === expectedHash) {
    return true;
  }

  return false;
};

export async function GET() {
  const settings = getTikTokSettings();
  return NextResponse.json({
    success: true,
    settings,
  });
}

export async function PUT(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const updated = updateTikTokSettings(body);

    return NextResponse.json({
      success: true,
      message: "Pengaturan TikTok Events berhasil disimpan",
      settings: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { error: "Unauthorized TikTok Event request" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { eventType, uniqueId, nickname, message, giftName, giftCount, diamondCount } = body;

    const validTypes: TikTokEventType[] = ["join", "chat", "gift", "follow", "share"];
    if (!eventType || !validTypes.includes(eventType)) {
      return NextResponse.json(
        { error: `eventType harus salah satu dari: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Check streamer toggles
    const settings = getTikTokSettings();
    if (eventType === "join" && !settings.enableJoin) {
      return NextResponse.json({ success: true, ignored: true, reason: "Join TTS disabled" });
    }
    if (eventType === "chat" && !settings.enableChat) {
      return NextResponse.json({ success: true, ignored: true, reason: "Chat TTS disabled" });
    }
    if (eventType === "gift" && !settings.enableGift) {
      return NextResponse.json({ success: true, ignored: true, reason: "Gift TTS disabled" });
    }
    if (eventType === "follow" && !settings.enableFollow) {
      return NextResponse.json({ success: true, ignored: true, reason: "Follow TTS disabled" });
    }
    if (eventType === "share" && !settings.enableShare) {
      return NextResponse.json({ success: true, ignored: true, reason: "Share TTS disabled" });
    }

    // Build event object
    const eventPayload = formatTikTokEvent({
      eventType,
      uniqueId: uniqueId || "viewer",
      nickname,
      message,
      giftName,
      giftCount,
      diamondCount,
    });

    // Broadcast to Pusher for OBS Overlay
    await broadcastTikTokEvent(eventPayload);

    return NextResponse.json({
      success: true,
      message: `Event '${eventType}' berhasil disiarkan ke overlay.`,
      event: eventPayload,
    });
  } catch (error: any) {
    console.error("TikTok Event API error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

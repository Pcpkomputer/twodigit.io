import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { pusherServer } from "@/lib/pusher";
import { SFX_CATALOG } from "@/lib/sfx";

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

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { error: "Unauthorized SFX trigger request." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { sfxId, sender = "Viewer", nickname } = body;

    const matchedSfx = SFX_CATALOG.find((s) => s.id === sfxId);
    if (!matchedSfx) {
      return NextResponse.json(
        { error: `SFX ID '${sfxId}' tidak ditemukan.` },
        { status: 404 }
      );
    }

    const payload = {
      id: `sfx-${Date.now()}`,
      sfxId: matchedSfx.id,
      name: matchedSfx.name,
      command: matchedSfx.command,
      emoji: matchedSfx.emoji,
      url: matchedSfx.url,
      sender: (sender || "Viewer").replace(/^@/, ""),
      nickname: nickname || sender || "Viewer",
      timestamp: new Date().toISOString(),
    };

    // Broadcast trigger to overlay in real-time via Pusher
    await pusherServer.trigger("donation-stream", "sfx-trigger", payload);

    return NextResponse.json({
      success: true,
      message: `SFX '${matchedSfx.name}' (${matchedSfx.command}) berhasil dipicu.`,
      sfx: payload,
    });
  } catch (error: any) {
    console.error("SFX trigger error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

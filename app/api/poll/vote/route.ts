import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { registerVote } from "@/lib/poll";

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
        { error: "Unauthorized vote request." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { optionIndex, userId, nickname } = body;

    const parsedIndex = parseInt(String(optionIndex), 10);
    if (isNaN(parsedIndex) || parsedIndex < 1) {
      return NextResponse.json(
        { error: "Index pilihan voting tidak valid." },
        { status: 400 }
      );
    }

    const result = await registerVote(parsedIndex, userId, nickname);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message, duplicate: result.duplicate },
        { status: result.duplicate ? 409 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      poll: result.poll,
    });
  } catch (error: any) {
    console.error("Register vote error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

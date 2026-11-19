import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createPoll } from "@/lib/poll";

const isAuthorized = (request: NextRequest) => {
  const sessionCookie = request.cookies.get("test_overlay_session")?.value;
  const configuredPassword = process.env.TEST_OVERLAY_PASSWORD || "p3rw1rapc";
  const expectedHash = crypto.createHash("sha256").update(configuredPassword).digest("hex");

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
    const { title = "Voting Live", options = [] } = body;

    if (!Array.isArray(options) || options.length < 2) {
      return NextResponse.json(
        { error: "Voting membutuhkan minimal 2 opsi pilihan." },
        { status: 400 }
      );
    }

    const newPoll = await createPoll(title, options);

    return NextResponse.json({
      success: true,
      message: "Voting live berhasil dimulai!",
      poll: newPoll,
    });
  } catch (error: any) {
    console.error("Create poll error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

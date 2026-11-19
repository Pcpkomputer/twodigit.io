import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { endPoll, resetPoll } from "@/lib/poll";

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
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "end"; // end | reset

    if (action === "reset") {
      await resetPoll();
      return NextResponse.json({
        success: true,
        message: "Voting berhasil di-reset.",
      });
    }

    const endedPoll = await endPoll();
    return NextResponse.json({
      success: true,
      message: "Voting selesai!",
      poll: endedPoll,
    });
  } catch (error: any) {
    console.error("End poll error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

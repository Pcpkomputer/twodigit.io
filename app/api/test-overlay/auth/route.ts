import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const getExpectedHash = () => {
  const password = process.env.TEST_OVERLAY_PASSWORD || "p3rw1rapc";
  return crypto.createHash("sha256").update(password).digest("hex");
};

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get("test_overlay_session")?.value;
  const expectedHash = getExpectedHash();

  if (sessionCookie && sessionCookie === expectedHash) {
    return NextResponse.json({ authenticated: true });
  }

  return NextResponse.json({ authenticated: false }, { status: 401 });
}

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    const configuredPassword = process.env.TEST_OVERLAY_PASSWORD || "p3rw1rapc";

    if (!password || password !== configuredPassword) {
      return NextResponse.json(
        { error: "Password salah. Silakan coba lagi." },
        { status: 401 }
      );
    }

    const sessionHash = getExpectedHash();
    const response = NextResponse.json({ success: true, message: "Login berhasil" });

    response.cookies.set("test_overlay_session", sessionHash, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload" },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: "Logged out" });
  response.cookies.delete("test_overlay_session");
  return response;
}

import { NextResponse } from "next/server";

export async function GET() {
  return new NextResponse("Hello World", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    },
  });
}

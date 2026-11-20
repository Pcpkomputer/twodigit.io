import { NextResponse } from "next/server";
import { getActivePoll } from "@/lib/poll";

export async function GET() {
  const poll = await getActivePoll();
  return NextResponse.json({
    active: Boolean(poll),
    poll,
  });
}

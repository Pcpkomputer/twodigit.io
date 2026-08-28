import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate"); // ISO format or YYYY-MM-DD
  const target = parseFloat(searchParams.get("target") || "1000000");
  const title = searchParams.get("title") || "Target Milestone";

  try {
    let query = supabaseAdmin.from("donations").select("amount, created_at");

    if (startDate) {
      // Filter donations created on or after startDate
      const parsedDate = new Date(startDate).toISOString();
      query = query.gte("created_at", parsedDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error querying milestone donations from Supabase:", error);
      return NextResponse.json({
        title,
        target,
        current: 0,
        percentage: 0,
        donorCount: 0,
        error: error.message,
      });
    }

    const totalCollected = (data || []).reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0
    );

    const percentage = target > 0 ? Math.min(100, (totalCollected / target) * 100) : 0;

    return NextResponse.json({
      title,
      target,
      current: totalCollected,
      percentage: Number(percentage.toFixed(1)),
      donorCount: data?.length || 0,
      startDate: startDate || null,
    });
  } catch (error: any) {
    console.error("Milestone calculation error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

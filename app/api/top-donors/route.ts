import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate"); // ISO format or YYYY-MM-DD
  const limit = parseInt(searchParams.get("limit") || "5", 10);

  try {
    let query = supabaseAdmin.from("donations").select("donor_name, amount, created_at");

    if (startDate) {
      const parsedDate = new Date(startDate).toISOString();
      query = query.gte("created_at", parsedDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error querying top donors from Supabase:", error);
      return NextResponse.json({
        topDonors: [],
        error: error.message,
      });
    }

    // Aggregate donations by donor_name
    const donorTotals: Record<string, { name: string; totalAmount: number; count: number; lastDonation: string }> = {};

    (data || []).forEach((row) => {
      const name = row.donor_name || "Anonim";
      const amount = Number(row.amount) || 0;

      if (!donorTotals[name]) {
        donorTotals[name] = {
          name,
          totalAmount: 0,
          count: 0,
          lastDonation: row.created_at,
        };
      }

      donorTotals[name].totalAmount += amount;
      donorTotals[name].count += 1;
      if (new Date(row.created_at) > new Date(donorTotals[name].lastDonation)) {
        donorTotals[name].lastDonation = row.created_at;
      }
    });

    // Sort descending by totalAmount and apply limit
    const sortedDonors = Object.values(donorTotals)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, limit);

    return NextResponse.json({
      startDate: startDate || null,
      limit,
      topDonors: sortedDonors,
    });
  } catch (error: any) {
    console.error("Top donors calculation error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

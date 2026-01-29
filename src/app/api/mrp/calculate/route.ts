import { NextResponse } from "next/server";
import { calculateMrp } from "@/services/mrp.service";

export async function POST() {
  try {
    const { results, summary } = await calculateMrp({ clearExisting: true });

    return NextResponse.json({
      message: "MRP calculation completed",
      count: results.length,
      summary,
      results,
    });
  } catch (error) {
    console.error("Failed to run MRP calculation:", error);
    return NextResponse.json(
      { error: "Failed to run MRP calculation" },
      { status: 500 }
    );
  }
}

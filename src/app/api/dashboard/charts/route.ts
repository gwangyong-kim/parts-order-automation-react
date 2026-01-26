import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    // Start all database queries in parallel (async-parallel rule)
    // This reduces 3 sequential round trips to 1 parallel round trip
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [transactions, categoriesWithCounts, orderStatusCounts] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          createdAt: { gte: sixMonthsAgo },
        },
        select: {
          transactionType: true,
          quantity: true,
          createdAt: true,
        },
      }),
      prisma.category.findMany({
        include: {
          _count: {
            select: { parts: true },
          },
        },
      }),
      prisma.order.groupBy({
        by: ["status"],
        _count: true,
      }),
    ]);

    // Aggregate by year-month to avoid cross-year data mixing
    const monthlyData: Record<string, { inbound: number; outbound: number; displayMonth: string }> = {};
    const months = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

    // Initialize last 6 months with year-month key
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const displayMonth = months[date.getMonth()];
      monthlyData[yearMonth] = { inbound: 0, outbound: 0, displayMonth };
    }

    // Aggregate transactions using year-month key
    transactions.forEach((tx) => {
      const txDate = new Date(tx.createdAt);
      const yearMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[yearMonth]) {
        if (tx.transactionType === "INBOUND") {
          monthlyData[yearMonth].inbound += tx.quantity;
        } else if (tx.transactionType === "OUTBOUND") {
          monthlyData[yearMonth].outbound += tx.quantity;
        }
      }
    });

    // Convert to array with display month names (sorted by year-month)
    const monthlyTransactions = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, data]) => ({
        month: data.displayMonth,
        inbound: data.inbound,
        outbound: data.outbound,
      }));

    // Process category distribution
    const categoryDistribution = categoriesWithCounts
      .filter((cat) => cat._count.parts > 0)
      .map((cat) => ({
        name: cat.name,
        value: cat._count.parts,
      }));

    const statusColors: Record<string, string> = {
      DRAFT: "#94a3b8",     // gray
      SUBMITTED: "#3b82f6", // blue
      APPROVED: "#22c55e",  // green
      ORDERED: "#f59e0b",   // amber
      PARTIAL: "#8b5cf6",   // purple
      RECEIVED: "#6366f1",  // indigo
      CANCELLED: "#ef4444", // red
    };

    const allStatuses = ["DRAFT", "SUBMITTED", "APPROVED", "ORDERED", "PARTIAL", "RECEIVED", "CANCELLED"];
    const orderStatus = allStatuses.map((status) => {
      const found = orderStatusCounts.find((o) => o.status === status);
      return {
        status,
        count: found?._count ?? 0,
        color: statusColors[status] || "#94a3b8",
      };
    });

    return NextResponse.json({
      monthlyTransactions,
      categoryDistribution,
      orderStatus,
    });
  } catch (error) {
    console.error("Failed to fetch chart data:", error);
    return NextResponse.json(
      { error: "Failed to fetch chart data" },
      { status: 500 }
    );
  }
}

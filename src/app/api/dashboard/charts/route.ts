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

    // Aggregate by month
    const monthlyData: Record<string, { inbound: number; outbound: number }> = {};
    const months = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = months[date.getMonth()];
      monthlyData[monthKey] = { inbound: 0, outbound: 0 };
    }

    // Aggregate transactions
    transactions.forEach((tx) => {
      const monthKey = months[new Date(tx.createdAt).getMonth()];
      if (monthlyData[monthKey]) {
        if (tx.transactionType === "INBOUND") {
          monthlyData[monthKey].inbound += tx.quantity;
        } else {
          monthlyData[monthKey].outbound += tx.quantity;
        }
      }
    });

    const monthlyTransactions = Object.entries(monthlyData).map(([month, data]) => ({
      month,
      ...data,
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
      RECEIVED: "#6366f1",  // indigo
      CANCELLED: "#ef4444", // red
    };

    const allStatuses = ["DRAFT", "SUBMITTED", "APPROVED", "ORDERED", "RECEIVED", "CANCELLED"];
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

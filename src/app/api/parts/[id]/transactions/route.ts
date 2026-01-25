import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const partId = parseInt(id);

    const transactions = await prisma.transaction.findMany({
      where: { partId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Transform to match frontend expectations
    const transformedTransactions = transactions.map((tx) => ({
      ...tx,
      createdBy: tx.performedBy ? { name: tx.performedBy } : null,
    }));

    return NextResponse.json(transformedTransactions);
  } catch (error) {
    console.error("Failed to fetch part transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch part transactions" },
      { status: 500 }
    );
  }
}

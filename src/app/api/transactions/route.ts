import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const transactions = await prisma.transaction.findMany({
      include: {
        part: {
          select: {
            id: true,
            partCode: true,
            partName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Transform to match frontend expectations
    const transformedTransactions = transactions.map((tx) => ({
      ...tx,
      part: tx.part ? {
        ...tx.part,
        partNumber: tx.part.partCode,
      } : null,
      createdBy: tx.performedBy ? { name: tx.performedBy } : null,
    }));

    return NextResponse.json(transformedTransactions);
  } catch (error) {
    console.error("Failed to fetch transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Get current inventory
    const inventory = await prisma.inventory.findUnique({
      where: { partId: body.partId },
    });

    if (!inventory) {
      return NextResponse.json(
        { error: "Inventory not found for this part" },
        { status: 404 }
      );
    }

    const beforeQty = inventory.currentQty;
    let afterQty = beforeQty;

    if (body.transactionType === "INBOUND") {
      afterQty = beforeQty + body.quantity;
    } else if (body.transactionType === "OUTBOUND") {
      afterQty = beforeQty - body.quantity;
    } else if (body.transactionType === "ADJUSTMENT") {
      afterQty = body.quantity; // Direct adjustment
    }

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        transactionCode: `TRX-${Date.now()}`,
        transactionType: body.transactionType,
        partId: body.partId,
        quantity: body.quantity,
        beforeQty,
        afterQty,
        referenceType: body.referenceType || null,
        referenceId: body.referenceId || null,
        notes: body.notes || null,
        performedBy: body.performedBy || null,
      },
      include: {
        part: true,
      },
    });

    // Update inventory
    await prisma.inventory.update({
      where: { partId: body.partId },
      data: {
        currentQty: afterQty,
      },
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("Failed to create transaction:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}

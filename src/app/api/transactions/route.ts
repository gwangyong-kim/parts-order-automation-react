import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError, notFound, createdResponse } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const skip = (page - 1) * pageSize;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
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
        skip,
        take: pageSize,
      }),
      prisma.transaction.count(),
    ]);

    // Transform to match frontend expectations
    const transformedTransactions = transactions.map((tx) => ({
      ...tx,
      part: tx.part ? {
        ...tx.part,
        partNumber: tx.part.partCode,
      } : null,
      createdBy: tx.performedBy ? { name: tx.performedBy } : null,
    }));

    return NextResponse.json({
      data: transformedTransactions,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    return handleApiError(error);
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
      throw notFound("해당 부품의 재고");
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

    return createdResponse(transaction);
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();

    const itemId = parseInt(id);
    const countedQty = body.countedQty;

    if (typeof countedQty !== "number" || countedQty < 0) {
      return NextResponse.json(
        { error: "Invalid counted quantity" },
        { status: 400 }
      );
    }

    // Get the current item to calculate discrepancy
    const currentItem = await prisma.auditItem.findUnique({
      where: { id: itemId },
      include: { audit: true },
    });

    if (!currentItem) {
      return NextResponse.json({ error: "Audit item not found" }, { status: 404 });
    }

    if (currentItem.audit.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Audit is not in progress" },
        { status: 400 }
      );
    }

    // Calculate discrepancy (positive means counted more than system)
    const discrepancy = countedQty - currentItem.systemQty;

    // Update the audit item
    const updatedItem = await prisma.auditItem.update({
      where: { id: itemId },
      data: {
        countedQty,
        discrepancy,
        notes: body.notes || null,
        countedAt: new Date(),
      },
      include: {
        part: true,
      },
    });

    // Update the audit record statistics
    const allItems = await prisma.auditItem.findMany({
      where: { auditId: currentItem.auditId },
    });

    const countedItems = allItems.filter((item) => item.countedQty !== null);
    const matchedItems = countedItems.filter((item) => item.discrepancy === 0);
    const discrepancyItems = countedItems.filter(
      (item) => item.discrepancy !== null && item.discrepancy !== 0
    );

    await prisma.auditRecord.update({
      where: { id: currentItem.auditId },
      data: {
        totalItems: allItems.length,
        matchedItems: matchedItems.length,
        discrepancyItems: discrepancyItems.length,
      },
    });

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error("Failed to update audit item:", error);
    return NextResponse.json(
      { error: "Failed to update audit item" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;

    const item = await prisma.auditItem.findUnique({
      where: { id: parseInt(id) },
      include: {
        part: true,
        audit: true,
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Audit item not found" }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to fetch audit item:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit item" },
      { status: 500 }
    );
  }
}

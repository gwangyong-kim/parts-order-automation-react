import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const part = await prisma.part.findUnique({
      where: { id: parseInt(id) },
      include: {
        category: true,
        supplier: true,
        inventory: true,
      },
    });

    if (!part) {
      return NextResponse.json({ error: "Part not found" }, { status: 404 });
    }

    return NextResponse.json(part);
  } catch (error) {
    console.error("Failed to fetch part:", error);
    return NextResponse.json(
      { error: "Failed to fetch part" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();

    const part = await prisma.part.update({
      where: { id: parseInt(id) },
      data: {
        partNumber: body.partNumber,
        partName: body.partName,
        specification: body.specification,
        unit: body.unit,
        unitPrice: body.unitPrice,
        safetyStock: body.safetyStock,
        minOrderQty: body.minOrderQty,
        leadTime: body.leadTime,
        categoryId: body.categoryId,
        supplierId: body.supplierId,
        isActive: body.isActive,
      },
      include: {
        category: true,
        supplier: true,
      },
    });

    return NextResponse.json(part);
  } catch (error) {
    console.error("Failed to update part:", error);
    return NextResponse.json(
      { error: "Failed to update part" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;

    // Soft delete - just set isActive to false
    await prisma.part.update({
      where: { id: parseInt(id) },
      data: { isActive: false },
    });

    return NextResponse.json({ message: "Part deleted successfully" });
  } catch (error) {
    console.error("Failed to delete part:", error);
    return NextResponse.json(
      { error: "Failed to delete part" },
      { status: 500 }
    );
  }
}

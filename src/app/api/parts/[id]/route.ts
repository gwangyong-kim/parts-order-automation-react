import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError, notFound, deletedResponse } from "@/lib/api-error";

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
      throw notFound("부품");
    }

    return NextResponse.json(part);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();

    const part = await prisma.part.update({
      where: { id: parseInt(id) },
      data: {
        partCode: body.partNumber,
        partName: body.partName,
        description: body.specification || body.description,
        unit: body.unit,
        unitPrice: body.unitPrice,
        safetyStock: body.safetyStock,
        minOrderQty: body.minOrderQty,
        leadTimeDays: body.leadTime,
        categoryId: body.categoryId,
        supplierId: body.supplierId,
        storageLocation: body.storageLocation,
        isActive: body.isActive,
      },
      include: {
        category: true,
        supplier: true,
      },
    });

    return NextResponse.json(part);
  } catch (error) {
    return handleApiError(error);
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

    return deletedResponse("부품이 삭제되었습니다.");
  } catch (error) {
    return handleApiError(error);
  }
}

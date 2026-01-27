import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError, notFound, deletedResponse } from "@/lib/api-error";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: parseInt(id) },
      include: {
        zones: {
          include: {
            racks: {
              include: {
                shelves: true,
              },
            },
          },
        },
      },
    });

    if (!warehouse) {
      throw notFound("창고");
    }

    return NextResponse.json(warehouse);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();

    const warehouse = await prisma.warehouse.update({
      where: { id: parseInt(id) },
      data: {
        code: body.code,
        name: body.name,
        description: body.description,
        address: body.address,
        width: body.width,
        height: body.height,
        isActive: body.isActive,
      },
    });

    return NextResponse.json(warehouse);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;

    await prisma.warehouse.delete({
      where: { id: parseInt(id) },
    });

    return deletedResponse("창고가 삭제되었습니다.");
  } catch (error) {
    return handleApiError(error);
  }
}

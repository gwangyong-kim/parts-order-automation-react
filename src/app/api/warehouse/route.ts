import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError, createdResponse } from "@/lib/api-error";

export async function GET() {
  try {
    const warehouses = await prisma.warehouse.findMany({
      include: {
        zones: {
          include: {
            racks: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(warehouses);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const warehouse = await prisma.warehouse.create({
      data: {
        code: body.code,
        name: body.name,
        description: body.description || null,
        address: body.address || null,
        width: body.width || 100,
        height: body.height || 100,
        isActive: body.isActive ?? true,
      },
    });

    return createdResponse(warehouse);
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const zone = await prisma.zone.create({
      data: {
        warehouseId: body.warehouseId,
        code: body.code,
        name: body.name,
        description: body.description || null,
        color: body.color || "#3B82F6",
        posX: body.posX || 0,
        posY: body.posY || 0,
        width: body.width || 20,
        height: body.height || 20,
        isActive: body.isActive ?? true,
      },
      include: {
        racks: true,
      },
    });

    return NextResponse.json(zone, { status: 201 });
  } catch (error) {
    console.error("Failed to create zone:", error);
    return NextResponse.json(
      { error: "Failed to create zone" },
      { status: 500 }
    );
  }
}

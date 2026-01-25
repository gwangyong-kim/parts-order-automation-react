import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Create rack with shelves
    const rack = await prisma.rack.create({
      data: {
        zoneId: body.zoneId,
        rowNumber: body.rowNumber,
        posX: body.posX || 0,
        posY: body.posY || 0,
        shelfCount: body.shelfCount || 4,
        isActive: body.isActive ?? true,
        shelves: {
          create: Array.from({ length: body.shelfCount || 4 }, (_, i) => ({
            shelfNumber: String(i + 1).padStart(2, "0"),
            capacity: body.shelfCapacity || 100,
          })),
        },
      },
      include: {
        shelves: true,
      },
    });

    return NextResponse.json(rack, { status: 201 });
  } catch (error) {
    console.error("Failed to create rack:", error);
    return NextResponse.json(
      { error: "Failed to create rack" },
      { status: 500 }
    );
  }
}

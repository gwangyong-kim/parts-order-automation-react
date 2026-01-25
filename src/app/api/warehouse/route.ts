import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
    console.error("Failed to fetch warehouses:", error);
    return NextResponse.json(
      { error: "Failed to fetch warehouses", details: String(error) },
      { status: 500 }
    );
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

    return NextResponse.json(warehouse, { status: 201 });
  } catch (error) {
    console.error("Failed to create warehouse:", error);
    return NextResponse.json(
      { error: "Failed to create warehouse" },
      { status: 500 }
    );
  }
}

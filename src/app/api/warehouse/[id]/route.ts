import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
    }

    return NextResponse.json(warehouse);
  } catch (error) {
    console.error("Failed to fetch warehouse:", error);
    return NextResponse.json(
      { error: "Failed to fetch warehouse" },
      { status: 500 }
    );
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
    console.error("Failed to update warehouse:", error);
    return NextResponse.json(
      { error: "Failed to update warehouse" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;

    await prisma.warehouse.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ message: "Warehouse deleted successfully" });
  } catch (error) {
    console.error("Failed to delete warehouse:", error);
    return NextResponse.json(
      { error: "Failed to delete warehouse" },
      { status: 500 }
    );
  }
}

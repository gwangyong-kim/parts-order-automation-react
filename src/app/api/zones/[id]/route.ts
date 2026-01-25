import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const zone = await prisma.zone.findUnique({
      where: { id: parseInt(id) },
      include: {
        racks: {
          include: {
            shelves: true,
          },
        },
      },
    });

    if (!zone) {
      return NextResponse.json({ error: "Zone not found" }, { status: 404 });
    }

    return NextResponse.json(zone);
  } catch (error) {
    console.error("Failed to fetch zone:", error);
    return NextResponse.json(
      { error: "Failed to fetch zone" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();

    const zone = await prisma.zone.update({
      where: { id: parseInt(id) },
      data: {
        code: body.code,
        name: body.name,
        description: body.description,
        color: body.color,
        posX: body.posX,
        posY: body.posY,
        width: body.width,
        height: body.height,
        isActive: body.isActive,
      },
      include: {
        racks: true,
      },
    });

    return NextResponse.json(zone);
  } catch (error) {
    console.error("Failed to update zone:", error);
    return NextResponse.json(
      { error: "Failed to update zone" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;

    await prisma.zone.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ message: "Zone deleted successfully" });
  } catch (error) {
    console.error("Failed to delete zone:", error);
    return NextResponse.json(
      { error: "Failed to delete zone" },
      { status: 500 }
    );
  }
}

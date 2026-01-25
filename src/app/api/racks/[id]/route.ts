import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const rack = await prisma.rack.findUnique({
      where: { id: parseInt(id) },
      include: {
        shelves: true,
        zone: true,
      },
    });

    if (!rack) {
      return NextResponse.json({ error: "Rack not found" }, { status: 404 });
    }

    return NextResponse.json(rack);
  } catch (error) {
    console.error("Failed to fetch rack:", error);
    return NextResponse.json(
      { error: "Failed to fetch rack" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();

    const rack = await prisma.rack.update({
      where: { id: parseInt(id) },
      data: {
        rowNumber: body.rowNumber,
        posX: body.posX,
        posY: body.posY,
        shelfCount: body.shelfCount,
        isActive: body.isActive,
      },
      include: {
        shelves: true,
      },
    });

    return NextResponse.json(rack);
  } catch (error) {
    console.error("Failed to update rack:", error);
    return NextResponse.json(
      { error: "Failed to update rack" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;

    await prisma.rack.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ message: "Rack deleted successfully" });
  } catch (error) {
    console.error("Failed to delete rack:", error);
    return NextResponse.json(
      { error: "Failed to delete rack" },
      { status: 500 }
    );
  }
}

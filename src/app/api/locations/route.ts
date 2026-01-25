import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/locations?code=A-01-02
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json(
        { error: "Location code is required" },
        { status: 400 }
      );
    }

    // Parse location code (format: "Zone-Row-Shelf" e.g., "A-01-02")
    const parts = code.split("-");
    if (parts.length !== 3) {
      return NextResponse.json(
        { error: "Invalid location code format. Expected: Zone-Row-Shelf (e.g., A-01-02)" },
        { status: 400 }
      );
    }

    const [zoneCode, rowNumber, shelfNumber] = parts;

    // Find the shelf with its rack and zone
    const shelf = await prisma.shelf.findFirst({
      where: {
        shelfNumber,
        rack: {
          rowNumber,
          zone: {
            code: zoneCode,
          },
        },
      },
      include: {
        rack: {
          include: {
            zone: {
              include: {
                warehouse: true,
              },
            },
          },
        },
      },
    });

    if (!shelf) {
      return NextResponse.json(
        { error: "Location not found", code },
        { status: 404 }
      );
    }

    // Get parts at this location
    const partsAtLocation = await prisma.part.findMany({
      where: {
        storageLocation: code,
        isActive: true,
      },
      include: {
        inventory: true,
        category: true,
      },
    });

    return NextResponse.json({
      locationCode: code,
      shelf: {
        id: shelf.id,
        shelfNumber: shelf.shelfNumber,
        capacity: shelf.capacity,
      },
      rack: {
        id: shelf.rack.id,
        rowNumber: shelf.rack.rowNumber,
        posX: shelf.rack.posX,
        posY: shelf.rack.posY,
      },
      zone: {
        id: shelf.rack.zone.id,
        code: shelf.rack.zone.code,
        name: shelf.rack.zone.name,
        color: shelf.rack.zone.color,
        posX: shelf.rack.zone.posX,
        posY: shelf.rack.zone.posY,
      },
      warehouse: {
        id: shelf.rack.zone.warehouse.id,
        code: shelf.rack.zone.warehouse.code,
        name: shelf.rack.zone.warehouse.name,
      },
      parts: partsAtLocation.map((part) => ({
        id: part.id,
        partCode: part.partCode,
        partName: part.partName,
        unit: part.unit,
        currentQty: part.inventory?.currentQty || 0,
        category: part.category?.name || null,
      })),
      partCount: partsAtLocation.length,
    });
  } catch (error) {
    console.error("Failed to lookup location:", error);
    return NextResponse.json(
      { error: "Failed to lookup location" },
      { status: 500 }
    );
  }
}

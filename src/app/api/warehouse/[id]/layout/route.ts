import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

// Get full layout for map rendering
export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const warehouseId = parseInt(id);

    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
      include: {
        zones: {
          where: { isActive: true },
          include: {
            racks: {
              where: { isActive: true },
              include: {
                shelves: {
                  where: { isActive: true },
                },
              },
              orderBy: { rowNumber: "asc" },
            },
          },
          orderBy: { code: "asc" },
        },
      },
    });

    if (!warehouse) {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
    }

    // Get part counts by location for visualization
    const parts = await prisma.part.findMany({
      where: {
        isActive: true,
        storageLocation: { not: null },
      },
      select: {
        storageLocation: true,
      },
    });

    // Count parts per location
    const partCountByLocation: Record<string, number> = {};
    parts.forEach((part) => {
      if (part.storageLocation) {
        partCountByLocation[part.storageLocation] =
          (partCountByLocation[part.storageLocation] || 0) + 1;
      }
    });

    // Build location codes for each shelf and attach part counts
    const zonesWithLocationCodes = warehouse.zones.map((zone) => ({
      ...zone,
      racks: zone.racks.map((rack) => ({
        ...rack,
        shelves: rack.shelves.map((shelf) => {
          const locationCode = `${zone.code}-${rack.rowNumber}-${shelf.shelfNumber}`;
          return {
            ...shelf,
            locationCode,
            partCount: partCountByLocation[locationCode] || 0,
          };
        }),
      })),
    }));

    return NextResponse.json({
      ...warehouse,
      zones: zonesWithLocationCodes,
      partCountByLocation,
    });
  } catch (error) {
    console.error("Failed to fetch warehouse layout:", error);
    return NextResponse.json(
      { error: "Failed to fetch warehouse layout" },
      { status: 500 }
    );
  }
}

// Bulk update zone/rack positions
export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Update zone positions
    if (body.zones && Array.isArray(body.zones)) {
      for (const zone of body.zones) {
        await prisma.zone.update({
          where: { id: zone.id },
          data: {
            posX: zone.posX,
            posY: zone.posY,
            width: zone.width,
            height: zone.height,
          },
        });

        // Update rack positions within zone
        if (zone.racks && Array.isArray(zone.racks)) {
          for (const rack of zone.racks) {
            await prisma.rack.update({
              where: { id: rack.id },
              data: {
                posX: rack.posX,
                posY: rack.posY,
              },
            });
          }
        }
      }
    }

    // Fetch and return updated layout
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

    return NextResponse.json(warehouse);
  } catch (error) {
    console.error("Failed to update warehouse layout:", error);
    return NextResponse.json(
      { error: "Failed to update warehouse layout" },
      { status: 500 }
    );
  }
}

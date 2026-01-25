import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

// POST /api/zones/[id]/bulk-arrange
// Bulk arrange racks within a zone
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const zoneId = parseInt(id);
    const body = await request.json();

    const {
      columns = 2,         // 열 수 (가로로 몇 개 배치)
      rows,                // 행 수 (세로로 몇 개 배치) - null이면 자동 계산
      gapX = 18,           // 가로 간격
      gapY = 12,           // 세로 간격
      startX = 0,          // 시작 X 좌표
      startY = 0,          // 시작 Y 좌표
      shelfCount,          // 선반 수 (선택, null이면 변경 안함)
      sortBy = "rowNumber", // 정렬 기준: "rowNumber" | "id" | "current"
      arrangeBy = "columns", // 배열 방향: "columns" (열 우선) | "rows" (행 우선)
    } = body;

    // Get zone with racks
    const zone = await prisma.zone.findUnique({
      where: { id: zoneId },
      include: {
        racks: true,
      },
    });

    if (!zone) {
      return NextResponse.json({ error: "Zone not found" }, { status: 404 });
    }

    if (!zone.racks || zone.racks.length === 0) {
      return NextResponse.json({ error: "No racks in this zone" }, { status: 400 });
    }

    // Sort racks (rowNumber는 문자열이므로 숫자로 변환해서 정렬)
    const sortedRacks = [...zone.racks].sort((a, b) => {
      if (sortBy === "rowNumber") {
        const numA = parseInt(a.rowNumber) || 0;
        const numB = parseInt(b.rowNumber) || 0;
        return numA - numB;
      } else if (sortBy === "id") {
        return a.id - b.id;
      } else {
        // current (posX)
        return a.posX - b.posX;
      }
    });

    // Calculate new positions for each rack
    // rows가 명시적으로 지정되면 rows를 우선시하고 columns를 자동 계산
    // arrangeBy: "columns" = 열 우선 (좌→우, 상→하), "rows" = 행 우선 (상→하, 좌→우)
    const rackCount = sortedRacks.length;

    let effectiveColumns: number;
    let effectiveRows: number;

    if (rows) {
      // rows가 지정되면 rows를 우선시, columns는 자동 계산 (rows 값을 보장)
      effectiveRows = rows;
      effectiveColumns = Math.ceil(rackCount / effectiveRows);
    } else {
      // rows가 없으면 columns로 계산
      effectiveColumns = columns || 1;
      effectiveRows = Math.ceil(rackCount / effectiveColumns);
    }

    const updates = sortedRacks.map((rack, index) => {
      let col: number, row: number;

      if (arrangeBy === "rows") {
        // 행 우선: 위에서 아래로 먼저, 그 다음 오른쪽으로
        col = Math.floor(index / effectiveRows);
        row = index % effectiveRows;
      } else {
        // 열 우선 (기본): 왼쪽에서 오른쪽으로 먼저, 그 다음 아래로
        col = index % effectiveColumns;
        row = Math.floor(index / effectiveColumns);
      }

      const newPosX = startX + col * gapX;
      const newPosY = startY + row * gapY;

      return {
        id: rack.id,
        posX: newPosX,
        posY: newPosY,
        ...(shelfCount !== null && shelfCount !== undefined ? { shelfCount } : {}),
      };
    });

    // Update all racks in a transaction
    await prisma.$transaction(
      updates.map((update) =>
        prisma.rack.update({
          where: { id: update.id },
          data: {
            posX: update.posX,
            posY: update.posY,
            ...(update.shelfCount !== undefined ? { shelfCount: update.shelfCount } : {}),
          },
        })
      )
    );

    // Return updated zone
    const updatedZone = await prisma.zone.findUnique({
      where: { id: zoneId },
      include: {
        racks: {
          include: {
            shelves: true,
          },
          orderBy: { rowNumber: "asc" },
        },
      },
    });

    return NextResponse.json({
      message: `${updates.length}개의 Rack 위치가 조정되었습니다.`,
      zone: updatedZone,
      updates,
    });
  } catch (error) {
    console.error("Failed to bulk arrange racks:", error);
    return NextResponse.json(
      { error: "Failed to bulk arrange racks" },
      { status: 500 }
    );
  }
}

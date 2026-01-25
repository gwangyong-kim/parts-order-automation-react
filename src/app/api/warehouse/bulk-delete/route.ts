import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";

export async function DELETE(request: Request) {
  try {
    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "삭제할 창고를 선택해주세요." },
        { status: 400 }
      );
    }

    // 삭제 (Cascade로 Zone, Rack, Shelf 자동 삭제)
    const result = await prisma.warehouse.deleteMany({
      where: {
        id: { in: ids },
      },
    });

    return NextResponse.json({
      message: `${result.count}개의 창고가 삭제되었습니다.`,
      count: result.count,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

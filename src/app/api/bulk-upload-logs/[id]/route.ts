import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";

// GET - 개별 업로드 로그 조회 (오류 상세 포함)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const logId = parseInt(id);

    if (isNaN(logId)) {
      return NextResponse.json(
        { error: "유효하지 않은 로그 ID입니다." },
        { status: 400 }
      );
    }

    const log = await prisma.bulkUploadLog.findUnique({
      where: { id: logId },
    });

    if (!log) {
      return NextResponse.json(
        { error: "로그를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...log,
      errors: log.errors ? JSON.parse(log.errors) : [],
    });
  } catch (error) {
    return handleApiError(error);
  }
}

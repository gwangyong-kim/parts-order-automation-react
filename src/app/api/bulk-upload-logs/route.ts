import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";

// GET - 업로드 로그 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uploadType = searchParams.get("uploadType");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const includeStats = searchParams.get("includeStats") === "true";

    const where: {
      uploadType?: string;
      status?: string;
    } = {};

    if (uploadType) {
      where.uploadType = uploadType;
    }

    if (status) {
      where.status = status;
    }

    // 병렬로 로그와 카운트 조회 (errors는 목록에서 제외하여 속도 향상)
    const [logs, total] = await Promise.all([
      prisma.bulkUploadLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          uploadType: true,
          fileName: true,
          totalRows: true,
          successCount: true,
          failedCount: true,
          status: true,
          performedBy: true,
          createdAt: true,
          // errors는 hasErrors 플래그로만 표시 (상세는 개별 조회)
          errors: true,
        },
      }),
      prisma.bulkUploadLog.count({ where }),
    ]);

    // errors 필드를 hasErrors 플래그로 변환하고 개수만 표시
    const logsWithErrorInfo = logs.map((log) => {
      const parsedErrors = log.errors ? JSON.parse(log.errors) : [];
      return {
        ...log,
        hasErrors: parsedErrors.length > 0,
        errorCount: parsedErrors.length,
        errors: undefined, // 목록에서는 에러 상세 제외
      };
    });

    // 통계 데이터 (선택적)
    let stats = null;
    if (includeStats) {
      const [completed, partial, failed, totalAll] = await Promise.all([
        prisma.bulkUploadLog.count({ where: { ...where, status: "COMPLETED" } }),
        prisma.bulkUploadLog.count({ where: { ...where, status: "PARTIAL" } }),
        prisma.bulkUploadLog.count({ where: { ...where, status: "FAILED" } }),
        prisma.bulkUploadLog.count({ where }),
      ]);
      stats = { total: totalAll, completed, partial, failed };
    }

    return NextResponse.json({
      data: logsWithErrorInfo,
      total,
      limit,
      offset,
      stats,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE - 업로드 로그 삭제 (전체 또는 특정 기간)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = searchParams.get("days"); // N일 이전 로그 삭제
    const id = searchParams.get("id"); // 특정 로그 삭제

    if (id) {
      await prisma.bulkUploadLog.delete({
        where: { id: parseInt(id) },
      });
      return NextResponse.json({ message: "로그가 삭제되었습니다." });
    }

    if (days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

      const result = await prisma.bulkUploadLog.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
        },
      });

      return NextResponse.json({
        message: `${result.count}개의 로그가 삭제되었습니다.`,
        deleted: result.count,
      });
    }

    return NextResponse.json(
      { error: "삭제할 대상을 지정해주세요. (id 또는 days)" },
      { status: 400 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

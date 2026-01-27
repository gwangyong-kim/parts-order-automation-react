import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import prisma from "@/lib/prisma";

// 백업 히스토리 조회 (ADMIN, MANAGER)
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN", "MANAGER"]);
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const type = searchParams.get("type");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (type) where.backupType = type;
    if (status) where.status = status;

    const [history, total] = await Promise.all([
      prisma.backupHistory.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.backupHistory.count({ where }),
    ]);

    return NextResponse.json({
      history,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("백업 히스토리 조회 오류:", error);
    return handleApiError(error);
  }
}

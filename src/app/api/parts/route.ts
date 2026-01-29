import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { partApiSchema } from "@/schemas/part.schema";
import { handleApiError, createdResponse } from "@/lib/api-error";
import { requireAuth, requireAdmin } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    // 인증된 사용자만 조회 가능
    const authResult = await requireAuth();
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const skip = (page - 1) * pageSize;

    const [parts, total] = await Promise.all([
      prisma.part.findMany({
        where: { isActive: true },
        include: {
          category: true,
          supplier: true,
          inventory: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.part.count({ where: { isActive: true } }),
    ]);

    // DB 필드명을 프론트엔드 필드명으로 변환
    const transformedParts = parts.map((part) => ({
      ...part,
      partNumber: part.partCode,
      leadTime: part.leadTimeDays,
    }));

    return NextResponse.json({
      data: transformedParts,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    // 마스터 데이터 생성: ADMIN, MANAGER만 가능
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const body = await request.json();

    // 프론트엔드 필드명을 DB 필드명으로 변환
    const apiData = {
      partCode: body.partNumber || body.partCode,
      partName: body.partName,
      description: body.description || body.specification,
      unit: body.unit || "EA",
      unitPrice: body.unitPrice || 0,
      safetyStock: body.safetyStock || 0,
      minOrderQty: body.minOrderQty || 1,
      leadTimeDays: body.leadTime || body.leadTimeDays || 7,
      categoryId: body.categoryId || null,
      supplierId: body.supplierId || null,
      storageLocation: body.storageLocation || null,
    };

    // Zod 스키마로 검증
    const result = partApiSchema.safeParse(apiData);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "입력값 검증에 실패했습니다.",
          code: "VALIDATION_ERROR",
          details: { fields: result.error.flatten().fieldErrors },
        },
        { status: 400 }
      );
    }

    const { categoryId, supplierId, ...restData } = result.data;
    const part = await prisma.part.create({
      data: {
        ...restData,
        partName: restData.partName || "",
        ...(categoryId && { category: { connect: { id: categoryId } } }),
        ...(supplierId && { supplier: { connect: { id: supplierId } } }),
      },
      include: {
        category: true,
        supplier: true,
      },
    });

    // Create initial inventory record
    await prisma.inventory.create({
      data: {
        partId: part.id,
        currentQty: 0,
        reservedQty: 0,
        incomingQty: 0,
      },
    });

    // 응답 데이터 변환
    const response = {
      ...part,
      partNumber: part.partCode,
      leadTime: part.leadTimeDays,
    };

    return createdResponse(response);
  } catch (error) {
    return handleApiError(error);
  }
}

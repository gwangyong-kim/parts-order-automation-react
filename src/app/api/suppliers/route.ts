import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError, badRequest, createdResponse } from "@/lib/api-error";
import { requireAuth, requireAdmin } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const skip = (page - 1) * pageSize;

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.supplier.count({ where: { isActive: true } }),
    ]);

    return NextResponse.json({
      data: suppliers,
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
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const body = await request.json();

    if (!body.code || !body.name) {
      throw badRequest("업체코드와 업체명은 필수입니다.");
    }

    // 코드 중복 체크
    const existing = await prisma.supplier.findUnique({
      where: { code: body.code },
    });

    if (existing) {
      throw badRequest("이미 존재하는 업체코드입니다.");
    }

    const supplier = await prisma.supplier.create({
      data: {
        code: body.code,
        name: body.name,
        contactPerson: body.contactPerson || null,
        phone: body.phone || null,
        email: body.email || null,
        address: body.address || null,
        leadTimeDays: body.leadTimeDays || 7,
        paymentTerms: body.paymentTerms || null,
        notes: body.notes || null,
      },
    });

    return createdResponse(supplier);
  } catch (error) {
    return handleApiError(error);
  }
}

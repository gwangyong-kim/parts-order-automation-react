import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(suppliers);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.code || !body.name) {
      return NextResponse.json(
        { error: "업체코드와 업체명은 필수입니다." },
        { status: 400 }
      );
    }

    // 코드 중복 체크
    const existing = await prisma.supplier.findUnique({
      where: { code: body.code },
    });

    if (existing) {
      return NextResponse.json(
        { error: "이미 존재하는 업체코드입니다." },
        { status: 400 }
      );
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

    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

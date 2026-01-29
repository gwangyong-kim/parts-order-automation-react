import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError, notFound, deletedResponse } from "@/lib/api-error";
import { requireAuth, requireAdmin } from "@/lib/authorization";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const { id } = await params;
    const supplier = await prisma.supplier.findUnique({
      where: { id: parseInt(id) },
    });

    if (!supplier) {
      throw notFound("공급업체");
    }

    return NextResponse.json(supplier);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const { id } = await params;
    const body = await request.json();

    const supplier = await prisma.supplier.update({
      where: { id: parseInt(id) },
      data: {
        code: body.supplierCode || body.code,
        name: body.name,
        contactPerson: body.contactPerson,
        phone: body.phone,
        email: body.email,
        address: body.address,
        isActive: body.isActive,
      },
    });

    return NextResponse.json(supplier);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const { id } = await params;

    // Soft delete
    await prisma.supplier.update({
      where: { id: parseInt(id) },
      data: { isActive: false },
    });

    return deletedResponse("공급업체가 삭제되었습니다.");
  } catch (error) {
    return handleApiError(error);
  }
}

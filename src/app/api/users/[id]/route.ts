import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hash } from "bcryptjs";
import { handleApiError, notFound, badRequest, deletedResponse } from "@/lib/api-error";
import { requireAuth, requireAdmin } from "@/lib/authorization";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    // 인증된 사용자만 조회 가능
    const authResult = await requireAuth();
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        department: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw notFound("사용자");
    }

    return NextResponse.json(user);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    // 관리자만 사용자 수정 가능
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const { id } = await params;
    const body = await request.json();

    // Check if username is being changed and if new username exists
    if (body.username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username: body.username,
          NOT: { id: parseInt(id) },
        },
      });

      if (existingUser) {
        throw badRequest("Username already exists");
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      name: body.name,
      email: body.email,
      role: body.role,
      department: body.department,
      isActive: body.isActive,
    };

    // Only update password if provided
    if (body.password) {
      updateData.passwordHash = await hash(body.password, 12);
    }

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        department: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    // 관리자만 사용자 삭제 가능
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const { id } = await params;

    // Soft delete - just deactivate the user
    await prisma.user.update({
      where: { id: parseInt(id) },
      data: { isActive: false },
    });

    return deletedResponse("사용자가 비활성화되었습니다.");
  } catch (error) {
    return handleApiError(error);
  }
}

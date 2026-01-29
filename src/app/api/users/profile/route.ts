import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError, badRequest } from "@/lib/api-error";
import { requireAuth } from "@/lib/authorization";

// 현재 로그인한 사용자의 프로필 수정
export async function PATCH(request: Request) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const userId = authResult.session.user.id;
    const body = await request.json();

    // 허용된 필드만 업데이트
    const allowedFields = ["name", "email", "department"];
    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw badRequest("수정할 내용이 없습니다.");
    }

    // 이메일 중복 검사
    if (updateData.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: updateData.email as string,
          NOT: { id: userId },
        },
      });

      if (existingUser) {
        throw badRequest("이미 사용 중인 이메일입니다.");
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        department: true,
        profileImage: true,
        isActive: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    return handleApiError(error);
  }
}

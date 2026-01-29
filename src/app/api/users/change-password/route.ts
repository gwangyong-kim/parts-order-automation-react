import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hash, compare } from "bcryptjs";
import { handleApiError, badRequest, unauthorized } from "@/lib/api-error";
import { requireAuth } from "@/lib/authorization";

export async function POST(request: Request) {
  try {
    // 인증된 사용자만 접근 가능
    const authResult = await requireAuth();
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const { session } = authResult;
    const userId = typeof session.user.id === "string" ? parseInt(session.user.id) : session.user.id;

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // 입력값 검증
    if (!currentPassword || !newPassword) {
      throw badRequest("현재 비밀번호와 새 비밀번호를 모두 입력해주세요.");
    }

    if (newPassword.length < 4) {
      throw badRequest("새 비밀번호는 최소 4자 이상이어야 합니다.");
    }

    // 현재 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      throw unauthorized("사용자를 찾을 수 없습니다.");
    }

    // 현재 비밀번호 확인
    const isPasswordValid = await compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw badRequest("현재 비밀번호가 일치하지 않습니다.");
    }

    // 새 비밀번호로 업데이트
    const newPasswordHash = await hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return NextResponse.json({ message: "비밀번호가 성공적으로 변경되었습니다." });
  } catch (error) {
    return handleApiError(error);
  }
}

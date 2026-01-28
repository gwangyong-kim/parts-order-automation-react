import { NextResponse } from "next/server";
import sharp from "sharp";
import prisma from "@/lib/prisma";
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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      throw badRequest("파일을 선택해주세요.");
    }

    // 파일 타입 검증
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      throw badRequest("지원하지 않는 파일 형식입니다. (JPG, PNG, GIF, WebP만 허용)");
    }

    // 파일 크기 검증 (5MB 제한)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw badRequest("파일 크기는 5MB를 초과할 수 없습니다.");
    }

    // 현재 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw unauthorized("사용자를 찾을 수 없습니다.");
    }

    // 이미지를 Base64로 변환 (sharp로 리사이징 후)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 이미지 리사이징: 200x200, 고품질 webp로 변환
    const processedBuffer = await sharp(buffer)
      .resize(200, 200, {
        fit: "cover",
        position: "center",
      })
      .webp({ quality: 90 })
      .toBuffer();

    // Base64 Data URL 생성
    const base64Image = `data:image/webp;base64,${processedBuffer.toString("base64")}`;

    // DB 업데이트 (Base64 데이터로 저장)
    await prisma.user.update({
      where: { id: userId },
      data: { profileImage: base64Image },
    });

    return NextResponse.json({
      message: "프로필 이미지가 업데이트되었습니다.",
      profileImage: base64Image,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  try {
    // 인증된 사용자만 접근 가능
    const authResult = await requireAuth();
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const { session } = authResult;
    const userId = typeof session.user.id === "string" ? parseInt(session.user.id) : session.user.id;

    // 현재 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw unauthorized("사용자를 찾을 수 없습니다.");
    }

    // DB 업데이트 (Base64 데이터 삭제)
    await prisma.user.update({
      where: { id: userId },
      data: { profileImage: null },
    });

    return NextResponse.json({
      message: "프로필 이미지가 삭제되었습니다.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

interface Params {
  params: Promise<{ path: string[] }>;
}

// 파일 확장자에 따른 MIME 타입 매핑
const mimeTypes: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

export async function GET(request: Request, { params }: Params) {
  try {
    const { path: pathSegments } = await params;
    const filePath = path.join(process.cwd(), "public", "uploads", ...pathSegments);

    // 보안: uploads 디렉토리 외부 접근 방지
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    if (!filePath.startsWith(uploadsDir)) {
      return NextResponse.json({ error: "잘못된 경로입니다." }, { status: 400 });
    }

    // 파일 존재 확인
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
    }

    // 파일 읽기
    const fileBuffer = await readFile(filePath);

    // 확장자에서 MIME 타입 결정
    const ext = path.extname(filePath).toLowerCase().slice(1);
    const contentType = mimeTypes[ext] || "application/octet-stream";

    // 응답 반환
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("File serve error:", error);
    return NextResponse.json({ error: "파일을 불러올 수 없습니다." }, { status: 500 });
  }
}

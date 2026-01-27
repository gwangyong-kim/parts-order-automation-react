import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const BACKUP_DIR = process.env.NODE_ENV === "production" ? "/app/data/backups" : "./prisma/backups";

// 백업 파일 다운로드
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> }
) {
  try {
    const { fileName } = await params;
    const backupPath = path.join(BACKUP_DIR, fileName);

    // 파일 존재 확인
    try {
      await fs.access(backupPath);
    } catch {
      return NextResponse.json(
        { error: "백업 파일을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const fileBuffer = await fs.readFile(backupPath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("백업 다운로드 오류:", error);
    return NextResponse.json(
      { error: "백업 다운로드에 실패했습니다." },
      { status: 500 }
    );
  }
}

// 백업 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> }
) {
  try {
    const { fileName } = await params;
    const backupPath = path.join(BACKUP_DIR, fileName);

    // 파일 존재 확인
    try {
      await fs.access(backupPath);
    } catch {
      return NextResponse.json(
        { error: "백업 파일을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 백업 파일 삭제
    await fs.unlink(backupPath);

    // 메타 파일도 삭제
    try {
      await fs.unlink(path.join(BACKUP_DIR, `${fileName}.meta.json`));
    } catch {
      // 메타 파일이 없을 수 있음
    }

    return NextResponse.json({
      success: true,
      message: "백업이 삭제되었습니다.",
    });
  } catch (error) {
    console.error("백업 삭제 오류:", error);
    return NextResponse.json(
      { error: "백업 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}

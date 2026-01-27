import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = process.env.NODE_ENV === "production" ? "/app/data" : "./prisma";
const BACKUP_DIR = process.env.NODE_ENV === "production" ? "/app/data/backups" : "./prisma/backups";
const DB_FILE = process.env.NODE_ENV === "production" ? "partsync.db" : "dev.db";
const MAX_BACKUPS = 7;

// 백업 목록 조회
export async function GET() {
  try {
    // 백업 디렉토리 확인/생성
    try {
      await fs.access(BACKUP_DIR);
    } catch {
      await fs.mkdir(BACKUP_DIR, { recursive: true });
    }

    const files = await fs.readdir(BACKUP_DIR);
    const backups = await Promise.all(
      files
        .filter((f) => f.endsWith(".db"))
        .map(async (fileName) => {
          const filePath = path.join(BACKUP_DIR, fileName);
          const stat = await fs.stat(filePath);
          return {
            fileName,
            createdAt: stat.mtime.toISOString(),
            size: stat.size,
            sizeFormatted: formatBytes(stat.size),
          };
        })
    );

    // 최신순 정렬
    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 현재 DB 정보
    const dbPath = path.join(DATA_DIR, DB_FILE);
    let currentDbInfo = null;
    try {
      const dbStat = await fs.stat(dbPath);
      currentDbInfo = {
        size: dbStat.size,
        sizeFormatted: formatBytes(dbStat.size),
        lastModified: dbStat.mtime.toISOString(),
      };
    } catch {
      // DB 파일이 없는 경우
    }

    return NextResponse.json({
      backups,
      currentDb: currentDbInfo,
      config: {
        maxBackups: MAX_BACKUPS,
        backupDir: BACKUP_DIR,
      },
    });
  } catch (error) {
    console.error("백업 목록 조회 오류:", error);
    return NextResponse.json(
      { error: "백업 목록을 불러오는데 실패했습니다." },
      { status: 500 }
    );
  }
}

// 수동 백업 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const description = body.description || "";

    // 백업 디렉토리 확인/생성
    try {
      await fs.access(BACKUP_DIR);
    } catch {
      await fs.mkdir(BACKUP_DIR, { recursive: true });
    }

    const dbPath = path.join(DATA_DIR, DB_FILE);

    // DB 파일 존재 확인
    try {
      await fs.access(dbPath);
    } catch {
      return NextResponse.json(
        { error: "데이터베이스 파일을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 백업 파일명 생성
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFileName = `backup_${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    // 백업 복사
    await fs.copyFile(dbPath, backupPath);

    // 메타데이터 저장
    const metaPath = path.join(BACKUP_DIR, `${backupFileName}.meta.json`);
    await fs.writeFile(
      metaPath,
      JSON.stringify({
        description,
        createdAt: new Date().toISOString(),
        type: "manual",
      })
    );

    // 오래된 백업 정리
    await cleanupOldBackups();

    const stat = await fs.stat(backupPath);

    return NextResponse.json({
      success: true,
      message: "백업이 완료되었습니다.",
      backup: {
        fileName: backupFileName,
        createdAt: new Date().toISOString(),
        size: stat.size,
        sizeFormatted: formatBytes(stat.size),
      },
    });
  } catch (error) {
    console.error("백업 생성 오류:", error);
    return NextResponse.json(
      { error: "백업 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}

// 오래된 백업 정리
async function cleanupOldBackups() {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const backupFiles = files.filter((f) => f.endsWith(".db"));

    if (backupFiles.length <= MAX_BACKUPS) return;

    // 파일 정보와 함께 정렬
    const filesWithStats = await Promise.all(
      backupFiles.map(async (fileName) => {
        const filePath = path.join(BACKUP_DIR, fileName);
        const stat = await fs.stat(filePath);
        return { fileName, mtime: stat.mtime.getTime() };
      })
    );

    // 오래된 순으로 정렬
    filesWithStats.sort((a, b) => a.mtime - b.mtime);

    // 오래된 백업 삭제
    const toDelete = filesWithStats.slice(0, filesWithStats.length - MAX_BACKUPS);
    for (const file of toDelete) {
      await fs.unlink(path.join(BACKUP_DIR, file.fileName));
      // 메타 파일도 삭제
      try {
        await fs.unlink(path.join(BACKUP_DIR, `${file.fileName}.meta.json`));
      } catch {
        // 메타 파일이 없을 수 있음
      }
    }
  } catch (error) {
    console.error("백업 정리 오류:", error);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

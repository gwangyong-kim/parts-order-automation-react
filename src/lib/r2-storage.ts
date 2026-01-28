/**
 * Cloudflare R2 Storage Integration
 *
 * PartSync 백업 데이터를 R2에 저장/관리하는 라이브러리
 * S3 호환 API 사용
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-require-imports */
import { promises as fs } from "fs";
import path from "path";

// Dynamic import to work around Next.js module resolution issues
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");

// R2 설정
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_BACKUP_PREFIX = process.env.R2_BACKUP_PREFIX || "backups/";

export interface R2BackupFile {
  name: string;
  size: number;
  sizeFormatted: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, string>;
}

export interface R2UploadResult {
  success: boolean;
  fileName?: string;
  error?: string;
}

export interface R2DownloadResult {
  success: boolean;
  localPath?: string;
  error?: string;
}

let s3Client: any = null;

/**
 * R2 설정 검증
 */
export function isR2Configured(): boolean {
  return !!(
    R2_ACCOUNT_ID &&
    R2_ACCESS_KEY_ID &&
    R2_SECRET_ACCESS_KEY &&
    R2_BUCKET_NAME
  );
}

/**
 * S3 클라이언트 초기화
 */
function getS3Client(): any {
  if (s3Client) return s3Client;

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 환경 변수가 설정되지 않았습니다.");
  }

  s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  return s3Client;
}

/**
 * R2 연결 테스트
 */
export async function testR2Connection(): Promise<{
  success: boolean;
  message: string;
  bucketName?: string;
}> {
  try {
    if (!isR2Configured()) {
      return {
        success: false,
        message: "R2 환경 변수가 설정되지 않았습니다.",
      };
    }

    const client = getS3Client();

    // 테스트 파일로 연결 확인
    const testFileName = `${R2_BACKUP_PREFIX}.connection-test`;
    const testContent = `Connection test: ${new Date().toISOString()}`;

    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: testFileName,
        Body: testContent,
      })
    );

    // 테스트 파일 삭제
    await client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: testFileName,
      })
    ).catch(() => {}); // 삭제 실패해도 무시

    return {
      success: true,
      message: "R2 연결 성공",
      bucketName: R2_BUCKET_NAME,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return {
      success: false,
      message: `R2 연결 실패: ${message}`,
    };
  }
}

/**
 * 파일을 R2에 업로드
 */
export async function uploadToR2(
  localFilePath: string,
  options?: {
    destinationName?: string;
    metadata?: Record<string, string>;
  }
): Promise<R2UploadResult> {
  try {
    if (!isR2Configured()) {
      return { success: false, error: "R2가 설정되지 않았습니다." };
    }

    const client = getS3Client();
    const fileName = options?.destinationName || path.basename(localFilePath);
    const destination = `${R2_BACKUP_PREFIX}${fileName}`;

    // 파일 존재 확인
    try {
      await fs.access(localFilePath);
    } catch {
      return { success: false, error: "로컬 파일을 찾을 수 없습니다." };
    }

    // 파일 읽기
    const fileBuffer = await fs.readFile(localFilePath);

    // 업로드
    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: destination,
        Body: fileBuffer,
        Metadata: options?.metadata || {},
      })
    );

    console.log(`R2 업로드 완료: ${destination}`);

    return {
      success: true,
      fileName: destination,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("R2 업로드 오류:", message);
    return { success: false, error: message };
  }
}

/**
 * R2에서 파일 다운로드
 */
export async function downloadFromR2(
  r2FileName: string,
  localDestination: string
): Promise<R2DownloadResult> {
  try {
    if (!isR2Configured()) {
      return { success: false, error: "R2가 설정되지 않았습니다." };
    }

    const client = getS3Client();
    const sourcePath = r2FileName.startsWith(R2_BACKUP_PREFIX)
      ? r2FileName
      : `${R2_BACKUP_PREFIX}${r2FileName}`;

    // 디렉토리 생성
    await fs.mkdir(path.dirname(localDestination), { recursive: true });

    // 다운로드
    const response = await client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: sourcePath,
      })
    );

    if (!response.Body) {
      return { success: false, error: "파일 내용이 비어있습니다." };
    }

    // Stream을 Buffer로 변환
    const chunks: Uint8Array[] = [];
    const stream = response.Body as any;
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // 파일 저장
    await fs.writeFile(localDestination, buffer);

    console.log(`R2 다운로드 완료: ${sourcePath} -> ${localDestination}`);

    return {
      success: true,
      localPath: localDestination,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("R2 다운로드 오류:", message);
    return { success: false, error: message };
  }
}

/**
 * R2 백업 파일 목록 조회
 */
export async function listR2Backups(): Promise<R2BackupFile[]> {
  try {
    if (!isR2Configured()) {
      return [];
    }

    const client = getS3Client();
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        Prefix: R2_BACKUP_PREFIX,
      })
    );

    const backups: R2BackupFile[] = [];
    const contents = response.Contents || [];

    for (const item of contents) {
      // .db 파일만 필터링
      if (!item.Key?.endsWith(".db")) continue;

      const size = item.Size || 0;

      backups.push({
        name: item.Key.replace(R2_BACKUP_PREFIX, ""),
        size,
        sizeFormatted: formatBytes(size),
        createdAt: item.LastModified?.toISOString() || "",
        updatedAt: item.LastModified?.toISOString() || "",
      });
    }

    // 최신순 정렬
    backups.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return backups;
  } catch (error) {
    console.error("R2 목록 조회 오류:", error);
    return [];
  }
}

/**
 * R2에서 파일 삭제
 */
export async function deleteFromR2(
  r2FileName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isR2Configured()) {
      return { success: false, error: "R2가 설정되지 않았습니다." };
    }

    const client = getS3Client();
    const filePath = r2FileName.startsWith(R2_BACKUP_PREFIX)
      ? r2FileName
      : `${R2_BACKUP_PREFIX}${r2FileName}`;

    await client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: filePath,
      })
    );

    // 관련 파일들도 삭제 시도
    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: `${filePath}.meta.json`,
        })
      );
    } catch {
      // 메타 파일이 없을 수 있음
    }
    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: `${filePath}.sha256`,
        })
      );
    } catch {
      // 체크섬 파일이 없을 수 있음
    }

    console.log(`R2 파일 삭제 완료: ${filePath}`);

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("R2 삭제 오류:", message);
    return { success: false, error: message };
  }
}

/**
 * 백업 파일과 메타데이터를 함께 업로드
 */
export async function uploadBackupWithMeta(
  dbFilePath: string,
  metadata: Record<string, unknown>
): Promise<R2UploadResult> {
  try {
    const fileName = path.basename(dbFilePath);

    // DB 파일 업로드
    const dbResult = await uploadToR2(dbFilePath, {
      metadata: {
        backupType: String(metadata.type || "MANUAL"),
        createdBy: String(metadata.createdBy || "system"),
        appVersion: String(metadata.appVersion || ""),
      },
    });

    if (!dbResult.success) {
      return dbResult;
    }

    // 메타데이터 파일 업로드
    const metaFilePath = `${dbFilePath}.meta.json`;
    try {
      await fs.access(metaFilePath);
      await uploadToR2(metaFilePath);
    } catch {
      // 메타 파일이 없으면 생성하여 업로드
      const tempMetaPath = `/tmp/${fileName}.meta.json`;
      await fs.writeFile(tempMetaPath, JSON.stringify(metadata, null, 2));
      await uploadToR2(tempMetaPath, {
        destinationName: `${fileName}.meta.json`,
      });
      await fs.unlink(tempMetaPath).catch(() => {});
    }

    // 체크섬 파일 업로드
    const checksumFilePath = `${dbFilePath}.sha256`;
    try {
      await fs.access(checksumFilePath);
      await uploadToR2(checksumFilePath);
    } catch {
      // 체크섬 파일이 없으면 무시
    }

    return dbResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return { success: false, error: message };
  }
}

/**
 * R2 사용량 조회
 */
export async function getR2Usage(): Promise<{
  totalSize: number;
  totalSizeFormatted: string;
  fileCount: number;
  oldestBackup: { name: string; date: string } | null;
  newestBackup: { name: string; date: string } | null;
}> {
  try {
    const backups = await listR2Backups();

    if (backups.length === 0) {
      return {
        totalSize: 0,
        totalSizeFormatted: "0 Bytes",
        fileCount: 0,
        oldestBackup: null,
        newestBackup: null,
      };
    }

    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
    const sortedByDate = [...backups].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return {
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      fileCount: backups.length,
      oldestBackup: {
        name: sortedByDate[0].name,
        date: sortedByDate[0].createdAt,
      },
      newestBackup: {
        name: sortedByDate[sortedByDate.length - 1].name,
        date: sortedByDate[sortedByDate.length - 1].createdAt,
      },
    };
  } catch (error) {
    console.error("R2 사용량 조회 오류:", error);
    return {
      totalSize: 0,
      totalSizeFormatted: "0 Bytes",
      fileCount: 0,
      oldestBackup: null,
      newestBackup: null,
    };
  }
}

/**
 * 오래된 R2 백업 정리
 */
export async function cleanupOldR2Backups(
  maxCount: number = 30
): Promise<number> {
  try {
    const backups = await listR2Backups();

    if (backups.length <= maxCount) {
      return 0;
    }

    // 오래된 순으로 정렬
    const sortedBackups = [...backups].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const toDelete = sortedBackups.slice(0, sortedBackups.length - maxCount);
    let deletedCount = 0;

    for (const backup of toDelete) {
      const result = await deleteFromR2(backup.name);
      if (result.success) {
        deletedCount++;
      }
    }

    console.log(`R2 오래된 백업 ${deletedCount}개 삭제됨`);
    return deletedCount;
  } catch (error) {
    console.error("R2 백업 정리 오류:", error);
    return 0;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

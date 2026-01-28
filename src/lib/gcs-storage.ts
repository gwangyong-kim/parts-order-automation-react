/**
 * Google Cloud Storage Integration
 *
 * PartSync 백업 데이터를 GCS에 저장/관리하는 라이브러리
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Storage } from "@google-cloud/storage";
import { promises as fs } from "fs";
import path from "path";

// GCS 설정
const GCS_PROJECT_ID = process.env.GCS_PROJECT_ID;
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME;
const GCS_KEY_FILE = process.env.GCS_KEY_FILE;
const GCS_CREDENTIALS = process.env.GCS_CREDENTIALS;
const GCS_BACKUP_PREFIX = process.env.GCS_BACKUP_PREFIX || "backups/";

export interface GCSConfig {
  projectId?: string;
  bucketName?: string;
  keyFile?: string;
  credentials?: string;
}

export interface GCSBackupFile {
  name: string;
  size: number;
  sizeFormatted: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, string>;
  publicUrl?: string;
}

export interface GCSUploadResult {
  success: boolean;
  fileName?: string;
  publicUrl?: string;
  error?: string;
}

export interface GCSDownloadResult {
  success: boolean;
  localPath?: string;
  error?: string;
}

let storageInstance: Storage | null = null;
let bucketInstance: any = null;

/**
 * GCS 설정 검증
 */
export function isGCSConfigured(): boolean {
  return !!(
    GCS_BUCKET_NAME &&
    (GCS_KEY_FILE || GCS_CREDENTIALS || GCS_PROJECT_ID)
  );
}

/**
 * GCS 클라이언트 초기화
 */
function getStorage(): Storage {
  if (storageInstance) return storageInstance;

  const options: Record<string, unknown> = {};

  if (GCS_PROJECT_ID) {
    options.projectId = GCS_PROJECT_ID;
  }

  if (GCS_KEY_FILE) {
    options.keyFilename = GCS_KEY_FILE;
  } else if (GCS_CREDENTIALS) {
    try {
      options.credentials = JSON.parse(GCS_CREDENTIALS);
    } catch (e) {
      console.error("GCS_CREDENTIALS JSON 파싱 오류:", e);
      throw new Error("GCS 인증 정보가 올바르지 않습니다.");
    }
  }

  storageInstance = new Storage(options);
  return storageInstance;
}

/**
 * GCS 버킷 가져오기
 */
function getBucket(): any {
  if (bucketInstance) return bucketInstance;

  if (!GCS_BUCKET_NAME) {
    throw new Error("GCS_BUCKET_NAME 환경 변수가 설정되지 않았습니다.");
  }

  const storage = getStorage();
  bucketInstance = storage.bucket(GCS_BUCKET_NAME);
  return bucketInstance;
}

/**
 * GCS 연결 테스트
 */
export async function testGCSConnection(): Promise<{
  success: boolean;
  message: string;
  bucketName?: string;
}> {
  try {
    if (!isGCSConfigured()) {
      return {
        success: false,
        message: "GCS 환경 변수가 설정되지 않았습니다.",
      };
    }

    const bucket = getBucket();

    // 테스트 파일로 연결 확인 (getMetadata 대신 파일 작업으로 테스트)
    const testFileName = `${GCS_BACKUP_PREFIX}.connection-test`;
    const testFile = bucket.file(testFileName);
    await testFile.save(`Connection test: ${new Date().toISOString()}`);
    await testFile.delete().catch(() => {}); // 테스트 파일 삭제 (실패해도 무시)

    return {
      success: true,
      message: "GCS 연결 성공",
      bucketName: GCS_BUCKET_NAME,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return {
      success: false,
      message: `GCS 연결 실패: ${message}`,
    };
  }
}

/**
 * 파일을 GCS에 업로드
 */
export async function uploadToGCS(
  localFilePath: string,
  options?: {
    destinationName?: string;
    metadata?: Record<string, string>;
    makePublic?: boolean;
  }
): Promise<GCSUploadResult> {
  try {
    if (!isGCSConfigured()) {
      return { success: false, error: "GCS가 설정되지 않았습니다." };
    }

    const bucket = getBucket();
    const fileName = options?.destinationName || path.basename(localFilePath);
    const destination = `${GCS_BACKUP_PREFIX}${fileName}`;

    // 파일 존재 확인
    try {
      await fs.access(localFilePath);
    } catch {
      return { success: false, error: "로컬 파일을 찾을 수 없습니다." };
    }

    // 업로드
    await bucket.upload(localFilePath, {
      destination,
      metadata: {
        metadata: options?.metadata || {},
      },
    });

    // 공개 설정 (선택)
    let publicUrl: string | undefined;
    if (options?.makePublic) {
      const file = bucket.file(destination);
      await file.makePublic();
      publicUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${destination}`;
    }

    console.log(`GCS 업로드 완료: ${destination}`);

    return {
      success: true,
      fileName: destination,
      publicUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("GCS 업로드 오류:", message);
    return { success: false, error: message };
  }
}

/**
 * GCS에서 파일 다운로드
 */
export async function downloadFromGCS(
  gcsFileName: string,
  localDestination: string
): Promise<GCSDownloadResult> {
  try {
    if (!isGCSConfigured()) {
      return { success: false, error: "GCS가 설정되지 않았습니다." };
    }

    const bucket = getBucket();
    const sourcePath = gcsFileName.startsWith(GCS_BACKUP_PREFIX)
      ? gcsFileName
      : `${GCS_BACKUP_PREFIX}${gcsFileName}`;

    // 디렉토리 생성
    await fs.mkdir(path.dirname(localDestination), { recursive: true });

    // 다운로드
    await bucket.file(sourcePath).download({
      destination: localDestination,
    });

    console.log(`GCS 다운로드 완료: ${sourcePath} -> ${localDestination}`);

    return {
      success: true,
      localPath: localDestination,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("GCS 다운로드 오류:", message);
    return { success: false, error: message };
  }
}

/**
 * GCS 백업 파일 목록 조회
 */
export async function listGCSBackups(): Promise<GCSBackupFile[]> {
  try {
    if (!isGCSConfigured()) {
      return [];
    }

    const bucket = getBucket();
    const [files] = await bucket.getFiles({
      prefix: GCS_BACKUP_PREFIX,
    });

    const backups: GCSBackupFile[] = [];

    for (const file of files) {
      // .db 파일만 필터링
      if (!file.name.endsWith(".db")) continue;

      const [metadata] = await file.getMetadata();
      const size = parseInt(metadata.size as string, 10) || 0;

      backups.push({
        name: file.name.replace(GCS_BACKUP_PREFIX, ""),
        size,
        sizeFormatted: formatBytes(size),
        createdAt: metadata.timeCreated as string,
        updatedAt: metadata.updated as string,
        metadata: metadata.metadata as Record<string, string>,
      });
    }

    // 최신순 정렬
    backups.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return backups;
  } catch (error) {
    console.error("GCS 목록 조회 오류:", error);
    return [];
  }
}

/**
 * GCS에서 파일 삭제
 */
export async function deleteFromGCS(
  gcsFileName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isGCSConfigured()) {
      return { success: false, error: "GCS가 설정되지 않았습니다." };
    }

    const bucket = getBucket();
    const filePath = gcsFileName.startsWith(GCS_BACKUP_PREFIX)
      ? gcsFileName
      : `${GCS_BACKUP_PREFIX}${gcsFileName}`;

    await bucket.file(filePath).delete();

    // 관련 파일들도 삭제 시도
    try {
      await bucket.file(`${filePath}.meta.json`).delete();
    } catch {
      // 메타 파일이 없을 수 있음
    }
    try {
      await bucket.file(`${filePath}.sha256`).delete();
    } catch {
      // 체크섬 파일이 없을 수 있음
    }

    console.log(`GCS 파일 삭제 완료: ${filePath}`);

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("GCS 삭제 오류:", message);
    return { success: false, error: message };
  }
}

/**
 * 백업 파일과 메타데이터를 함께 업로드
 */
export async function uploadBackupWithMeta(
  dbFilePath: string,
  metadata: Record<string, unknown>
): Promise<GCSUploadResult> {
  try {
    const fileName = path.basename(dbFilePath);

    // DB 파일 업로드
    const dbResult = await uploadToGCS(dbFilePath, {
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
      await uploadToGCS(metaFilePath);
    } catch {
      // 메타 파일이 없으면 생성하여 업로드
      const tempMetaPath = `/tmp/${fileName}.meta.json`;
      await fs.writeFile(tempMetaPath, JSON.stringify(metadata, null, 2));
      await uploadToGCS(tempMetaPath, {
        destinationName: `${fileName}.meta.json`,
      });
      await fs.unlink(tempMetaPath).catch(() => {});
    }

    // 체크섬 파일 업로드
    const checksumFilePath = `${dbFilePath}.sha256`;
    try {
      await fs.access(checksumFilePath);
      await uploadToGCS(checksumFilePath);
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
 * GCS 사용량 조회
 */
export async function getGCSUsage(): Promise<{
  totalSize: number;
  totalSizeFormatted: string;
  fileCount: number;
  oldestBackup: { name: string; date: string } | null;
  newestBackup: { name: string; date: string } | null;
}> {
  try {
    const backups = await listGCSBackups();

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
    console.error("GCS 사용량 조회 오류:", error);
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
 * 오래된 GCS 백업 정리
 */
export async function cleanupOldGCSBackups(
  maxCount: number = 30
): Promise<number> {
  try {
    const backups = await listGCSBackups();

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
      const result = await deleteFromGCS(backup.name);
      if (result.success) {
        deletedCount++;
      }
    }

    console.log(`GCS 오래된 백업 ${deletedCount}개 삭제됨`);
    return deletedCount;
  } catch (error) {
    console.error("GCS 백업 정리 오류:", error);
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

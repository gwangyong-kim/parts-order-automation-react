/**
 * Cloud Backup
 *
 * AWS S3 및 Google Cloud Storage 연동
 * 참고: @aws-sdk/client-s3, @google-cloud/storage는 선택적 의존성입니다.
 * 클라우드 백업을 사용하려면 해당 패키지를 설치해야 합니다.
 */

import { promises as fs } from "fs";
import path from "path";

export type CloudProvider = "s3" | "gcs";

export interface CloudConfig {
  provider: CloudProvider;
  bucket: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  projectId?: string; // GCS
  keyFilePath?: string; // GCS
}

export interface UploadResult {
  success: boolean;
  key?: string;
  url?: string;
  error?: string;
}

export interface DownloadResult {
  success: boolean;
  localPath?: string;
  error?: string;
}

/**
 * 환경 변수에서 클라우드 설정 가져오기
 */
export function getCloudConfig(): CloudConfig | null {
  const provider = process.env.BACKUP_CLOUD_PROVIDER as CloudProvider;
  if (!provider || (provider !== "s3" && provider !== "gcs")) {
    return null;
  }

  if (provider === "s3") {
    const bucket = process.env.AWS_S3_BUCKET;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || "ap-northeast-2";

    if (!bucket || !accessKeyId || !secretAccessKey) {
      return null;
    }

    return {
      provider,
      bucket,
      region,
      accessKeyId,
      secretAccessKey,
    };
  }

  if (provider === "gcs") {
    const bucket = process.env.GCS_BUCKET;
    const projectId = process.env.GCS_PROJECT_ID;
    const keyFilePath = process.env.GCS_KEY_FILE;

    if (!bucket) {
      return null;
    }

    return {
      provider,
      bucket,
      projectId,
      keyFilePath,
    };
  }

  return null;
}

/**
 * 클라우드 백업 활성화 여부 확인
 */
export function isCloudBackupEnabled(): boolean {
  return getCloudConfig() !== null;
}

/**
 * S3에 파일 업로드
 */
async function uploadToS3(
  config: CloudConfig,
  localPath: string,
  key: string
): Promise<UploadResult> {
  try {
    // AWS SDK 동적 임포트 (설치되지 않았을 수 있음)
    let S3Client, PutObjectCommand;
    try {
      const awsS3 = await import("@aws-sdk/client-s3");
      S3Client = awsS3.S3Client;
      PutObjectCommand = awsS3.PutObjectCommand;
    } catch {
      return { success: false, error: "@aws-sdk/client-s3 패키지가 설치되지 않았습니다. npm install @aws-sdk/client-s3를 실행하세요." };
    }

    const client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId!,
        secretAccessKey: config.secretAccessKey!,
      },
    });

    const fileContent = await fs.readFile(localPath);

    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: fileContent,
      ContentType: "application/octet-stream",
      Metadata: {
        "backup-time": new Date().toISOString(),
      },
    });

    await client.send(command);

    return {
      success: true,
      key,
      url: `s3://${config.bucket}/${key}`,
    };
  } catch (error) {
    console.error("S3 업로드 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "S3 업로드 실패",
    };
  }
}

/**
 * S3에서 파일 다운로드
 */
async function downloadFromS3(
  config: CloudConfig,
  key: string,
  localPath: string
): Promise<DownloadResult> {
  try {
    let S3Client, GetObjectCommand;
    try {
      const awsS3 = await import("@aws-sdk/client-s3");
      S3Client = awsS3.S3Client;
      GetObjectCommand = awsS3.GetObjectCommand;
    } catch {
      return { success: false, error: "@aws-sdk/client-s3 패키지가 설치되지 않았습니다." };
    }

    const client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId!,
        secretAccessKey: config.secretAccessKey!,
      },
    });

    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });

    const response = await client.send(command) as { Body?: AsyncIterable<Uint8Array> };

    if (!response.Body) {
      throw new Error("파일 내용이 없습니다.");
    }

    // Stream to Buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    await fs.writeFile(localPath, buffer);

    return {
      success: true,
      localPath,
    };
  } catch (error) {
    console.error("S3 다운로드 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "S3 다운로드 실패",
    };
  }
}

/**
 * S3 백업 목록 조회
 */
async function listS3Backups(config: CloudConfig, prefix: string = "backups/"): Promise<string[]> {
  try {
    let S3Client, ListObjectsV2Command;
    try {
      const awsS3 = await import("@aws-sdk/client-s3");
      S3Client = awsS3.S3Client;
      ListObjectsV2Command = awsS3.ListObjectsV2Command;
    } catch {
      return [];
    }

    const client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId!,
        secretAccessKey: config.secretAccessKey!,
      },
    });

    const command = new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: prefix,
    });

    const response = await client.send(command) as { Contents?: Array<{ Key?: string }> };

    return (response.Contents || [])
      .filter((obj) => obj.Key?.endsWith(".db"))
      .map((obj) => obj.Key!)
      .sort()
      .reverse();
  } catch (error) {
    console.error("S3 목록 조회 오류:", error);
    return [];
  }
}

/**
 * GCS에 파일 업로드
 */
async function uploadToGCS(
  config: CloudConfig,
  localPath: string,
  key: string
): Promise<UploadResult> {
  try {
    let Storage;
    try {
      const gcs = await import("@google-cloud/storage");
      Storage = gcs.Storage;
    } catch {
      return { success: false, error: "@google-cloud/storage 패키지가 설치되지 않았습니다. npm install @google-cloud/storage를 실행하세요." };
    }

    const storageOptions: { projectId?: string; keyFilename?: string } = {};
    if (config.projectId) storageOptions.projectId = config.projectId;
    if (config.keyFilePath) storageOptions.keyFilename = config.keyFilePath;

    const storage = new Storage(storageOptions);
    const bucket = storage.bucket(config.bucket);

    await bucket.upload(localPath, {
      destination: key,
      metadata: {
        metadata: {
          "backup-time": new Date().toISOString(),
        },
      },
    });

    return {
      success: true,
      key,
      url: `gs://${config.bucket}/${key}`,
    };
  } catch (error) {
    console.error("GCS 업로드 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "GCS 업로드 실패",
    };
  }
}

/**
 * GCS에서 파일 다운로드
 */
async function downloadFromGCS(
  config: CloudConfig,
  key: string,
  localPath: string
): Promise<DownloadResult> {
  try {
    let Storage;
    try {
      const gcs = await import("@google-cloud/storage");
      Storage = gcs.Storage;
    } catch {
      return { success: false, error: "@google-cloud/storage 패키지가 설치되지 않았습니다." };
    }

    const storageOptions: { projectId?: string; keyFilename?: string } = {};
    if (config.projectId) storageOptions.projectId = config.projectId;
    if (config.keyFilePath) storageOptions.keyFilename = config.keyFilePath;

    const storage = new Storage(storageOptions);
    const bucket = storage.bucket(config.bucket);

    await bucket.file(key).download({ destination: localPath });

    return {
      success: true,
      localPath,
    };
  } catch (error) {
    console.error("GCS 다운로드 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "GCS 다운로드 실패",
    };
  }
}

/**
 * GCS 백업 목록 조회
 */
async function listGCSBackups(config: CloudConfig, prefix: string = "backups/"): Promise<string[]> {
  try {
    let Storage;
    try {
      const gcs = await import("@google-cloud/storage");
      Storage = gcs.Storage;
    } catch {
      return [];
    }

    const storageOptions: { projectId?: string; keyFilename?: string } = {};
    if (config.projectId) storageOptions.projectId = config.projectId;
    if (config.keyFilePath) storageOptions.keyFilename = config.keyFilePath;

    const storage = new Storage(storageOptions);
    const bucket = storage.bucket(config.bucket);

    const [files] = await bucket.getFiles({ prefix });

    return files
      .filter((file: { name: string }) => file.name.endsWith(".db"))
      .map((file: { name: string }) => file.name)
      .sort()
      .reverse();
  } catch (error) {
    console.error("GCS 목록 조회 오류:", error);
    return [];
  }
}

/**
 * 클라우드에 파일 업로드
 */
export async function uploadToCloud(
  localPath: string,
  key?: string
): Promise<UploadResult> {
  const config = getCloudConfig();
  if (!config) {
    return { success: false, error: "클라우드 백업이 설정되지 않았습니다." };
  }

  const fileName = key || `backups/${path.basename(localPath)}`;

  if (config.provider === "s3") {
    return uploadToS3(config, localPath, fileName);
  } else if (config.provider === "gcs") {
    return uploadToGCS(config, localPath, fileName);
  }

  return { success: false, error: "지원하지 않는 클라우드 제공자입니다." };
}

/**
 * 클라우드에서 파일 다운로드
 */
export async function downloadFromCloud(
  key: string,
  localPath: string
): Promise<DownloadResult> {
  const config = getCloudConfig();
  if (!config) {
    return { success: false, error: "클라우드 백업이 설정되지 않았습니다." };
  }

  if (config.provider === "s3") {
    return downloadFromS3(config, key, localPath);
  } else if (config.provider === "gcs") {
    return downloadFromGCS(config, key, localPath);
  }

  return { success: false, error: "지원하지 않는 클라우드 제공자입니다." };
}

/**
 * 클라우드 백업 목록 조회
 */
export async function listCloudBackups(prefix: string = "backups/"): Promise<string[]> {
  const config = getCloudConfig();
  if (!config) {
    return [];
  }

  if (config.provider === "s3") {
    return listS3Backups(config, prefix);
  } else if (config.provider === "gcs") {
    return listGCSBackups(config, prefix);
  }

  return [];
}

/**
 * 클라우드 연결 테스트
 */
export async function testCloudConnection(): Promise<{ success: boolean; message: string }> {
  const config = getCloudConfig();
  if (!config) {
    return { success: false, message: "클라우드 백업이 설정되지 않았습니다." };
  }

  try {
    const backups = await listCloudBackups();
    return {
      success: true,
      message: `연결 성공. 발견된 백업: ${backups.length}개`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "연결 실패",
    };
  }
}

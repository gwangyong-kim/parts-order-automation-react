/**
 * Backup Encryption
 *
 * AES-256-GCM 기반 백업 암호화/복호화
 */

import crypto from "crypto";
import { promises as fs } from "fs";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32;
const KEY_LENGTH = 32; // 256 bits
const ITERATIONS = 100000;

/**
 * 환경 변수에서 암호화 키 가져오기
 */
function getEncryptionKey(): string | null {
  return process.env.BACKUP_ENCRYPTION_KEY || null;
}

/**
 * 암호화 키 파생 (PBKDF2)
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, "sha256");
}

/**
 * 파일 암호화
 */
export async function encryptFile(inputPath: string, outputPath: string): Promise<void> {
  const encryptionKey = getEncryptionKey();
  if (!encryptionKey) {
    throw new Error("암호화 키가 설정되지 않았습니다. BACKUP_ENCRYPTION_KEY 환경 변수를 설정하세요.");
  }

  // 파일 읽기
  const plaintext = await fs.readFile(inputPath);

  // Salt 및 IV 생성
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  // 키 파생
  const key = deriveKey(encryptionKey, salt);

  // 암호화
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // 형식: salt (32) + iv (16) + authTag (16) + encrypted data
  const output = Buffer.concat([salt, iv, authTag, encrypted]);
  await fs.writeFile(outputPath, output);
}

/**
 * 파일 복호화
 */
export async function decryptFile(inputPath: string, outputPath: string): Promise<void> {
  const encryptionKey = getEncryptionKey();
  if (!encryptionKey) {
    throw new Error("암호화 키가 설정되지 않았습니다. BACKUP_ENCRYPTION_KEY 환경 변수를 설정하세요.");
  }

  // 파일 읽기
  const data = await fs.readFile(inputPath);

  // 데이터 파싱
  if (data.length < SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("암호화된 파일 형식이 올바르지 않습니다.");
  }

  const salt = data.subarray(0, SALT_LENGTH);
  const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  // 키 파생
  const key = deriveKey(encryptionKey, salt);

  // 복호화
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    await fs.writeFile(outputPath, decrypted);
  } catch (error) {
    throw new Error("복호화 실패: 암호화 키가 올바르지 않거나 파일이 손상되었습니다.");
  }
}

/**
 * 버퍼 암호화
 */
export function encryptBuffer(plaintext: Buffer, encryptionKey?: string): Buffer {
  const key = encryptionKey || getEncryptionKey();
  if (!key) {
    throw new Error("암호화 키가 설정되지 않았습니다.");
  }

  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const derivedKey = deriveKey(key, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, authTag, encrypted]);
}

/**
 * 버퍼 복호화
 */
export function decryptBuffer(data: Buffer, encryptionKey?: string): Buffer {
  const key = encryptionKey || getEncryptionKey();
  if (!key) {
    throw new Error("암호화 키가 설정되지 않았습니다.");
  }

  if (data.length < SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("암호화된 데이터 형식이 올바르지 않습니다.");
  }

  const salt = data.subarray(0, SALT_LENGTH);
  const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  const derivedKey = deriveKey(key, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/**
 * 암호화 가능 여부 확인
 */
export function isEncryptionEnabled(): boolean {
  return !!getEncryptionKey();
}

/**
 * 암호화된 파일인지 확인 (간단한 휴리스틱)
 */
export async function isEncryptedFile(filePath: string): Promise<boolean> {
  try {
    const data = await fs.readFile(filePath);

    // SQLite 매직 넘버 확인 (암호화되지 않은 SQLite 파일)
    if (data.length >= 16) {
      const header = data.subarray(0, 16).toString("utf-8");
      if (header.startsWith("SQLite format 3")) {
        return false; // 암호화되지 않은 SQLite 파일
      }
    }

    // 암호화된 파일의 최소 크기 확인
    if (data.length >= SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH) {
      return true; // 암호화된 것으로 추정
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * 암호화 키 검증 (테스트용)
 */
export function validateEncryptionKey(key: string): boolean {
  if (!key || key.length < 8) {
    return false;
  }
  return true;
}

/**
 * 새 암호화 키 생성
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("base64");
}

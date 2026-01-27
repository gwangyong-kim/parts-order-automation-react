/**
 * 선택적 의존성 모듈 타입 선언
 *
 * 이 모듈들은 선택적으로 설치되며, 설치되지 않은 경우에도
 * 애플리케이션이 정상 동작하도록 동적 import를 사용합니다.
 *
 * 설치 방법:
 * - 클라우드 백업 (S3): npm install @aws-sdk/client-s3
 * - 클라우드 백업 (GCS): npm install @google-cloud/storage
 * - 이메일 알림: npm install nodemailer
 */

// AWS S3 Client (선택적)
declare module "@aws-sdk/client-s3" {
  export class S3Client {
    constructor(config: {
      region?: string;
      credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
      };
    });
    send(command: unknown): Promise<unknown>;
  }

  export class PutObjectCommand {
    constructor(input: {
      Bucket: string;
      Key: string;
      Body: Buffer;
      ContentType?: string;
      Metadata?: Record<string, string>;
    });
  }

  export class GetObjectCommand {
    constructor(input: {
      Bucket: string;
      Key: string;
    });
  }

  export class ListObjectsV2Command {
    constructor(input: {
      Bucket: string;
      Prefix?: string;
    });
  }
}

// Google Cloud Storage (선택적)
declare module "@google-cloud/storage" {
  export class Storage {
    constructor(options?: {
      projectId?: string;
      keyFilename?: string;
    });
    bucket(name: string): Bucket;
  }

  interface Bucket {
    upload(
      localPath: string,
      options?: {
        destination?: string;
        metadata?: {
          metadata?: Record<string, string>;
        };
      }
    ): Promise<void>;
    file(name: string): File;
    getFiles(options?: { prefix?: string }): Promise<[File[]]>;
  }

  interface File {
    name: string;
    download(options: { destination: string }): Promise<void>;
  }
}

// Nodemailer (선택적)
declare module "nodemailer" {
  interface TransportOptions {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: {
      user?: string;
      pass?: string;
    };
  }

  interface MailOptions {
    from?: string;
    to?: string;
    subject?: string;
    text?: string;
    html?: string;
  }

  interface Transporter {
    sendMail(options: MailOptions): Promise<unknown>;
  }

  export function createTransport(options: TransportOptions): Transporter;
}

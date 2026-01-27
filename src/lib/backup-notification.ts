/**
 * Backup Notification Service
 *
 * Slack 및 Email 알림 서비스
 */

export interface NotificationPayload {
  type: "success" | "failure" | "warning";
  title: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface NotificationResult {
  success: boolean;
  channel?: string;
  error?: string;
}

/**
 * Slack Webhook URL 가져오기
 */
function getSlackWebhookUrl(): string | null {
  return process.env.SLACK_WEBHOOK_URL || null;
}

/**
 * Email 설정 가져오기
 */
function getEmailConfig(): {
  host?: string;
  user?: string;
  pass?: string;
  alertEmail?: string;
} | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const alertEmail = process.env.ALERT_EMAIL;

  if (!host || !alertEmail) {
    return null;
  }

  return { host, user, pass, alertEmail };
}

/**
 * Slack 알림 전송
 */
export async function sendSlackNotification(
  payload: NotificationPayload
): Promise<NotificationResult> {
  const webhookUrl = getSlackWebhookUrl();
  if (!webhookUrl) {
    return { success: false, error: "Slack Webhook URL이 설정되지 않았습니다." };
  }

  // 색상 설정
  const color = payload.type === "success" ? "#36a64f" :
                payload.type === "failure" ? "#ff0000" : "#ffcc00";

  // 아이콘 설정
  const icon = payload.type === "success" ? ":white_check_mark:" :
               payload.type === "failure" ? ":x:" : ":warning:";

  // 필드 생성
  const fields = payload.details
    ? Object.entries(payload.details).map(([key, value]) => ({
        title: key,
        value: String(value),
        short: true,
      }))
    : [];

  const slackPayload = {
    attachments: [
      {
        color,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `${icon} ${payload.title}`,
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: payload.message,
            },
          },
          ...(fields.length > 0
            ? [
                {
                  type: "section",
                  fields: fields.map((f) => ({
                    type: "mrkdwn",
                    text: `*${f.title}:*\n${f.value}`,
                  })),
                },
              ]
            : []),
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `PartSync MRP | ${new Date().toLocaleString("ko-KR")}`,
              },
            ],
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackPayload),
    });

    if (!response.ok) {
      throw new Error(`Slack API 응답 오류: ${response.status}`);
    }

    return { success: true, channel: "slack" };
  } catch (error) {
    console.error("Slack 알림 전송 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Slack 알림 전송 실패",
    };
  }
}

/**
 * Email 알림 전송
 */
export async function sendEmailNotification(
  payload: NotificationPayload
): Promise<NotificationResult> {
  const emailConfig = getEmailConfig();
  if (!emailConfig) {
    return { success: false, error: "Email 설정이 완료되지 않았습니다." };
  }

  try {
    // nodemailer 동적 임포트 (설치되지 않았을 수 있음)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let nodemailer: any;
    try {
      nodemailer = await import("nodemailer");
    } catch {
      return { success: false, error: "nodemailer 패키지가 설치되지 않았습니다. npm install nodemailer를 실행하세요." };
    }

    const transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: 587,
      secure: false,
      auth: emailConfig.user && emailConfig.pass
        ? {
            user: emailConfig.user,
            pass: emailConfig.pass,
          }
        : undefined,
    });

    // 아이콘 설정
    const icon = payload.type === "success" ? "✅" :
                 payload.type === "failure" ? "❌" : "⚠️";

    // 상세 정보 HTML 생성
    let detailsHtml = "";
    if (payload.details) {
      detailsHtml = `
        <table style="border-collapse: collapse; margin-top: 10px;">
          ${Object.entries(payload.details)
            .map(
              ([key, value]) => `
            <tr>
              <td style="padding: 5px 10px; border: 1px solid #ddd; font-weight: bold;">${key}</td>
              <td style="padding: 5px 10px; border: 1px solid #ddd;">${String(value)}</td>
            </tr>
          `
            )
            .join("")}
        </table>
      `;
    }

    const mailOptions = {
      from: emailConfig.user || "partsync@localhost",
      to: emailConfig.alertEmail,
      subject: `${icon} [PartSync] ${payload.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: ${
            payload.type === "success" ? "#d4edda" :
            payload.type === "failure" ? "#f8d7da" : "#fff3cd"
          }; padding: 20px; border-radius: 5px;">
            <h2 style="margin: 0 0 10px 0;">${icon} ${payload.title}</h2>
            <p style="margin: 0;">${payload.message}</p>
          </div>
          ${detailsHtml}
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            PartSync MRP | ${new Date().toLocaleString("ko-KR")}
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return { success: true, channel: "email" };
  } catch (error) {
    console.error("Email 알림 전송 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Email 알림 전송 실패",
    };
  }
}

/**
 * 모든 채널로 알림 전송
 */
export async function sendNotification(
  payload: NotificationPayload,
  options: { slack?: boolean; email?: boolean } = { slack: true, email: true }
): Promise<{ slack?: NotificationResult; email?: NotificationResult }> {
  const results: { slack?: NotificationResult; email?: NotificationResult } = {};

  if (options.slack) {
    results.slack = await sendSlackNotification(payload);
  }

  if (options.email) {
    results.email = await sendEmailNotification(payload);
  }

  return results;
}

/**
 * 백업 성공 알림
 */
export async function notifyBackupSuccess(
  fileName: string,
  fileSize: string,
  duration: number
): Promise<void> {
  await sendNotification({
    type: "success",
    title: "백업 완료",
    message: "데이터베이스 백업이 성공적으로 완료되었습니다.",
    details: {
      "파일명": fileName,
      "파일 크기": fileSize,
      "소요 시간": `${duration}ms`,
    },
  });
}

/**
 * 백업 실패 알림
 */
export async function notifyBackupFailure(
  error: string,
  backupType: string = "MANUAL"
): Promise<void> {
  await sendNotification({
    type: "failure",
    title: "백업 실패",
    message: "데이터베이스 백업 중 오류가 발생했습니다.",
    details: {
      "백업 유형": backupType,
      "오류 내용": error,
    },
  });
}

/**
 * 디스크 용량 경고 알림
 */
export async function notifyDiskSpaceWarning(
  usedGb: number,
  thresholdGb: number
): Promise<void> {
  await sendNotification({
    type: "warning",
    title: "디스크 용량 경고",
    message: "백업 디렉토리의 디스크 용량이 임계값에 도달했습니다.",
    details: {
      "현재 사용량": `${usedGb.toFixed(2)} GB`,
      "임계값": `${thresholdGb} GB`,
    },
  });
}

/**
 * 알림 설정 확인
 */
export function getNotificationStatus(): {
  slack: boolean;
  email: boolean;
} {
  return {
    slack: !!getSlackWebhookUrl(),
    email: !!getEmailConfig(),
  };
}

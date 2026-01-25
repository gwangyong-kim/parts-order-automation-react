import prisma from "@/lib/prisma";

export type UploadType = "PARTS" | "PRODUCTS" | "SALES_ORDERS" | "ORDERS" | "TRANSACTIONS";

export interface BulkUploadResult {
  success: number;
  failed: number;
  errors: string[];
  message?: string;
}

export async function saveBulkUploadLog(
  uploadType: UploadType,
  result: BulkUploadResult,
  options?: {
    fileName?: string;
    performedBy?: string;
  }
): Promise<void> {
  try {
    const totalRows = result.success + result.failed;
    let status: "COMPLETED" | "PARTIAL" | "FAILED" = "COMPLETED";

    if (result.failed > 0 && result.success === 0) {
      status = "FAILED";
    } else if (result.failed > 0) {
      status = "PARTIAL";
    }

    await prisma.bulkUploadLog.create({
      data: {
        uploadType,
        fileName: options?.fileName || null,
        totalRows,
        successCount: result.success,
        failedCount: result.failed,
        status,
        errors: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
        performedBy: options?.performedBy || null,
      },
    });
  } catch (error) {
    // 로그 저장 실패는 메인 작업에 영향을 주지 않도록 에러만 콘솔에 출력
    console.error("Failed to save bulk upload log:", error);
  }
}

export const UPLOAD_TYPE_LABELS: Record<UploadType, string> = {
  PARTS: "파츠",
  PRODUCTS: "제품/BOM",
  SALES_ORDERS: "수주",
  ORDERS: "발주",
  TRANSACTIONS: "재고이동",
};

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";

// 트랜잭션 코드 자동 생성
async function generateTxCode(type: string): Promise<string> {
  const prefix = type === "INBOUND" ? "IN" : type === "OUTBOUND" ? "OUT" : "ADJ";
  const today = new Date();
  const datePrefix = `${prefix}${today.getFullYear().toString().slice(-2)}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;

  const lastTx = await prisma.transaction.findFirst({
    where: { transactionCode: { startsWith: datePrefix } },
    orderBy: { transactionCode: "desc" },
  });

  if (lastTx) {
    const lastNumber = parseInt(lastTx.transactionCode.slice(-4)) || 0;
    return `${datePrefix}-${String(lastNumber + 1).padStart(4, "0")}`;
  }

  return `${datePrefix}-0001`;
}

export async function POST(request: Request) {
  try {
    const { data } = await request.json();

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: "업로드할 데이터가 없습니다." },
        { status: 400 }
      );
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    // 부품 캐시
    const parts = await prisma.part.findMany();
    const partCodeMap = new Map(
      parts
        .filter(p => p.partCode)
        .map(p => [p.partCode.toLowerCase(), p])
    );
    const partNameMap = new Map(
      parts
        .filter(p => p.partName)
        .map(p => [p.partName.toLowerCase(), p])
    );

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2;

      try {
        // 필드 매핑
        const partCode = row["부품코드"] || row["partCode"] || row["부품번호"];
        const partName = row["부품명"] || row["partName"];
        const typeStr = row["유형"] || row["transactionType"] || row["type"] || row["구분"];
        const quantity = parseInt(row["수량"] || row["quantity"] || "0");
        const referenceType = row["참조유형"] || row["referenceType"] || "";
        const referenceId = row["참조번호"] || row["referenceId"] || "";
        const notes = row["비고"] || row["notes"] || "";
        const performedBy = row["담당자"] || row["performedBy"] || "";

        // 부품 조회
        let part = null;
        if (partCode) {
          part = partCodeMap.get(partCode.toLowerCase());
        }
        if (!part && partName) {
          part = partNameMap.get(partName.toLowerCase());
        }

        if (!part) {
          results.failed++;
          results.errors.push(`행 ${rowNum}: 부품을 찾을 수 없습니다. (${partCode || partName})`);
          continue;
        }

        // 유형 매핑
        let transactionType: "INBOUND" | "OUTBOUND" | "ADJUSTMENT" = "ADJUSTMENT";
        const typeUpper = typeStr?.toUpperCase() || "";
        if (typeUpper.includes("입고") || typeUpper === "INBOUND" || typeUpper === "IN") {
          transactionType = "INBOUND";
        } else if (typeUpper.includes("출고") || typeUpper === "OUTBOUND" || typeUpper === "OUT") {
          transactionType = "OUTBOUND";
        } else if (typeUpper.includes("조정") || typeUpper === "ADJUSTMENT" || typeUpper === "ADJ") {
          transactionType = "ADJUSTMENT";
        }

        if (quantity <= 0) {
          results.failed++;
          results.errors.push(`행 ${rowNum}: 수량은 0보다 커야 합니다.`);
          continue;
        }

        // 현재 재고 조회
        const inventory = await prisma.inventory.findUnique({
          where: { partId: part.id },
        });

        if (!inventory) {
          results.failed++;
          results.errors.push(`행 ${rowNum}: 재고 정보를 찾을 수 없습니다.`);
          continue;
        }

        const beforeQty = inventory.currentQty;
        let afterQty = beforeQty;

        if (transactionType === "INBOUND") {
          afterQty = beforeQty + quantity;
        } else if (transactionType === "OUTBOUND") {
          afterQty = beforeQty - quantity;
          if (afterQty < 0) {
            results.failed++;
            results.errors.push(`행 ${rowNum}: 재고 부족 (현재: ${beforeQty}, 출고: ${quantity})`);
            continue;
          }
        } else if (transactionType === "ADJUSTMENT") {
          afterQty = quantity; // 조정은 직접 수량 설정
        }

        // 트랜잭션 코드 생성
        const transactionCode = await generateTxCode(transactionType);

        // 트랜잭션 생성
        await prisma.transaction.create({
          data: {
            transactionCode,
            transactionType,
            partId: part.id,
            quantity,
            beforeQty,
            afterQty,
            referenceType: referenceType || null,
            referenceId: referenceId || null,
            notes: notes || null,
            performedBy: performedBy || null,
          },
        });

        // 재고 업데이트
        await prisma.inventory.update({
          where: { partId: part.id },
          data: { currentQty: afterQty },
        });

        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`행 ${rowNum}: ${(err as Error).message}`);
      }
    }

    return NextResponse.json({
      message: `업로드 완료: 성공 ${results.success}건, 실패 ${results.failed}건`,
      ...results,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

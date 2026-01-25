import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { saveBulkUploadLog } from "@/lib/bulk-upload-logger";

interface ProductRow {
  [key: string]: unknown;
}

interface BomRow {
  [key: string]: unknown;
}

interface UploadData {
  data?: ProductRow[];           // 단일 시트 (기존 호환)
  products?: ProductRow[];       // 제품 시트
  bom?: BomRow[];                // BOM 시트
}

export async function POST(request: Request) {
  try {
    const body: UploadData = await request.json();

    // 기존 단일 시트 방식 또는 새로운 다중 시트 방식 지원
    const productData = body.products || body.data;
    const bomData = body.bom || [];

    if (!Array.isArray(productData) || productData.length === 0) {
      return NextResponse.json(
        { error: "업로드할 제품 데이터가 없습니다." },
        { status: 400 }
      );
    }

    const results = {
      success: 0,
      failed: 0,
      bomAdded: 0,
      bomFailed: 0,
      errors: [] as string[],
    };

    // 모든 파츠를 미리 조회하여 캐시
    const allParts = await prisma.part.findMany({
      select: { id: true, partCode: true },
    });
    const partCodeToId = new Map(allParts.map(p => [p.partCode.toLowerCase(), p.id]));

    // 제품코드 -> 제품ID 매핑 (BOM 처리용)
    const productCodeToId = new Map<string, number>();

    // 1단계: 제품 데이터 처리
    for (let i = 0; i < productData.length; i++) {
      const row = productData[i];
      const rowNum = i + 2;

      try {
        const productCode = row["제품코드"] || row["productCode"] || row["코드"];
        const productName = row["제품명"] || row["productName"] || row["품명"] || row["이름"];
        const description = row["설명"] || row["description"] || row["비고"];
        const category = row["카테고리"] || row["category"] || row["분류"];
        const unit = row["단위"] || row["unit"] || "SET";

        if (!productCode) {
          results.failed++;
          results.errors.push(`[제품] 행 ${rowNum}: 제품코드는 필수입니다.`);
          continue;
        }

        const existingProduct = await prisma.product.findUnique({
          where: { productCode: String(productCode) },
        });

        let productId: number;

        if (existingProduct) {
          const updated = await prisma.product.update({
            where: { id: existingProduct.id },
            data: {
              productName: productName ? String(productName) : String(productCode),
              description: description ? String(description) : null,
              category: category ? String(category) : null,
              unit: unit ? String(unit) : "SET",
            },
          });
          productId = updated.id;
        } else {
          const created = await prisma.product.create({
            data: {
              productCode: String(productCode),
              productName: productName ? String(productName) : String(productCode),
              description: description ? String(description) : null,
              category: category ? String(category) : null,
              unit: unit ? String(unit) : "SET",
            },
          });
          productId = created.id;
        }

        productCodeToId.set(String(productCode).toLowerCase(), productId);
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`[제품] 행 ${rowNum}: ${(err as Error).message}`);
      }
    }

    // 2단계: BOM 데이터 처리 (BOM 시트가 있는 경우)
    if (bomData.length > 0) {
      // 기존 제품도 조회하여 매핑에 추가
      const existingProducts = await prisma.product.findMany({
        select: { id: true, productCode: true },
      });
      for (const p of existingProducts) {
        if (!productCodeToId.has(p.productCode.toLowerCase())) {
          productCodeToId.set(p.productCode.toLowerCase(), p.id);
        }
      }

      // 제품별 BOM 항목 그룹화
      const bomByProduct = new Map<number, { partId: number; quantityPerUnit: number; lossRate: number; notes: string | null }[]>();

      for (let i = 0; i < bomData.length; i++) {
        const row = bomData[i];
        const rowNum = i + 2;

        try {
          const productCode = row["제품코드"] || row["productCode"];
          const partCode = row["파츠코드"] || row["partCode"] || row["부품코드"];
          const quantity = row["수량"] || row["quantity"] || row["소요량"] || 1;
          const lossRate = row["로스율"] || row["lossRate"] || row["손실율"] || 0;
          const notes = row["비고"] || row["notes"] || "";

          if (!productCode) {
            results.bomFailed++;
            results.errors.push(`[BOM] 행 ${rowNum}: 제품코드는 필수입니다.`);
            continue;
          }

          if (!partCode) {
            results.bomFailed++;
            results.errors.push(`[BOM] 행 ${rowNum}: 파츠코드는 필수입니다.`);
            continue;
          }

          const productId = productCodeToId.get(String(productCode).toLowerCase());
          if (!productId) {
            results.bomFailed++;
            results.errors.push(`[BOM] 행 ${rowNum}: 제품코드 "${productCode}"를 찾을 수 없습니다.`);
            continue;
          }

          const partId = partCodeToId.get(String(partCode).toLowerCase());
          if (!partId) {
            results.bomFailed++;
            results.errors.push(`[BOM] 행 ${rowNum}: 파츠코드 "${partCode}"를 찾을 수 없습니다.`);
            continue;
          }

          const quantityNum = parseFloat(String(quantity)) || 1;
          let lossRateNum = parseFloat(String(lossRate)) || 1;
          // 배수를 소수 손실율로 변환 (1.05 -> 0.05, 1.1 -> 0.1)
          // 1 미만이면 이미 소수 형태이거나 0이므로 그대로 사용
          if (lossRateNum >= 1) {
            lossRateNum = lossRateNum - 1;
          }
          lossRateNum = Math.min(Math.max(lossRateNum, 0), 1);

          if (!bomByProduct.has(productId)) {
            bomByProduct.set(productId, []);
          }
          bomByProduct.get(productId)!.push({
            partId,
            quantityPerUnit: quantityNum,
            lossRate: lossRateNum,
            notes: notes ? String(notes) : null,
          });
        } catch (err) {
          results.bomFailed++;
          results.errors.push(`[BOM] 행 ${rowNum}: ${(err as Error).message}`);
        }
      }

      // BOM 항목 일괄 처리 (트랜잭션)
      for (const [productId, items] of bomByProduct) {
        try {
          await prisma.$transaction(async (tx) => {
            // 기존 BOM 삭제
            await tx.bomItem.deleteMany({
              where: { productId },
            });

            // 새 BOM 추가
            await tx.bomItem.createMany({
              data: items.map(item => ({
                productId,
                partId: item.partId,
                quantityPerUnit: item.quantityPerUnit,
                lossRate: item.lossRate,
                notes: item.notes,
              })),
            });
          });

          results.bomAdded += items.length;
        } catch (err) {
          results.bomFailed += items.length;
          results.errors.push(`[BOM] 제품 ID ${productId}: ${(err as Error).message}`);
        }
      }
    }

    const bomMessage = bomData.length > 0
      ? `, BOM 성공 ${results.bomAdded}건, BOM 실패 ${results.bomFailed}건`
      : "";

    // 업로드 로그 저장
    await saveBulkUploadLog("PRODUCTS", {
      success: results.success + results.bomAdded,
      failed: results.failed + results.bomFailed,
      errors: results.errors,
    });

    return NextResponse.json({
      message: `업로드 완료: 제품 성공 ${results.success}건, 제품 실패 ${results.failed}건${bomMessage}`,
      ...results,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";

// 부품 코드 자동 생성
async function generatePartCode(): Promise<string> {
  const today = new Date();
  const prefix = `P${today.getFullYear().toString().slice(-2)}${String(today.getMonth() + 1).padStart(2, "0")}`;

  const lastPart = await prisma.part.findFirst({
    where: { partCode: { startsWith: prefix } },
    orderBy: { partCode: "desc" },
  });

  if (lastPart) {
    const lastNumber = parseInt(lastPart.partCode.slice(-4)) || 0;
    return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
  }

  return `${prefix}0001`;
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

    // 카테고리와 공급업체 캐시
    const categories = await prisma.category.findMany();
    const suppliers = await prisma.supplier.findMany();

    const categoryMap = new Map(
      categories
        .filter(c => c.name)
        .map(c => [c.name.toLowerCase(), c.id])
    );
    const supplierMap = new Map(
      suppliers
        .filter(s => s.name)
        .map(s => [s.name.toLowerCase(), s.id])
    );

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // Excel row (1-based + header)

      try {
        // 필드 매핑 (다양한 한글/영문 필드명 지원)
        const partCode = row["부품코드"] || row["partCode"] || row["부품번호"] || row["partNumber"];
        const partName = row["부품명"] || row["partName"] || row["품명"];
        const description = row["규격"] || row["description"] || row["사양"] || row["specification"];
        const unit = row["단위"] || row["unit"] || "EA";
        const unitPrice = parseFloat(row["단가"] || row["unitPrice"] || row["가격"] || "0");
        const safetyStock = parseInt(row["안전재고"] || row["safetyStock"] || "0");
        const minOrderQty = parseInt(row["최소발주량"] || row["minOrderQty"] || row["MOQ"] || "1");
        const leadTimeDays = parseInt(row["리드타임"] || row["leadTimeDays"] || row["leadTime"] || "7");
        const categoryName = row["카테고리"] || row["category"] || row["분류"];
        const supplierName = row["공급업체"] || row["supplier"] || row["업체"];

        // 필수 필드 검증
        if (!partName) {
          results.failed++;
          results.errors.push(`행 ${rowNum}: 부품명은 필수입니다.`);
          continue;
        }

        // 카테고리/공급업체 ID 조회
        const categoryId = categoryName ? categoryMap.get(categoryName.toLowerCase()) || null : null;
        const supplierId = supplierName ? supplierMap.get(supplierName.toLowerCase()) || null : null;

        // 부품 코드 자동 생성 (비어있으면)
        const finalPartCode = partCode || await generatePartCode();

        // 중복 체크 및 업데이트/생성
        const existingPart = await prisma.part.findUnique({
          where: { partCode: finalPartCode },
        });

        if (existingPart) {
          // 기존 데이터 업데이트
          await prisma.part.update({
            where: { id: existingPart.id },
            data: {
              partName,
              description: description || null,
              unit,
              unitPrice: isNaN(unitPrice) ? 0 : unitPrice,
              safetyStock: isNaN(safetyStock) ? 0 : safetyStock,
              minOrderQty: isNaN(minOrderQty) ? 1 : minOrderQty,
              leadTimeDays: isNaN(leadTimeDays) ? 7 : leadTimeDays,
              categoryId,
              supplierId,
            },
          });
        } else {
          // 새로 생성
          const newPart = await prisma.part.create({
            data: {
              partCode: finalPartCode,
              partName,
              description: description || null,
              unit,
              unitPrice: isNaN(unitPrice) ? 0 : unitPrice,
              safetyStock: isNaN(safetyStock) ? 0 : safetyStock,
              minOrderQty: isNaN(minOrderQty) ? 1 : minOrderQty,
              leadTimeDays: isNaN(leadTimeDays) ? 7 : leadTimeDays,
              categoryId,
              supplierId,
            },
          });

          // 초기 재고 레코드 생성
          await prisma.inventory.create({
            data: {
              partId: newPart.id,
              currentQty: 0,
              reservedQty: 0,
              incomingQty: 0,
            },
          });
        }

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

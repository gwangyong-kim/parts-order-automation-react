import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";

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

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // Excel row (1-based + header)

      try {
        // 필드 매핑 (다양한 한글/영문 필드명 지원)
        const productCode = row["제품코드"] || row["productCode"] || row["코드"];
        const productName = row["제품명"] || row["productName"] || row["품명"] || row["이름"];
        const description = row["설명"] || row["description"] || row["비고"];
        const category = row["카테고리"] || row["category"] || row["분류"];
        const unit = row["단위"] || row["unit"] || "SET";

        // 필수 필드 검증
        if (!productCode) {
          results.failed++;
          results.errors.push(`행 ${rowNum}: 제품코드는 필수입니다.`);
          continue;
        }

        // 중복 체크 및 업데이트/생성
        const existingProduct = await prisma.product.findUnique({
          where: { productCode },
        });

        if (existingProduct) {
          // 기존 데이터 업데이트
          await prisma.product.update({
            where: { id: existingProduct.id },
            data: {
              productName: productName || null,
              description: description || null,
              category: category || null,
              unit: unit || "SET",
            },
          });
        } else {
          // 새로 생성
          await prisma.product.create({
            data: {
              productCode,
              productName: productName || null,
              description: description || null,
              category: category || null,
              unit: unit || "SET",
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

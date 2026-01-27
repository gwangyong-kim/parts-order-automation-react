import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { saveBulkUploadLog } from "@/lib/bulk-upload-logger";
import { calculateMrp } from "@/services/mrp.service";

// 수주 코드 자동 생성 (SO2501-0001 형식)
async function generateSOCode(): Promise<string> {
  const today = new Date();
  const prefix = `SO${today.getFullYear().toString().slice(-2)}${String(today.getMonth() + 1).padStart(2, "0")}`;

  const lastOrder = await prisma.salesOrder.findFirst({
    where: { orderCode: { startsWith: prefix } },
    orderBy: { orderCode: "desc" },
  });

  if (lastOrder) {
    const lastNumber = parseInt(lastOrder.orderCode.split("-")[1]) || 0;
    return `${prefix}-${String(lastNumber + 1).padStart(4, "0")}`;
  }

  return `${prefix}-0001`;
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
      generatedCodes: [] as string[],
    };

    // 제품 캐시
    const products = await prisma.product.findMany();
    const productMap = new Map(
      products
        .filter(p => p.productCode)
        .map(p => [p.productCode.toLowerCase(), p])
    );
    const productNameMap = new Map(
      products
        .filter(p => p.productName)
        .map(p => [p.productName.toLowerCase(), p])
    );

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2;

      try {
        // 필드 매핑
        const orderCode = row["수주번호"] || row["orderCode"] || row["주문번호"];
        const division = row["사업부"] || row["division"] || "";
        const manager = row["담당자"] || row["manager"] || "";
        const project = row["프로젝트"] || row["project"] || "";
        const orderDateStr = row["수주일"] || row["orderDate"] || row["주문일"];
        const dueDateStr = row["납기일"] || row["dueDate"] || row["납품일"];
        const productCode = row["제품코드"] || row["productCode"];
        const productName = row["제품명"] || row["productName"];
        const orderQty = parseInt(row["수량"] || row["orderQty"] || row["수주수량"] || "0");
        const notes = row["비고"] || row["notes"] || "";

        // 필수 필드 검증
        if (!orderDateStr) {
          results.failed++;
          results.errors.push(`행 ${rowNum}: 수주일은 필수입니다.`);
          continue;
        }

        // 제품 조회 (코드 또는 이름으로)
        let product = null;
        if (productCode) {
          product = productMap.get(productCode.toLowerCase());
        }
        if (!product && productName) {
          product = productNameMap.get(productName.toLowerCase());
        }

        // 날짜 파싱
        const orderDate = new Date(orderDateStr);
        const dueDate = dueDateStr ? new Date(dueDateStr) : null;

        if (isNaN(orderDate.getTime())) {
          results.failed++;
          results.errors.push(`행 ${rowNum}: 수주일 형식이 올바르지 않습니다.`);
          continue;
        }

        // 수주 코드 자동 생성
        const finalOrderCode = orderCode || await generateSOCode();

        // 기존 수주 확인
        const existingOrder = await prisma.salesOrder.findUnique({
          where: { orderCode: finalOrderCode },
        });

        if (existingOrder) {
          // 기존 수주에 아이템 추가 또는 업데이트
          if (product && orderQty > 0) {
            const existingItem = await prisma.salesOrderItem.findFirst({
              where: {
                salesOrderId: existingOrder.id,
                productId: product.id,
              },
            });

            if (existingItem) {
              await prisma.salesOrderItem.update({
                where: { id: existingItem.id },
                data: { orderQty },
              });
            } else {
              await prisma.salesOrderItem.create({
                data: {
                  salesOrderId: existingOrder.id,
                  productId: product.id,
                  orderQty,
                },
              });
            }

            // 총 수량 업데이트
            const items = await prisma.salesOrderItem.findMany({
              where: { salesOrderId: existingOrder.id },
            });
            const totalQty = items.reduce((sum, item) => sum + item.orderQty, 0);

            await prisma.salesOrder.update({
              where: { id: existingOrder.id },
              data: { totalQty },
            });
          }
        } else {
          // 새 수주 생성
          const newOrder = await prisma.salesOrder.create({
            data: {
              orderCode: finalOrderCode,
              orderDate,
              division: division || null,
              manager: manager || null,
              project: project || null,
              dueDate,
              status: "RECEIVED",
              totalQty: orderQty,
              notes: notes || null,
            },
          });

          results.generatedCodes.push(finalOrderCode);

          // 아이템 추가
          if (product && orderQty > 0) {
            await prisma.salesOrderItem.create({
              data: {
                salesOrderId: newOrder.id,
                productId: product.id,
                orderQty,
              },
            });
          }
        }

        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`행 ${rowNum}: ${(err as Error).message}`);
      }
    }

    // 업로드 로그 저장
    await saveBulkUploadLog("SALES_ORDERS", results);

    // MRP 자동 재계산 (비동기, 성공 건이 있을 때만)
    if (results.success > 0) {
      calculateMrp({ clearExisting: true }).catch((err) => {
        console.error("MRP 자동 계산 실패:", err);
      });
    }

    return NextResponse.json({
      message: `업로드 완료: 성공 ${results.success}건, 실패 ${results.failed}건`,
      ...results,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

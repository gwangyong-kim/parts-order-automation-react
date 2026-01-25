import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";

// 발주 코드 자동 생성 (PO2501-0001 형식)
async function generatePOCode(): Promise<string> {
  const today = new Date();
  const prefix = `PO${today.getFullYear().toString().slice(-2)}${String(today.getMonth() + 1).padStart(2, "0")}`;

  const lastOrder = await prisma.order.findFirst({
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

    // 공급업체, 파츠 캐시
    const suppliers = await prisma.supplier.findMany();
    const parts = await prisma.part.findMany();

    const supplierMap = new Map(
      suppliers
        .filter(s => s.name)
        .map(s => [s.name.toLowerCase(), s])
    );
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
        const orderCode = row["발주번호"] || row["orderCode"] || row["주문번호"];
        const supplierName = row["공급업체"] || row["supplier"] || row["업체명"];
        const project = row["프로젝트"] || row["project"] || "";
        const orderDateStr = row["발주일"] || row["orderDate"] || row["주문일"];
        const expectedDateStr = row["납기예정일"] || row["expectedDate"] || row["납품예정일"];
        const partCode = row["파츠코드"] || row["partCode"];
        const partName = row["파츠명"] || row["partName"];
        const orderQty = parseInt(row["수량"] || row["orderQty"] || row["발주수량"] || "0");
        const unitPrice = parseFloat(row["단가"] || row["unitPrice"] || "0");
        const notes = row["비고"] || row["notes"] || "";

        // 필수 필드 검증
        if (!supplierName) {
          results.failed++;
          results.errors.push(`행 ${rowNum}: 공급업체는 필수입니다.`);
          continue;
        }

        // 공급업체 조회
        const supplier = supplierMap.get(supplierName.toLowerCase());
        if (!supplier) {
          results.failed++;
          results.errors.push(`행 ${rowNum}: 공급업체를 찾을 수 없습니다. (${supplierName})`);
          continue;
        }

        // 파츠 조회
        let part = null;
        if (partCode) {
          part = partCodeMap.get(partCode.toLowerCase());
        }
        if (!part && partName) {
          part = partNameMap.get(partName.toLowerCase());
        }

        // 날짜 파싱
        const orderDate = orderDateStr ? new Date(orderDateStr) : new Date();
        const expectedDate = expectedDateStr ? new Date(expectedDateStr) : null;

        if (isNaN(orderDate.getTime())) {
          results.failed++;
          results.errors.push(`행 ${rowNum}: 발주일 형식이 올바르지 않습니다.`);
          continue;
        }

        // 발주 코드 자동 생성
        const finalOrderCode = orderCode || await generatePOCode();

        // 기존 발주 확인
        const existingOrder = await prisma.order.findUnique({
          where: { orderCode: finalOrderCode },
        });

        if (existingOrder) {
          // 기존 발주에 아이템 추가
          if (part && orderQty > 0) {
            const existingItem = await prisma.orderItem.findFirst({
              where: {
                orderId: existingOrder.id,
                partId: part.id,
              },
            });

            const itemUnitPrice = unitPrice > 0 ? unitPrice : part.unitPrice;

            if (existingItem) {
              await prisma.orderItem.update({
                where: { id: existingItem.id },
                data: {
                  orderQty,
                  unitPrice: itemUnitPrice,
                  totalPrice: orderQty * itemUnitPrice,
                },
              });
            } else {
              await prisma.orderItem.create({
                data: {
                  orderId: existingOrder.id,
                  partId: part.id,
                  orderQty,
                  unitPrice: itemUnitPrice,
                  totalPrice: orderQty * itemUnitPrice,
                },
              });
            }

            // 총 금액 업데이트
            const items = await prisma.orderItem.findMany({
              where: { orderId: existingOrder.id },
            });
            const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);

            await prisma.order.update({
              where: { id: existingOrder.id },
              data: { totalAmount },
            });
          }
        } else {
          // 새 발주 생성
          const newOrder = await prisma.order.create({
            data: {
              orderCode: finalOrderCode,
              supplierId: supplier.id,
              project: project || null,
              orderDate,
              expectedDate,
              status: "DRAFT",
              totalAmount: 0,
              notes: notes || null,
            },
          });

          results.generatedCodes.push(finalOrderCode);

          // 아이템 추가
          if (part && orderQty > 0) {
            const itemUnitPrice = unitPrice > 0 ? unitPrice : part.unitPrice;

            await prisma.orderItem.create({
              data: {
                orderId: newOrder.id,
                partId: part.id,
                orderQty,
                unitPrice: itemUnitPrice,
                totalPrice: orderQty * itemUnitPrice,
              },
            });

            // 총 금액 업데이트
            await prisma.order.update({
              where: { id: newOrder.id },
              data: { totalAmount: orderQty * itemUnitPrice },
            });
          }
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

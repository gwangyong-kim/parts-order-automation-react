import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError, badRequest, notFound } from "@/lib/api-error";

interface Params {
  params: Promise<{ id: string }>;
}

interface ReceiveItem {
  orderItemId: number;
  receivedQty: number;
}

interface ReceiveRequest {
  items: ReceiveItem[];
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);
    const body: ReceiveRequest = await request.json();

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      throw badRequest("입고할 품목 정보가 필요합니다.");
    }

    // 발주 조회
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            part: true,
          },
        },
      },
    });

    if (!order) {
      throw notFound("발주");
    }

    // 트랜잭션으로 처리
    const result = await prisma.$transaction(async (tx) => {
      const updatedItems = [];

      for (const item of body.items) {
        const orderItem = order.items.find((oi) => oi.id === item.orderItemId);
        if (!orderItem) {
          throw badRequest(`발주 품목을 찾을 수 없습니다: ${item.orderItemId}`);
        }

        if (item.receivedQty < 0) {
          throw badRequest("입고 수량은 0 이상이어야 합니다.");
        }

        // 새 입고 수량 (기존 + 추가)
        const newReceivedQty = orderItem.receivedQty + item.receivedQty;

        // 총 입고량이 발주량을 초과하는지 체크
        if (newReceivedQty > orderItem.orderQty) {
          throw badRequest(
            `입고 수량이 발주 수량을 초과합니다. (${orderItem.part.partName}: 발주 ${orderItem.orderQty}, 기존 입고 ${orderItem.receivedQty}, 추가 입고 ${item.receivedQty})`
          );
        }

        // 품목 상태 결정
        let itemStatus: string;
        if (newReceivedQty === 0) {
          itemStatus = "PENDING";
        } else if (newReceivedQty < orderItem.orderQty) {
          itemStatus = "PARTIAL";
        } else {
          itemStatus = "COMPLETED";
        }

        // OrderItem 업데이트
        const updatedItem = await tx.orderItem.update({
          where: { id: item.orderItemId },
          data: {
            receivedQty: newReceivedQty,
            status: itemStatus,
          },
          include: {
            part: true,
          },
        });

        // 재고(Inventory) 업데이트
        if (item.receivedQty > 0) {
          const inventory = await tx.inventory.findUnique({
            where: { partId: orderItem.partId },
          });

          if (inventory) {
            await tx.inventory.update({
              where: { partId: orderItem.partId },
              data: {
                currentQty: {
                  increment: item.receivedQty,
                },
                lastInboundDate: new Date(),
              },
            });
          } else {
            // 재고 레코드가 없으면 생성
            await tx.inventory.create({
              data: {
                partId: orderItem.partId,
                currentQty: item.receivedQty,
                lastInboundDate: new Date(),
              },
            });
          }

          // 트랜잭션 이력 생성
          const transactionCode = `TRX-${Date.now()}-${orderItem.partId}`;
          const beforeQty = inventory?.currentQty || 0;

          await tx.transaction.create({
            data: {
              transactionCode,
              partId: orderItem.partId,
              transactionType: "INBOUND",
              quantity: item.receivedQty,
              beforeQty,
              afterQty: beforeQty + item.receivedQty,
              referenceType: "ORDER",
              referenceId: order.orderCode,
              unitPrice: orderItem.unitPrice,
              totalAmount: orderItem.unitPrice
                ? orderItem.unitPrice * item.receivedQty
                : null,
              reason: "발주 입고",
              notes: `발주번호: ${order.orderCode}`,
            },
          });
        }

        updatedItems.push(updatedItem);
      }

      // 모든 품목이 완료되었는지 확인
      const allOrderItems = await tx.orderItem.findMany({
        where: { orderId },
      });

      const allCompleted = allOrderItems.every(
        (item) => item.status === "COMPLETED"
      );
      const hasPartial = allOrderItems.some(
        (item) => item.status === "PARTIAL" || item.status === "COMPLETED"
      );

      // 발주 상태 업데이트
      let orderStatus = order.status;
      if (allCompleted) {
        orderStatus = "RECEIVED";
      } else if (hasPartial && order.status === "ORDERED") {
        // 부분 입고 상태는 유지 (ORDERED)
        orderStatus = "ORDERED";
      }

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: orderStatus,
          actualDate: allCompleted ? new Date() : null,
        },
        include: {
          supplier: true,
          items: {
            include: {
              part: true,
            },
          },
        },
      });

      return {
        order: updatedOrder,
        updatedItems,
        allCompleted,
      };
    });

    return NextResponse.json({
      success: true,
      message: result.allCompleted
        ? "입고가 완료되었습니다."
        : "입고 처리가 완료되었습니다.",
      data: result.order,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

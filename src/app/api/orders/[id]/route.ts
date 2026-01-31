import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createOrderStatusChangedNotification } from "@/services/notification.service";
import { handleApiError, notFound, deletedResponse } from "@/lib/api-error";
import { requireAuth, requireOperator, requireAdmin } from "@/lib/authorization";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    // 인증된 사용자만 조회 가능
    const authResult = await requireAuth();
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: {
        supplier: true,
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

    return NextResponse.json(order);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    // OPERATOR 이상만 수정 가능
    const authResult = await requireOperator();
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const { id } = await params;
    const body = await request.json();

    // 기존 주문 조회 (상태 변경 감지용)
    const existingOrder = await prisma.order.findUnique({
      where: { id: parseInt(id) },
    });

    const order = await prisma.order.update({
      where: { id: parseInt(id) },
      data: {
        orderCode: body.orderNumber,
        supplierId: body.supplierId,
        orderDate: new Date(body.orderDate),
        expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
        status: body.status,
        totalAmount: body.totalAmount,
        notes: body.notes,
        approvedBy: body.approvedBy,
        approvedAt: body.approvedAt ? new Date(body.approvedAt) : null,
      },
      include: {
        supplier: true,
        items: true,
      },
    });

    // 상태가 변경된 경우 알림 생성
    if (existingOrder && existingOrder.status !== body.status) {
      createOrderStatusChangedNotification(
        order.orderCode,
        body.status
      ).catch(console.error);
    }

    return NextResponse.json(order);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    // ADMIN, MANAGER만 삭제 가능
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const { id } = await params;
    const orderId = parseInt(id);

    // 삭제 전에 발주 정보 조회 (MrpResult 복원용)
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          select: { partId: true },
        },
      },
    });

    if (!order) {
      throw notFound("발주");
    }

    const partIds = order.items.map((item) => item.partId);

    // Delete associated items first, then the order
    await prisma.orderItem.deleteMany({
      where: { orderId },
    });

    await prisma.order.delete({
      where: { id: orderId },
    });

    // MrpResult 상태를 PENDING으로 복원
    // 해당 품목의 다른 ORDERED 발주가 없는 경우에만 복원
    for (const partId of partIds) {
      // 해당 품목에 대해 다른 활성 발주가 있는지 확인
      const otherActiveOrder = await prisma.orderItem.findFirst({
        where: {
          partId,
          order: {
            status: { in: ["DRAFT", "APPROVED", "ORDERED"] },
          },
        },
      });

      // 다른 활성 발주가 없으면 MrpResult를 PENDING으로 복원
      if (!otherActiveOrder) {
        await prisma.mrpResult.updateMany({
          where: {
            partId,
            status: "ORDERED",
          },
          data: { status: "PENDING" },
        });
      }
    }

    return deletedResponse("발주가 삭제되었습니다.");
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError, notFound } from "@/lib/api-error";
import { requireAuth } from "@/lib/authorization";
import type { TimelineEvent, TimelineEventType, PartTimelineResponse } from "@/types/timeline";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const { id } = await params;
    const partId = parseInt(id);

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const eventTypesParam = searchParams.get("eventTypes");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const eventTypes: TimelineEventType[] | null = eventTypesParam
      ? (eventTypesParam.split(",") as TimelineEventType[])
      : null;

    // Fetch part with inventory
    const part = await prisma.part.findUnique({
      where: { id: partId },
      include: { inventory: true },
    });

    if (!part) {
      throw notFound("부품");
    }

    // Build date filter
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const events: TimelineEvent[] = [];

    // 1. Fetch Transactions (INBOUND, OUTBOUND, ADJUSTMENT, TRANSFER)
    if (!eventTypes || eventTypes.some(t => ["INBOUND", "OUTBOUND", "ADJUSTMENT", "TRANSFER"].includes(t))) {
      const transactionTypes = eventTypes
        ? eventTypes.filter(t => ["INBOUND", "OUTBOUND", "ADJUSTMENT", "TRANSFER"].includes(t))
        : undefined;

      const transactions = await prisma.transaction.findMany({
        where: {
          partId,
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
          ...(transactionTypes && transactionTypes.length > 0 && {
            transactionType: { in: transactionTypes },
          }),
        },
        orderBy: { createdAt: "desc" },
      });

      for (const tx of transactions) {
        events.push({
          id: `tx-${tx.id}`,
          type: tx.transactionType as TimelineEventType,
          date: tx.createdAt.toISOString(),
          quantity: tx.quantity,
          beforeQty: tx.beforeQty,
          afterQty: tx.afterQty,
          reference: tx.referenceType && tx.referenceId
            ? {
                type: tx.referenceType,
                code: tx.referenceId,
                id: parseInt(tx.referenceId) || 0,
              }
            : undefined,
          performedBy: tx.performedBy || undefined,
          notes: tx.reason || tx.notes || undefined,
        });
      }
    }

    // 2. Fetch OrderItems (발주)
    if (!eventTypes || eventTypes.includes("ORDER")) {
      const orderItems = await prisma.orderItem.findMany({
        where: {
          partId,
          order: Object.keys(dateFilter).length > 0 ? { orderDate: dateFilter } : undefined,
        },
        include: {
          order: {
            include: { supplier: true },
          },
        },
        orderBy: { order: { orderDate: "desc" } },
      });

      for (const item of orderItems) {
        events.push({
          id: `order-${item.id}`,
          type: "ORDER",
          date: item.order.orderDate.toISOString(),
          quantity: item.orderQty,
          reference: {
            type: "ORDER",
            code: item.order.orderCode,
            id: item.order.id,
          },
          status: item.status,
          notes: item.order.supplier?.name
            ? `공급업체: ${item.order.supplier.name}`
            : undefined,
        });
      }
    }

    // 3. Fetch SalesOrderItems via BOM (수주)
    if (!eventTypes || eventTypes.includes("SALES_ORDER")) {
      // Get BOM items containing this part
      const bomItems = await prisma.bomItem.findMany({
        where: { partId, isActive: true },
        select: { productId: true, quantityPerUnit: true, lossRate: true },
      });

      if (bomItems.length > 0) {
        const productIds = bomItems.map(b => b.productId);

        const salesOrderItems = await prisma.salesOrderItem.findMany({
          where: {
            productId: { in: productIds },
            salesOrder: Object.keys(dateFilter).length > 0
              ? { orderDate: dateFilter }
              : undefined,
          },
          include: {
            salesOrder: true,
            product: true,
          },
          orderBy: { salesOrder: { orderDate: "desc" } },
        });

        for (const item of salesOrderItems) {
          const bomItem = bomItems.find(b => b.productId === item.productId);
          const requiredQty = bomItem
            ? Math.ceil(item.orderQty * bomItem.quantityPerUnit * bomItem.lossRate)
            : item.orderQty;

          events.push({
            id: `so-${item.id}`,
            type: "SALES_ORDER",
            date: item.salesOrder.orderDate.toISOString(),
            quantity: requiredQty,
            reference: {
              type: "SALES_ORDER",
              code: item.salesOrder.orderCode,
              id: item.salesOrder.id,
            },
            status: item.status,
            notes: item.product?.productName
              ? `제품: ${item.product.productName} (${item.orderQty}개)`
              : undefined,
          });
        }
      }
    }

    // 4. Fetch PickingItems (피킹)
    if (!eventTypes || eventTypes.includes("PICKING")) {
      const pickingItems = await prisma.pickingItem.findMany({
        where: {
          partId,
          pickingTask: Object.keys(dateFilter).length > 0
            ? { createdAt: dateFilter }
            : undefined,
        },
        include: {
          pickingTask: {
            include: { salesOrder: true },
          },
        },
        orderBy: { pickingTask: { createdAt: "desc" } },
      });

      for (const item of pickingItems) {
        events.push({
          id: `pick-${item.id}`,
          type: "PICKING",
          date: item.pickingTask.createdAt.toISOString(),
          quantity: item.requiredQty,
          requiredQty: item.requiredQty,
          pickedQty: item.pickedQty,
          reference: {
            type: "PICKING",
            code: item.pickingTask.taskCode,
            id: item.pickingTask.id,
          },
          status: item.status,
          notes: item.pickingTask.salesOrder
            ? `수주: ${item.pickingTask.salesOrder.orderCode}`
            : undefined,
        });
      }
    }

    // 5. Fetch AuditItems (실사)
    if (!eventTypes || eventTypes.includes("AUDIT")) {
      const auditItems = await prisma.auditItem.findMany({
        where: {
          partId,
          audit: Object.keys(dateFilter).length > 0
            ? { auditDate: dateFilter }
            : undefined,
        },
        include: {
          audit: true,
        },
        orderBy: { audit: { auditDate: "desc" } },
      });

      for (const item of auditItems) {
        const discrepancy = item.countedQty !== null
          ? item.countedQty - item.systemQty
          : null;

        events.push({
          id: `audit-${item.id}`,
          type: "AUDIT",
          date: item.audit.auditDate.toISOString(),
          quantity: discrepancy || 0,
          systemQty: item.systemQty,
          countedQty: item.countedQty || undefined,
          reference: {
            type: "AUDIT",
            code: item.audit.auditCode,
            id: item.audit.id,
          },
          status: item.audit.status,
          performedBy: item.audit.performedBy || undefined,
          notes: discrepancy !== null && discrepancy !== 0
            ? discrepancy > 0 ? "초과" : "부족"
            : "일치",
        });
      }
    }

    // Sort all events by date (newest first)
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Apply pagination
    const total = events.length;
    const paginatedEvents = events.slice(offset, offset + limit);

    const response: PartTimelineResponse = {
      part: {
        id: part.id,
        partNumber: part.partCode,
        partName: part.partName,
        currentStock: part.inventory?.currentQty || 0,
      },
      events: paginatedEvents,
      pagination: {
        total,
        limit,
        offset,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}

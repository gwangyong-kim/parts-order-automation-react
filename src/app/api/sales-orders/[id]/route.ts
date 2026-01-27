import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError, notFound, deletedResponse } from "@/lib/api-error";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            product: {
              include: {
                bomItems: {
                  include: {
                    part: {
                      include: {
                        inventory: true,
                        orderItems: {
                          where: {
                            order: {
                              status: { in: ["APPROVED", "ORDERED"] },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!salesOrder) {
      throw notFound("수주");
    }

    // Calculate material requirements for this sales order
    const materialRequirements: Record<number, {
      partId: number;
      partCode: string;
      partName: string;
      unit: string;
      totalRequirement: number;
      currentStock: number;
      reservedQty: number;
      incomingQty: number;
      availableStock: number;
      shortageQty: number;
      safetyStock: number;
    }> = {};

    for (const item of salesOrder.items) {
      const orderQty = item.orderQty;
      for (const bomItem of item.product.bomItems) {
        const part = bomItem.part;
        const requirement = orderQty * bomItem.quantityPerUnit * (1 + bomItem.lossRate);

        if (!materialRequirements[part.id]) {
          const currentStock = part.inventory?.currentQty ?? 0;
          const reservedQty = part.inventory?.reservedQty ?? 0;
          const incomingQty = part.orderItems.reduce(
            (sum, oi) => sum + (oi.orderQty - oi.receivedQty),
            0
          );
          const availableStock = currentStock + incomingQty - reservedQty;

          materialRequirements[part.id] = {
            partId: part.id,
            partCode: part.partCode,
            partName: part.partName,
            unit: part.unit,
            totalRequirement: 0,
            currentStock,
            reservedQty,
            incomingQty,
            availableStock,
            shortageQty: 0,
            safetyStock: part.safetyStock,
          };
        }

        materialRequirements[part.id].totalRequirement += requirement;
      }
    }

    // Calculate shortage for each part
    const materials = Object.values(materialRequirements).map((mat) => ({
      ...mat,
      totalRequirement: Math.round(mat.totalRequirement),
      shortageQty: Math.max(0, Math.round(mat.totalRequirement - mat.availableStock)),
    }));

    // Sort by shortage (highest first)
    materials.sort((a, b) => b.shortageQty - a.shortageQty);

    return NextResponse.json({
      ...salesOrder,
      materialRequirements: materials,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);
    const body = await request.json();

    // Calculate total quantity from items
    const items = body.items || [];
    const totalQty = items.reduce((sum: number, item: { orderQty?: number }) => sum + (item.orderQty || 0), 0);

    // Update sales order with transaction to handle items
    const salesOrder = await prisma.$transaction(async (tx) => {
      // Delete existing items
      await tx.salesOrderItem.deleteMany({
        where: { salesOrderId: orderId },
      });

      // Update order and create new items
      return tx.salesOrder.update({
        where: { id: orderId },
        data: {
          orderCode: body.orderNumber || body.orderCode,
          division: body.division,
          manager: body.manager,
          project: body.project,
          orderDate: body.orderDate ? new Date(body.orderDate) : undefined,
          dueDate: body.deliveryDate || body.dueDate ? new Date(body.deliveryDate || body.dueDate) : null,
          status: body.status,
          totalQty: totalQty || body.totalAmount || body.totalQty || 0,
          notes: body.notes,
          items: items.length > 0
            ? {
                create: items.map((item: { productId: number; orderQty: number; notes?: string }) => ({
                  productId: item.productId,
                  orderQty: item.orderQty,
                  notes: item.notes || null,
                })),
              }
            : undefined,
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });
    });

    return NextResponse.json(salesOrder);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;

    // Delete associated items first, then the order
    await prisma.salesOrderItem.deleteMany({
      where: { salesOrderId: parseInt(id) },
    });

    await prisma.salesOrder.delete({
      where: { id: parseInt(id) },
    });

    return deletedResponse("수주가 삭제되었습니다.");
  } catch (error) {
    return handleApiError(error);
  }
}

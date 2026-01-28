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

    // Get all parts with supplier info for material requirements
    const partsWithSuppliers = await prisma.part.findMany({
      where: {
        bomItems: {
          some: {
            product: {
              salesOrderItems: {
                some: { salesOrderId: parseInt(id) }
              }
            }
          }
        }
      },
      include: {
        supplier: true,
        inventory: true,
        orderItems: {
          where: {
            order: {
              status: { in: ["APPROVED", "ORDERED"] },
            },
          },
        },
      },
    });

    const partsMap = new Map(partsWithSuppliers.map(p => [p.id, p]));

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
      supplierId: number | null;
      supplierName: string | null;
      supplierCode: string | null;
      leadTimeDays: number;
      unitPrice: number;
      minOrderQty: number;
    }> = {};

    for (const item of salesOrder.items) {
      const orderQty = item.orderQty;
      for (const bomItem of item.product.bomItems) {
        const part = bomItem.part;
        const partWithSupplier = partsMap.get(part.id);
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
            supplierId: partWithSupplier?.supplierId ?? null,
            supplierName: partWithSupplier?.supplier?.name ?? null,
            supplierCode: partWithSupplier?.supplier?.code ?? null,
            leadTimeDays: partWithSupplier?.supplier?.leadTimeDays ?? 7,
            unitPrice: partWithSupplier?.unitPrice ?? 0,
            minOrderQty: partWithSupplier?.minOrderQty ?? 1,
          };
        }

        materialRequirements[part.id].totalRequirement += requirement;
      }
    }

    // Calculate shortage and urgency for each part
    const dueDate = salesOrder.dueDate ? new Date(salesOrder.dueDate) : null;
    const today = new Date();

    const materials = Object.values(materialRequirements).map((mat) => {
      const totalRequirement = Math.round(mat.totalRequirement);
      const shortageQty = Math.max(0, Math.round(mat.totalRequirement - mat.availableStock));

      // Calculate recommended order quantity (considering min order qty and safety stock)
      let recommendedOrderQty = shortageQty + mat.safetyStock;
      if (mat.minOrderQty > 1 && recommendedOrderQty < mat.minOrderQty) {
        recommendedOrderQty = mat.minOrderQty;
      }

      // Calculate urgency based on lead time vs due date
      let urgency: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "LOW";
      if (shortageQty > 0) {
        if (dueDate) {
          const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const daysNeeded = mat.leadTimeDays;

          if (daysNeeded >= daysUntilDue) {
            urgency = "CRITICAL"; // Lead time exceeds or equals due date
          } else if (daysNeeded >= daysUntilDue - 3) {
            urgency = "HIGH"; // Within 3 days margin
          } else if (daysNeeded >= daysUntilDue - 7) {
            urgency = "MEDIUM"; // Within 7 days margin
          }
        } else {
          // No due date, base on shortage severity
          const shortageRatio = shortageQty / (mat.totalRequirement || 1);
          if (shortageRatio > 0.5) urgency = "CRITICAL";
          else if (shortageRatio > 0.3) urgency = "HIGH";
          else if (shortageRatio > 0.1) urgency = "MEDIUM";
        }
      }

      return {
        ...mat,
        totalRequirement,
        shortageQty,
        recommendedOrderQty,
        urgency,
        estimatedCost: recommendedOrderQty * mat.unitPrice,
      };
    });

    // Sort by urgency (CRITICAL > HIGH > MEDIUM > LOW), then by shortage
    const urgencyOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    materials.sort((a, b) => {
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return b.shortageQty - a.shortageQty;
    });

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

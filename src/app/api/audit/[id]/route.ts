import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError, notFound, deletedResponse } from "@/lib/api-error";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const audit = await prisma.auditRecord.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            part: true,
          },
        },
      },
    });

    if (!audit) {
      throw notFound("실사 기록");
    }

    return NextResponse.json(audit);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const auditId = parseInt(id);

    // 실사 완료 시 재고 조정 처리
    if (body.status === "COMPLETED" && body.adjustInventory) {
      // 불일치 항목 조회
      const discrepancyItems = await prisma.auditItem.findMany({
        where: {
          auditId,
          countedQty: { not: null },
          NOT: { discrepancy: 0 },
        },
        include: {
          part: {
            include: {
              inventory: true,
            },
          },
        },
      });

      // 각 불일치 항목에 대해 재고 조정
      for (const item of discrepancyItems) {
        if (item.countedQty === null || !item.part.inventory) continue;

        const beforeQty = item.part.inventory.currentQty;
        const afterQty = item.countedQty;
        const adjustmentQty = afterQty - beforeQty;

        // 재고 수량 업데이트
        await prisma.inventory.update({
          where: { partId: item.partId },
          data: {
            currentQty: afterQty,
            lastAuditDate: new Date(),
            lastAuditQty: afterQty,
          },
        });

        // 재고 조정 트랜잭션 기록
        await prisma.transaction.create({
          data: {
            transactionCode: `ADJ-${Date.now()}-${item.partId}`,
            partId: item.partId,
            transactionType: "ADJUSTMENT",
            quantity: Math.abs(adjustmentQty),
            beforeQty,
            afterQty,
            referenceType: "AUDIT",
            referenceId: auditId.toString(),
            reason: `실사 조정 (${item.notes || "실사 결과 반영"})`,
            performedBy: body.performedBy || "SYSTEM",
            notes: `실사코드: ${body.auditCode}, 시스템수량: ${item.systemQty}, 실사수량: ${item.countedQty}`,
          },
        });

        // 불일치 로그 기록
        await prisma.discrepancyLog.create({
          data: {
            partId: item.partId,
            detectedDate: new Date(),
            systemQty: item.systemQty,
            actualQty: item.countedQty,
            discrepancy: item.discrepancy || 0,
            discrepancyType: (item.discrepancy || 0) > 0 ? "OVERAGE" : "SHORTAGE",
            causeCategory: "AUDIT",
            causeDetail: item.notes || null,
            resolution: "재고 자동 조정됨",
            resolvedAt: new Date(),
            resolvedBy: body.performedBy || "SYSTEM",
            status: "RESOLVED",
            notes: `실사코드: ${body.auditCode}`,
          },
        });
      }
    }

    // 실사 기록 업데이트
    const audit = await prisma.auditRecord.update({
      where: { id: auditId },
      data: {
        auditDate: body.auditDate ? new Date(body.auditDate) : undefined,
        auditType: body.auditType,
        status: body.status,
        notes: body.notes,
        totalItems: body.totalItems,
        matchedItems: body.matchedItems,
        discrepancyItems: body.discrepancyItems,
        completedAt: body.status === "COMPLETED" ? new Date() : undefined,
      },
      include: {
        items: {
          include: {
            part: true,
          },
        },
      },
    });

    return NextResponse.json(audit);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;

    // Delete related items first
    await prisma.auditItem.deleteMany({
      where: { auditId: parseInt(id) },
    });

    await prisma.auditRecord.delete({
      where: { id: parseInt(id) },
    });

    return deletedResponse("실사 기록이 삭제되었습니다.");
  } catch (error) {
    return handleApiError(error);
  }
}

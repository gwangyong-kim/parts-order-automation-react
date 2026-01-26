import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const audits = await prisma.auditRecord.findMany({
      include: {
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform to match frontend expectations
    const transformedAudits = audits.map((audit) => ({
      ...audit,
      createdBy: audit.performedBy ? { name: audit.performedBy } : null,
    }));

    return NextResponse.json(transformedAudits);
  } catch (error) {
    console.error("Failed to fetch audits:", error);
    return NextResponse.json(
      { error: "Failed to fetch audits" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 실사 범위에 따라 품목 결정 (Inventory 포함하여 조회)
    const auditScope = body.auditScope || "ALL";
    let partsToAudit;

    if (auditScope === "PARTIAL" && body.partIds && body.partIds.length > 0) {
      // 일부 품목: 선택된 품목만 가져오기
      partsToAudit = await prisma.part.findMany({
        where: {
          id: { in: body.partIds },
        },
        include: {
          inventory: true,
        },
      });
    } else {
      // 전체 품목: 모든 품목 가져오기
      partsToAudit = await prisma.part.findMany({
        include: {
          inventory: true,
        },
      });
    }

    // 실사 기록 생성
    const audit = await prisma.auditRecord.create({
      data: {
        auditCode: `AUDIT-${Date.now()}`,
        auditDate: new Date(body.auditDate),
        auditType: body.auditType || "MONTHLY",
        status: "PLANNED",
        notes: body.notes,
        performedBy: body.performedBy || null,
        totalItems: partsToAudit.length,
        matchedItems: 0,
        discrepancyItems: 0,
      },
    });

    // 실사 품목 생성 (Inventory에서 currentQty 가져옴)
    if (partsToAudit.length > 0) {
      await prisma.auditItem.createMany({
        data: partsToAudit.map((part) => ({
          auditId: audit.id,
          partId: part.id,
          systemQty: part.inventory?.currentQty || 0,
          countedQty: null,
          discrepancy: null,
          notes: null,
        })),
      });
    }

    // 생성된 실사와 품목 함께 반환
    const auditWithItems = await prisma.auditRecord.findUnique({
      where: { id: audit.id },
      include: {
        items: {
          include: {
            part: true,
          },
        },
      },
    });

    return NextResponse.json(auditWithItems, { status: 201 });
  } catch (error) {
    console.error("Failed to create audit:", error);
    return NextResponse.json(
      { error: "Failed to create audit" },
      { status: 500 }
    );
  }
}

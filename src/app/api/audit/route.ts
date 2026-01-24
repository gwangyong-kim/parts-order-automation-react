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

    const audit = await prisma.auditRecord.create({
      data: {
        auditCode: `AUDIT-${Date.now()}`,
        auditDate: new Date(body.auditDate),
        status: "PLANNED",
        notes: body.notes,
        performedBy: body.performedBy || null,
      },
    });

    return NextResponse.json(audit, { status: 201 });
  } catch (error) {
    console.error("Failed to create audit:", error);
    return NextResponse.json(
      { error: "Failed to create audit" },
      { status: 500 }
    );
  }
}

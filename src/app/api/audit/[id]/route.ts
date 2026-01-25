import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
      return NextResponse.json({ error: "Audit not found" }, { status: 404 });
    }

    return NextResponse.json(audit);
  } catch (error) {
    console.error("Failed to fetch audit:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();

    const audit = await prisma.auditRecord.update({
      where: { id: parseInt(id) },
      data: {
        auditDate: body.auditDate ? new Date(body.auditDate) : undefined,
        status: body.status,
        notes: body.notes,
        totalItems: body.totalItems,
        matchedItems: body.matchedItems,
        discrepancyItems: body.discrepancyItems,
        completedAt: body.status === "COMPLETED" ? new Date() : undefined,
      },
    });

    return NextResponse.json(audit);
  } catch (error) {
    console.error("Failed to update audit:", error);
    return NextResponse.json(
      { error: "Failed to update audit" },
      { status: 500 }
    );
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete audit:", error);
    return NextResponse.json(
      { error: "Failed to delete audit" },
      { status: 500 }
    );
  }
}

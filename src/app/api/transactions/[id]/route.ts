import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const transaction = await prisma.transaction.findUnique({
      where: { id: parseInt(id) },
      include: {
        part: true,
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Failed to fetch transaction:", error);
    return NextResponse.json(
      { error: "Failed to fetch transaction" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const transactionId = parseInt(id);

    // 기존 트랜잭션 조회
    const existingTransaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        part: {
          include: {
            inventory: true,
          },
        },
      },
    });

    if (!existingTransaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // 재고 롤백 계산 (기존 트랜잭션 영향 제거)
    let inventoryQty = existingTransaction.part.inventory?.currentQty || 0;

    // 기존 트랜잭션 영향 제거
    if (existingTransaction.transactionType === "INBOUND") {
      inventoryQty -= existingTransaction.quantity;
    } else if (existingTransaction.transactionType === "OUTBOUND") {
      inventoryQty += existingTransaction.quantity;
    } else if (existingTransaction.transactionType === "ADJUSTMENT") {
      inventoryQty = existingTransaction.beforeQty;
    }

    // 새 트랜잭션 영향 적용
    const newQuantity = body.quantity || existingTransaction.quantity;
    const newType = body.transactionType || existingTransaction.transactionType;
    const beforeQty = inventoryQty;
    let afterQty = inventoryQty;

    if (newType === "INBOUND") {
      afterQty = inventoryQty + newQuantity;
    } else if (newType === "OUTBOUND") {
      afterQty = inventoryQty - newQuantity;
      if (afterQty < 0) {
        return NextResponse.json(
          { error: "재고가 부족합니다." },
          { status: 400 }
        );
      }
    } else if (newType === "ADJUSTMENT") {
      afterQty = newQuantity; // 조정의 경우 수량이 직접 재고가 됨
    }

    // 재고 업데이트
    await prisma.inventory.update({
      where: { partId: existingTransaction.partId },
      data: {
        currentQty: afterQty,
        lastInboundDate: newType === "INBOUND" ? new Date() : undefined,
        lastOutboundDate: newType === "OUTBOUND" ? new Date() : undefined,
      },
    });

    // 트랜잭션 업데이트
    const updatedTransaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        transactionType: newType,
        quantity: newType === "ADJUSTMENT" ? Math.abs(afterQty - beforeQty) : newQuantity,
        beforeQty,
        afterQty,
        reason: body.reason,
        notes: body.notes,
        performedBy: body.performedBy,
      },
      include: {
        part: true,
      },
    });

    return NextResponse.json(updatedTransaction);
  } catch (error) {
    console.error("Failed to update transaction:", error);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const transactionId = parseInt(id);

    // 기존 트랜잭션 조회
    const existingTransaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        part: {
          include: {
            inventory: true,
          },
        },
      },
    });

    if (!existingTransaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // 재고 롤백 계산
    let inventoryQty = existingTransaction.part.inventory?.currentQty || 0;

    if (existingTransaction.transactionType === "INBOUND") {
      inventoryQty -= existingTransaction.quantity;
    } else if (existingTransaction.transactionType === "OUTBOUND") {
      inventoryQty += existingTransaction.quantity;
    } else if (existingTransaction.transactionType === "ADJUSTMENT") {
      inventoryQty = existingTransaction.beforeQty;
    }

    // 재고가 음수가 되지 않도록 확인
    if (inventoryQty < 0) {
      return NextResponse.json(
        { error: "삭제 시 재고가 음수가 됩니다. 삭제할 수 없습니다." },
        { status: 400 }
      );
    }

    // 재고 업데이트
    await prisma.inventory.update({
      where: { partId: existingTransaction.partId },
      data: {
        currentQty: inventoryQty,
      },
    });

    // 트랜잭션 삭제
    await prisma.transaction.delete({
      where: { id: transactionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete transaction:", error);
    return NextResponse.json(
      { error: "Failed to delete transaction" },
      { status: 500 }
    );
  }
}

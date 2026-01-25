import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: {
        bomItems: {
          include: {
            part: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("Failed to fetch product:", error);
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const productId = parseInt(id);

    // 트랜잭션으로 제품과 BOM 항목 함께 업데이트
    const product = await prisma.$transaction(async (tx) => {
      // 1. 제품 기본 정보 업데이트
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: {
          productCode: body.productCode,
          productName: body.productName,
          description: body.description,
          isActive: body.isActive,
        },
      });

      // 2. BOM 항목 처리 (bomItems가 전달된 경우에만)
      if (body.bomItems !== undefined) {
        // 기존 BOM 항목 삭제
        await tx.bomItem.deleteMany({
          where: { productId },
        });

        // 새 BOM 항목 생성
        if (body.bomItems.length > 0) {
          await tx.bomItem.createMany({
            data: body.bomItems.map((item: {
              partId: number;
              quantityPerUnit: number;
              lossRate?: number;
              notes?: string;
            }) => ({
              productId,
              partId: item.partId,
              quantityPerUnit: item.quantityPerUnit,
              lossRate: item.lossRate || 0,
              notes: item.notes || null,
            })),
          });
        }
      }

      // 3. 업데이트된 제품과 BOM 항목 조회
      return tx.product.findUnique({
        where: { id: productId },
        include: {
          bomItems: {
            include: {
              part: true,
            },
          },
        },
      });
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error("Failed to update product:", error);
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;

    // Soft delete - just set isActive to false
    await prisma.product.update({
      where: { id: parseInt(id) },
      data: { isActive: false },
    });

    return NextResponse.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Failed to delete product:", error);
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500 }
    );
  }
}

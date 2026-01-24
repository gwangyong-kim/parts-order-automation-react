import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const category = await prisma.category.findUnique({
      where: { id: parseInt(id) },
      include: {
        parent: true,
        children: true,
        parts: { take: 10 },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "카테고리를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: "이름은 필수입니다." },
        { status: 400 }
      );
    }

    // 코드 중복 체크 (자기 자신 제외)
    if (body.code) {
      const existing = await prisma.category.findFirst({
        where: {
          code: body.code,
          NOT: { id: parseInt(id) },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "이미 존재하는 코드입니다." },
          { status: 400 }
        );
      }
    }

    const category = await prisma.category.update({
      where: { id: parseInt(id) },
      data: {
        code: body.code,
        name: body.name,
        description: body.description || null,
        parentId: body.parentId || null,
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const categoryId = parseInt(id);

    // 해당 카테고리를 사용 중인 활성 부품 확인
    const partsCount = await prisma.part.count({
      where: { categoryId, isActive: true },
    });

    if (partsCount > 0) {
      return NextResponse.json(
        { error: `이 카테고리를 사용 중인 부품이 ${partsCount}개 있습니다. 먼저 부품의 카테고리를 변경해주세요.` },
        { status: 400 }
      );
    }

    // 하위 카테고리 확인
    const childrenCount = await prisma.category.count({
      where: { parentId: categoryId },
    });

    if (childrenCount > 0) {
      return NextResponse.json(
        { error: `하위 카테고리가 ${childrenCount}개 있습니다. 먼저 하위 카테고리를 삭제해주세요.` },
        { status: 400 }
      );
    }

    await prisma.category.delete({
      where: { id: categoryId },
    });

    return NextResponse.json({ message: "삭제되었습니다." });
  } catch (error) {
    return handleApiError(error);
  }
}

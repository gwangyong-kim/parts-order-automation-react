import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: {
            parts: { where: { isActive: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(categories);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.code || !body.name) {
      return NextResponse.json(
        { error: "코드와 이름은 필수입니다." },
        { status: 400 }
      );
    }

    // 코드 중복 체크
    const existing = await prisma.category.findUnique({
      where: { code: body.code },
    });

    if (existing) {
      return NextResponse.json(
        { error: "이미 존재하는 코드입니다." },
        { status: 400 }
      );
    }

    const category = await prisma.category.create({
      data: {
        code: body.code,
        name: body.name,
        description: body.description || null,
        parentId: body.parentId || null,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hash } from "bcryptjs";
import { handleApiError, badRequest, createdResponse } from "@/lib/api-error";
import { requireAuth, requireAdmin } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    // 인증된 사용자만 사용자 목록 조회 가능
    const authResult = await requireAuth();
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const skip = (page - 1) * pageSize;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          role: true,
          department: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.user.count(),
    ]);

    return NextResponse.json({
      data: users,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    // 관리자만 사용자 생성 가능
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const body = await request.json();

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: body.username },
    });

    if (existingUser) {
      throw badRequest("Username already exists");
    }

    // Hash password
    const passwordHash = await hash(body.password, 12);

    const user = await prisma.user.create({
      data: {
        username: body.username,
        passwordHash,
        name: body.name,
        email: body.email,
        role: body.role || "VIEWER",
        department: body.department,
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        department: true,
        isActive: true,
        createdAt: true,
      },
    });

    return createdResponse(user);
  } catch (error) {
    return handleApiError(error);
  }
}

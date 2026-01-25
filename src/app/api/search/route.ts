import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface SearchResult {
  id: number;
  type: "part" | "order" | "supplier";
  title: string;
  subtitle?: string;
  link: string;
}

// GET: 전역 검색
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();

    if (!query || query.length < 1) {
      return NextResponse.json({ results: [] });
    }

    const searchTerm = query.toLowerCase();
    const results: SearchResult[] = [];

    // 파츠 검색
    const parts = await prisma.part.findMany({
      where: {
        isActive: true,
        OR: [
          { partCode: { contains: searchTerm } },
          { partName: { contains: searchTerm } },
        ],
      },
      take: 5,
      orderBy: { partCode: "asc" },
    });

    parts.forEach((part) => {
      results.push({
        id: part.id,
        type: "part",
        title: part.partCode,
        subtitle: part.partName || undefined,
        link: `/parts?search=${encodeURIComponent(part.partCode)}`,
      });
    });

    // 공급업체 검색
    const suppliers = await prisma.supplier.findMany({
      where: {
        isActive: true,
        OR: [
          { code: { contains: searchTerm } },
          { name: { contains: searchTerm } },
        ],
      },
      take: 5,
      orderBy: { code: "asc" },
    });

    suppliers.forEach((supplier) => {
      results.push({
        id: supplier.id,
        type: "supplier",
        title: supplier.code,
        subtitle: supplier.name,
        link: `/suppliers?search=${encodeURIComponent(supplier.code)}`,
      });
    });

    // 발주 검색
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { orderCode: { contains: searchTerm } },
          { supplier: { name: { contains: searchTerm } } },
        ],
      },
      include: { supplier: true },
      take: 5,
      orderBy: { orderDate: "desc" },
    });

    orders.forEach((order) => {
      results.push({
        id: order.id,
        type: "order",
        title: order.orderCode,
        subtitle: order.supplier?.name || undefined,
        link: `/orders?search=${encodeURIComponent(order.orderCode)}`,
      });
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search failed:", error);
    return NextResponse.json(
      { error: "검색에 실패했습니다." },
      { status: 500 }
    );
  }
}

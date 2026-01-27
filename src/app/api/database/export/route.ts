import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// 전체 데이터 내보내기 (JSON)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tables = searchParams.get("tables")?.split(",") || ["all"];
    const format = searchParams.get("format") || "json";

    const exportData: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      version: "1.0",
    };

    const shouldExport = (table: string) =>
      tables.includes("all") || tables.includes(table);

    // 마스터 데이터
    if (shouldExport("categories")) {
      exportData.categories = await prisma.category.findMany();
    }
    if (shouldExport("suppliers")) {
      exportData.suppliers = await prisma.supplier.findMany();
    }
    if (shouldExport("parts")) {
      exportData.parts = await prisma.part.findMany({
        include: { category: true, supplier: true },
      });
    }
    if (shouldExport("products")) {
      exportData.products = await prisma.product.findMany({
        include: { bomItems: true },
      });
    }

    // 재고 데이터
    if (shouldExport("inventory")) {
      exportData.inventory = await prisma.inventory.findMany({
        include: { part: true },
      });
    }

    // 거래 데이터
    if (shouldExport("transactions")) {
      exportData.transactions = await prisma.transaction.findMany({
        include: { part: true },
        orderBy: { createdAt: "desc" },
        take: 10000, // 최근 1만건
      });
    }

    // 주문 데이터
    if (shouldExport("orders")) {
      exportData.orders = await prisma.order.findMany({
        include: { supplier: true, items: true },
        orderBy: { createdAt: "desc" },
        take: 1000,
      });
    }
    if (shouldExport("salesOrders")) {
      exportData.salesOrders = await prisma.salesOrder.findMany({
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: "desc" },
        take: 1000,
      });
    }

    // 창고 데이터
    if (shouldExport("warehouses")) {
      exportData.warehouses = await prisma.warehouse.findMany({
        include: { zones: { include: { racks: true } } },
      });
    }

    // 사용자 (비밀번호 제외)
    if (shouldExport("users")) {
      exportData.users = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });
    }

    const jsonString = JSON.stringify(exportData, null, 2);

    if (format === "download") {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      return new NextResponse(jsonString, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="partsync_export_${timestamp}.json"`,
        },
      });
    }

    return NextResponse.json(exportData);
  } catch (error) {
    console.error("데이터 내보내기 오류:", error);
    return NextResponse.json(
      { error: "데이터 내보내기에 실패했습니다." },
      { status: 500 }
    );
  }
}

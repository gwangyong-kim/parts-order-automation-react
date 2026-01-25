import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const reportType = searchParams.get("type");

  try {
    switch (reportType) {
      case "inventory-status":
        return await getInventoryStatusReport();
      case "inventory-movement":
        return await getInventoryMovementReport();
      case "order-status":
        return await getOrderStatusReport();
      case "order-history":
        return await getOrderHistoryReport();
      case "sales-analysis":
        return await getSalesAnalysisReport();
      case "cost-analysis":
        return await getCostAnalysisReport();
      case "supplier-performance":
        return await getSupplierPerformanceReport();
      case "audit-summary":
        return await getAuditSummaryReport();
      default:
        return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
    }
  } catch (error) {
    console.error("Failed to generate report:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}

// 재고 현황 리포트
async function getInventoryStatusReport() {
  // Parallel database queries (async-parallel rule: 2x improvement)
  const [inventory, byCategory] = await Promise.all([
    prisma.inventory.findMany({
      include: {
        part: {
          include: {
            category: true,
          },
        },
      },
    }),
    prisma.category.findMany({
      include: {
        parts: {
          include: {
            inventory: true,
          },
        },
      },
    }),
  ]);

  const lowStockItems = inventory.filter(
    (item) => item.currentQty <= (item.part.safetyStock || 0)
  );

  const overStockItems = inventory.filter(
    (item) => item.currentQty > ((item.part.safetyStock || 0) * 3)
  );

  const totalValue = inventory.reduce(
    (sum, item) => sum + item.currentQty * (item.part.unitPrice || 0),
    0
  );

  const categoryStats = byCategory.map((cat) => ({
    category: cat.name,
    partCount: cat.parts.length,
    totalQty: cat.parts.reduce(
      (sum, p) => sum + (p.inventory?.currentQty || 0),
      0
    ),
    totalValue: cat.parts.reduce(
      (sum, p) => sum + (p.inventory?.currentQty || 0) * (p.unitPrice || 0),
      0
    ),
  }));

  return NextResponse.json({
    reportType: "inventory-status",
    generatedAt: new Date().toISOString(),
    summary: {
      totalParts: inventory.length,
      lowStockCount: lowStockItems.length,
      overStockCount: overStockItems.length,
      totalInventoryValue: totalValue,
    },
    lowStockItems: lowStockItems.map((item) => ({
      partNumber: item.part.partCode,
      partName: item.part.partName,
      currentQty: item.currentQty,
      safetyStock: item.part.safetyStock,
      category: item.part.category?.name,
    })),
    categoryStats,
  });
}

// 입출고 분석 리포트
async function getInventoryMovementReport() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const transactions = await prisma.transaction.findMany({
    where: {
      createdAt: { gte: thirtyDaysAgo },
    },
    include: {
      part: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const byType = {
    INBOUND: transactions.filter((t) => t.transactionType === "INBOUND"),
    OUTBOUND: transactions.filter((t) => t.transactionType === "OUTBOUND"),
    ADJUSTMENT: transactions.filter((t) => t.transactionType === "ADJUSTMENT"),
  };

  const totalInbound = byType.INBOUND.reduce((sum, t) => sum + t.quantity, 0);
  const totalOutbound = byType.OUTBOUND.reduce((sum, t) => sum + t.quantity, 0);

  // Daily trend
  const dailyTrend: Record<string, { inbound: number; outbound: number }> = {};
  transactions.forEach((t) => {
    const date = t.createdAt.toISOString().split("T")[0];
    if (!dailyTrend[date]) {
      dailyTrend[date] = { inbound: 0, outbound: 0 };
    }
    if (t.transactionType === "INBOUND") {
      dailyTrend[date].inbound += t.quantity;
    } else if (t.transactionType === "OUTBOUND") {
      dailyTrend[date].outbound += t.quantity;
    }
  });

  return NextResponse.json({
    reportType: "inventory-movement",
    generatedAt: new Date().toISOString(),
    period: {
      from: thirtyDaysAgo.toISOString(),
      to: new Date().toISOString(),
    },
    summary: {
      totalTransactions: transactions.length,
      totalInbound,
      totalOutbound,
      netChange: totalInbound - totalOutbound,
    },
    dailyTrend: Object.entries(dailyTrend).map(([date, data]) => ({
      date,
      ...data,
    })),
    recentTransactions: transactions.slice(0, 20).map((t) => ({
      transactionCode: t.transactionCode,
      type: t.transactionType,
      partNumber: t.part.partCode,
      partName: t.part.partName,
      quantity: t.quantity,
      date: t.createdAt,
    })),
  });
}

// 발주 현황 리포트
async function getOrderStatusReport() {
  // Parallel database queries (async-parallel rule: 2x improvement)
  const [orders, bySupplier] = await Promise.all([
    prisma.order.findMany({
      include: {
        supplier: true,
        items: {
          include: {
            part: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.supplier.findMany({
      include: {
        orders: true,
      },
    }),
  ]);

  const byStatus = {
    DRAFT: orders.filter((o) => o.status === "DRAFT"),
    SUBMITTED: orders.filter((o) => o.status === "SUBMITTED"),
    APPROVED: orders.filter((o) => o.status === "APPROVED"),
    ORDERED: orders.filter((o) => o.status === "ORDERED"),
    RECEIVED: orders.filter((o) => o.status === "RECEIVED"),
    CANCELLED: orders.filter((o) => o.status === "CANCELLED"),
  };

  const supplierStats = bySupplier.map((s) => ({
    supplier: s.name,
    totalOrders: s.orders.length,
    totalAmount: s.orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
    pendingOrders: s.orders.filter((o) =>
      ["SUBMITTED", "APPROVED", "ORDERED"].includes(o.status)
    ).length,
  }));

  return NextResponse.json({
    reportType: "order-status",
    generatedAt: new Date().toISOString(),
    summary: {
      totalOrders: orders.length,
      draftCount: byStatus.DRAFT.length,
      pendingCount:
        byStatus.SUBMITTED.length +
        byStatus.APPROVED.length +
        byStatus.ORDERED.length,
      completedCount: byStatus.RECEIVED.length,
      cancelledCount: byStatus.CANCELLED.length,
      totalAmount: orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
    },
    byStatus: Object.entries(byStatus).map(([status, items]) => ({
      status,
      count: items.length,
      totalAmount: items.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
    })),
    supplierStats,
  });
}

// 발주 이력 리포트
async function getOrderHistoryReport() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: sixMonthsAgo },
    },
    include: {
      supplier: true,
      items: {
        include: {
          part: true,
        },
      },
    },
    orderBy: { orderDate: "desc" },
  });

  // Monthly trend
  const monthlyTrend: Record<string, { count: number; amount: number }> = {};
  orders.forEach((o) => {
    const month = o.orderDate.toISOString().slice(0, 7);
    if (!monthlyTrend[month]) {
      monthlyTrend[month] = { count: 0, amount: 0 };
    }
    monthlyTrend[month].count++;
    monthlyTrend[month].amount += o.totalAmount || 0;
  });

  return NextResponse.json({
    reportType: "order-history",
    generatedAt: new Date().toISOString(),
    period: {
      from: sixMonthsAgo.toISOString(),
      to: new Date().toISOString(),
    },
    summary: {
      totalOrders: orders.length,
      totalAmount: orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
      averageOrderValue:
        orders.length > 0
          ? orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0) /
            orders.length
          : 0,
    },
    monthlyTrend: Object.entries(monthlyTrend)
      .map(([month, data]) => ({
        month,
        ...data,
      }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    recentOrders: orders.slice(0, 20).map((o) => ({
      orderNumber: o.orderCode,
      supplier: o.supplier?.name,
      orderDate: o.orderDate,
      expectedDate: o.expectedDate,
      status: o.status,
      itemCount: o.items.length,
      totalAmount: o.totalAmount,
    })),
  });
}

// 수주 분석 리포트
async function getSalesAnalysisReport() {
  const salesOrders = await prisma.salesOrder.findMany({
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
    orderBy: { orderDate: "desc" },
  });

  const byStatus = {
    PENDING: salesOrders.filter((s) => s.status === "PENDING"),
    CONFIRMED: salesOrders.filter((s) => s.status === "CONFIRMED"),
    IN_PRODUCTION: salesOrders.filter((s) => s.status === "IN_PRODUCTION"),
    COMPLETED: salesOrders.filter((s) => s.status === "COMPLETED"),
    CANCELLED: salesOrders.filter((s) => s.status === "CANCELLED"),
  };

  // Product popularity
  const productCounts: Record<string, { count: number; quantity: number }> = {};
  salesOrders.forEach((so) => {
    so.items.forEach((item) => {
      const key = item.product.productName;
      if (!productCounts[key]) {
        productCounts[key] = { count: 0, quantity: 0 };
      }
      productCounts[key].count++;
      productCounts[key].quantity += item.orderQty;
    });
  });

  const topProducts = Object.entries(productCounts)
    .map(([name, data]) => ({ productName: name, ...data }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  return NextResponse.json({
    reportType: "sales-analysis",
    generatedAt: new Date().toISOString(),
    summary: {
      totalOrders: salesOrders.length,
      pendingCount: byStatus.PENDING.length,
      inProgressCount:
        byStatus.CONFIRMED.length + byStatus.IN_PRODUCTION.length,
      completedCount: byStatus.COMPLETED.length,
    },
    byStatus: Object.entries(byStatus).map(([status, items]) => ({
      status,
      count: items.length,
    })),
    topProducts,
  });
}

// 비용 분석 리포트
async function getCostAnalysisReport() {
  // Parallel database queries (async-parallel rule: 3x improvement)
  const [parts, inventory, categoryValues] = await Promise.all([
    prisma.part.findMany({
      include: {
        inventory: true,
        category: true,
      },
    }),
    prisma.inventory.findMany({
      include: {
        part: true,
      },
    }),
    prisma.category.findMany({
      include: {
        parts: {
          include: {
            inventory: true,
          },
        },
      },
    }),
  ]);

  const totalInventoryValue = inventory.reduce(
    (sum, item) => sum + item.currentQty * (item.part.unitPrice || 0),
    0
  );

  const byCategoryValue = categoryValues.map((cat) => ({
    category: cat.name,
    partCount: cat.parts.length,
    inventoryValue: cat.parts.reduce(
      (sum, p) => sum + (p.inventory?.currentQty || 0) * (p.unitPrice || 0),
      0
    ),
  }));

  // Top expensive items
  const topCostItems = parts
    .map((p) => ({
      partNumber: p.partCode,
      partName: p.partName,
      unitPrice: p.unitPrice,
      currentQty: p.inventory?.currentQty || 0,
      totalValue: (p.inventory?.currentQty || 0) * (p.unitPrice || 0),
    }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 10);

  return NextResponse.json({
    reportType: "cost-analysis",
    generatedAt: new Date().toISOString(),
    summary: {
      totalParts: parts.length,
      totalInventoryValue,
      averagePartValue:
        parts.length > 0 ? totalInventoryValue / parts.length : 0,
    },
    byCategoryValue,
    topCostItems,
  });
}

// 공급업체 성과 리포트
async function getSupplierPerformanceReport() {
  const suppliers = await prisma.supplier.findMany({
    where: { isActive: true },
    include: {
      orders: {
        include: {
          items: true,
        },
      },
    },
  });

  const supplierStats = suppliers.map((s) => {
    const completedOrders = s.orders.filter((o) => o.status === "RECEIVED");
    const onTimeOrders = completedOrders.filter(
      (o) =>
        o.actualDate &&
        o.expectedDate &&
        new Date(o.actualDate) <= new Date(o.expectedDate)
    );

    return {
      supplierId: s.id,
      supplierName: s.name,
      totalOrders: s.orders.length,
      completedOrders: completedOrders.length,
      pendingOrders: s.orders.filter((o) =>
        ["SUBMITTED", "APPROVED", "ORDERED"].includes(o.status)
      ).length,
      onTimeDeliveryRate:
        completedOrders.length > 0
          ? (onTimeOrders.length / completedOrders.length) * 100
          : 0,
      totalAmount: s.orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
      averageOrderValue:
        s.orders.length > 0
          ? s.orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0) /
            s.orders.length
          : 0,
    };
  });

  return NextResponse.json({
    reportType: "supplier-performance",
    generatedAt: new Date().toISOString(),
    summary: {
      totalSuppliers: suppliers.length,
      activeSuppliers: suppliers.filter((s) => s.orders.length > 0).length,
      totalOrderValue: supplierStats.reduce((sum, s) => sum + s.totalAmount, 0),
    },
    supplierStats: supplierStats.sort((a, b) => b.totalOrders - a.totalOrders),
  });
}

// 실사 결과 리포트
async function getAuditSummaryReport() {
  // Parallel database queries (async-parallel rule: 2x improvement)
  const [audits, discrepancyLogs] = await Promise.all([
    prisma.auditRecord.findMany({
      include: {
        items: {
          include: {
            part: true,
          },
        },
      },
      orderBy: { auditDate: "desc" },
    }),
    prisma.discrepancyLog.findMany({
      include: {
        part: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const completedAudits = audits.filter((a) => a.status === "COMPLETED");
  const totalDiscrepancies = completedAudits.reduce(
    (sum, a) => sum + (a.discrepancyItems || 0),
    0
  );
  const totalItems = completedAudits.reduce(
    (sum, a) => sum + (a.totalItems || 0),
    0
  );

  return NextResponse.json({
    reportType: "audit-summary",
    generatedAt: new Date().toISOString(),
    summary: {
      totalAudits: audits.length,
      completedAudits: completedAudits.length,
      inProgressAudits: audits.filter((a) => a.status === "IN_PROGRESS").length,
      plannedAudits: audits.filter((a) => a.status === "PLANNED").length,
      totalItemsAudited: totalItems,
      totalDiscrepancies,
      accuracyRate:
        totalItems > 0
          ? ((totalItems - totalDiscrepancies) / totalItems) * 100
          : 100,
    },
    recentAudits: audits.slice(0, 10).map((a) => ({
      auditCode: a.auditCode,
      auditDate: a.auditDate,
      status: a.status,
      totalItems: a.totalItems,
      matchedItems: a.matchedItems,
      discrepancyItems: a.discrepancyItems,
      performedBy: a.performedBy,
    })),
    recentDiscrepancies: discrepancyLogs.slice(0, 20).map((d) => ({
      partNumber: d.part.partCode,
      partName: d.part.partName,
      systemQty: d.systemQty,
      actualQty: d.actualQty,
      difference: d.discrepancy,
      status: d.status,
      createdAt: d.createdAt,
    })),
  });
}

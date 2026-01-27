import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import prisma from "@/lib/prisma";

const DATA_DIR = process.env.NODE_ENV === "production" ? "/app/data" : "./prisma";
const DB_FILE = process.env.NODE_ENV === "production" ? "partsync.db" : "dev.db";

export async function GET() {
  try {
    // 테이블별 레코드 수 조회
    const [
      partsCount,
      productsCount,
      suppliersCount,
      categoriesCount,
      ordersCount,
      salesOrdersCount,
      transactionsCount,
      inventoryCount,
      usersCount,
      notificationsCount,
      auditRecordsCount,
      bulkUploadLogsCount,
      warehousesCount,
      pickingTasksCount,
    ] = await Promise.all([
      prisma.part.count(),
      prisma.product.count(),
      prisma.supplier.count(),
      prisma.category.count(),
      prisma.order.count(),
      prisma.salesOrder.count(),
      prisma.transaction.count(),
      prisma.inventory.count(),
      prisma.user.count(),
      prisma.notification.count(),
      prisma.auditRecord.count(),
      prisma.bulkUploadLog.count(),
      prisma.warehouse.count(),
      prisma.pickingTask.count(),
    ]);

    // DB 파일 크기
    const dbPath = path.join(DATA_DIR, DB_FILE);
    let dbSize = 0;
    let lastModified = null;
    try {
      const stat = await fs.stat(dbPath);
      dbSize = stat.size;
      lastModified = stat.mtime.toISOString();
    } catch {
      // 파일이 없을 수 있음
    }

    // SQLite 무결성 검사
    let integrityCheck = "unknown";
    try {
      const result = await prisma.$queryRawUnsafe<{ integrity_check: string }[]>(
        "PRAGMA integrity_check"
      );
      integrityCheck = result[0]?.integrity_check || "unknown";
    } catch {
      integrityCheck = "error";
    }

    // 최근 활동 요약
    const recentActivity = {
      last24hTransactions: await prisma.transaction.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      last7dOrders: await prisma.order.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      last7dSalesOrders: await prisma.salesOrder.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    };

    return NextResponse.json({
      database: {
        type: "SQLite",
        size: dbSize,
        sizeFormatted: formatBytes(dbSize),
        lastModified,
        integrityCheck,
      },
      tables: {
        parts: partsCount,
        products: productsCount,
        suppliers: suppliersCount,
        categories: categoriesCount,
        orders: ordersCount,
        salesOrders: salesOrdersCount,
        transactions: transactionsCount,
        inventory: inventoryCount,
        users: usersCount,
        notifications: notificationsCount,
        auditRecords: auditRecordsCount,
        bulkUploadLogs: bulkUploadLogsCount,
        warehouses: warehousesCount,
        pickingTasks: pickingTasksCount,
      },
      totalRecords:
        partsCount +
        productsCount +
        suppliersCount +
        categoriesCount +
        ordersCount +
        salesOrdersCount +
        transactionsCount +
        inventoryCount +
        usersCount +
        notificationsCount +
        auditRecordsCount +
        bulkUploadLogsCount +
        warehousesCount +
        pickingTasksCount,
      recentActivity,
    });
  } catch (error) {
    console.error("DB 통계 조회 오류:", error);
    return NextResponse.json(
      { error: "데이터베이스 통계를 불러오는데 실패했습니다." },
      { status: 500 }
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

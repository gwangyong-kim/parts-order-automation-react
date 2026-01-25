"use client";

import InventoryStatusChart from "./InventoryStatusChart";
import InventoryMovementChart from "./InventoryMovementChart";
import OrderStatusChart from "./OrderStatusChart";
import OrderHistoryChart from "./OrderHistoryChart";
import SalesAnalysisChart from "./SalesAnalysisChart";
import CostAnalysisChart from "./CostAnalysisChart";
import SupplierPerformanceChart from "./SupplierPerformanceChart";
import AuditSummaryChart from "./AuditSummaryChart";

interface ReportData {
  reportType: string;
  generatedAt: string;
  summary: Record<string, number | string>;
  [key: string]: unknown;
}

interface ReportVisualizationProps {
  data: ReportData;
}

export default function ReportVisualization({ data }: ReportVisualizationProps) {
  const { reportType } = data;

  switch (reportType) {
    case "inventory-status":
      return (
        <div className="glass-card p-6">
          <InventoryStatusChart
            data={(data.categoryStats as Array<{
              category: string;
              partCount: number;
              totalQty: number;
              totalValue: number;
            }>) || []}
          />
        </div>
      );

    case "inventory-movement":
      return (
        <div className="glass-card p-6">
          <InventoryMovementChart
            data={(data.dailyTrend as Array<{
              date: string;
              inbound: number;
              outbound: number;
            }>) || []}
          />
        </div>
      );

    case "order-status":
      return (
        <div className="glass-card p-6">
          <OrderStatusChart
            data={(data.byStatus as Array<{
              status: string;
              count: number;
              totalAmount?: number;
            }>) || []}
          />
        </div>
      );

    case "order-history":
      return (
        <div className="glass-card p-6">
          <OrderHistoryChart
            data={(data.monthlyTrend as Array<{
              month: string;
              count: number;
              amount: number;
            }>) || []}
          />
        </div>
      );

    case "sales-analysis":
      return (
        <div className="glass-card p-6">
          <SalesAnalysisChart
            data={(data.topProducts as Array<{
              productName: string;
              count: number;
              quantity: number;
            }>) || []}
          />
        </div>
      );

    case "cost-analysis":
      return (
        <div className="glass-card p-6">
          <CostAnalysisChart
            data={(data.byCategoryValue as Array<{
              category: string;
              partCount: number;
              inventoryValue: number;
            }>) || []}
          />
        </div>
      );

    case "supplier-performance":
      return (
        <div className="glass-card p-6">
          <SupplierPerformanceChart
            data={(data.supplierStats as Array<{
              supplierId: number;
              supplierName: string;
              totalOrders: number;
              completedOrders: number;
              onTimeDeliveryRate: number;
              totalAmount: number;
            }>) || []}
          />
        </div>
      );

    case "audit-summary":
      return (
        <div className="glass-card p-6">
          <AuditSummaryChart
            accuracyRate={
              typeof data.summary?.accuracyRate === "number"
                ? data.summary.accuracyRate
                : 100
            }
          />
        </div>
      );

    default:
      return (
        <div className="glass-card p-6 flex items-center justify-center h-[300px] text-[var(--text-muted)]">
          이 리포트 유형에 대한 시각화가 없습니다.
        </div>
      );
  }
}

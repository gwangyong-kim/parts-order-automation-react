import {
  Package,
  AlertTriangle,
  ShoppingCart,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import prisma from "@/lib/prisma";
import DashboardCharts from "@/components/charts/DashboardCharts";

async function getDashboardStats() {
  try {
    const [
      partsCount,
      pendingOrdersCount,
      recentTransactions,
    ] = await Promise.all([
      prisma.part.count({ where: { isActive: true } }),
      prisma.order.count({ where: { status: "DRAFT" } }),
      prisma.transaction.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { part: true },
      }),
    ]);

    // Get low stock parts using raw query
    const lowStockParts = await prisma.$queryRaw<
      { id: number; partName: string; currentQty: number; safetyStock: number }[]
    >`
      SELECT p.id, p.part_name as "partName", i.current_qty as "currentQty", p.safety_stock as "safetyStock"
      FROM parts p
      JOIN inventory i ON p.id = i.part_id
      WHERE i.current_qty <= p.safety_stock
      LIMIT 5
    `;

    return {
      partsCount,
      lowStockCount: lowStockParts.length,
      pendingOrdersCount,
      recentTransactions,
      lowStockParts,
    };
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return {
      partsCount: 0,
      lowStockCount: 0,
      pendingOrdersCount: 0,
      recentTransactions: [],
      lowStockParts: [],
    };
  }
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="animate-slide-up">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">대시보드</h1>
        <p className="text-[var(--text-secondary)] mt-1">
          PartSync MRP 시스템 현황을 확인하세요.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="총 부품 수"
          value={stats.partsCount}
          icon={Package}
          trend={{ value: 12, isPositive: true }}
          color="primary"
          delay={0}
        />
        <StatCard
          title="저재고 품목"
          value={stats.lowStockCount}
          icon={AlertTriangle}
          trend={{ value: 3, isPositive: false }}
          color="warning"
          delay={1}
        />
        <StatCard
          title="대기 발주"
          value={stats.pendingOrdersCount}
          icon={ShoppingCart}
          color="info"
          delay={2}
        />
        <StatCard
          title="이번 달 입고"
          value={0}
          icon={TrendingUp}
          trend={{ value: 8, isPositive: true }}
          color="success"
          delay={3}
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alert */}
        <div className="glass-card p-6 animate-slide-up stagger-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-gradient-to-b from-[var(--warning-500)] to-[var(--warning-600)] rounded-full" />
            저재고 알림
          </h2>
          {stats.lowStockParts.length > 0 ? (
            <div className="space-y-3">
              {stats.lowStockParts.map((part, index) => (
                <div
                  key={part.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-[var(--gray-50)] hover:bg-[var(--gray-100)] transition-colors"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">
                      {part.partName}
                    </p>
                    <p className="text-sm text-[var(--text-muted)] tabular-nums mt-0.5">
                      안전재고: {part.safetyStock}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[var(--danger-600)] tabular-nums text-lg">
                      {part.currentQty}
                    </p>
                    <span className="badge badge-danger">부족</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--success-50)] flex items-center justify-center mb-3">
                <Package className="w-6 h-6 text-[var(--success-500)]" />
              </div>
              <p className="text-[var(--text-muted)]">저재고 품목이 없습니다.</p>
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="glass-card p-6 animate-slide-up stagger-5">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-gradient-to-b from-[var(--primary-500)] to-[var(--primary-600)] rounded-full" />
            최근 입출고
          </h2>
          {stats.recentTransactions.length > 0 ? (
            <div className="space-y-3">
              {stats.recentTransactions.map((tx, index) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-[var(--gray-50)] hover:bg-[var(--gray-100)] transition-colors"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        tx.transactionType === "INBOUND"
                          ? "bg-[var(--success-100)] text-[var(--success-600)]"
                          : "bg-[var(--danger-100)] text-[var(--danger-600)]"
                      }`}
                    >
                      {tx.transactionType === "INBOUND" ? (
                        <ArrowDownRight className="w-5 h-5" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">
                        {tx.part.partName}
                      </p>
                      <p className="text-sm text-[var(--text-muted)] mono">
                        {tx.transactionCode}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-bold tabular-nums text-lg ${
                        tx.transactionType === "INBOUND"
                          ? "text-[var(--success-600)]"
                          : "text-[var(--danger-600)]"
                      }`}
                    >
                      {tx.transactionType === "INBOUND" ? "+" : "-"}
                      {tx.quantity}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {new Date(tx.createdAt).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--gray-100)] flex items-center justify-center mb-3">
                <TrendingUp className="w-6 h-6 text-[var(--gray-400)]" />
              </div>
              <p className="text-[var(--text-muted)]">최근 입출고 내역이 없습니다.</p>
            </div>
          )}
        </div>
      </div>

      {/* Charts Section */}
      <DashboardCharts />
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  trend?: { value: number; isPositive: boolean };
  color: "primary" | "success" | "warning" | "danger" | "info";
  delay?: number;
}

function StatCard({ title, value, icon: Icon, trend, color, delay = 0 }: StatCardProps) {
  const colorClasses = {
    primary: "stat-card-icon primary",
    success: "stat-card-icon success",
    warning: "stat-card-icon warning",
    danger: "stat-card-icon danger",
    info: "bg-[var(--info-100)] text-[var(--info-600)]",
  };

  return (
    <div
      className={`stat-card animate-slide-up stagger-${delay + 1}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`${colorClasses[color]} w-12 h-12 rounded-xl flex items-center justify-center`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <span
            className={`text-sm font-medium flex items-center gap-1 px-2 py-1 rounded-lg ${
              trend.isPositive
                ? "text-[var(--success-600)] bg-[var(--success-50)]"
                : "text-[var(--danger-600)] bg-[var(--danger-50)]"
            }`}
          >
            {trend.isPositive ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )}
            {trend.value}%
          </span>
        )}
      </div>
      <p className="stat-value">{value.toLocaleString()}</p>
      <p className="stat-label">{title}</p>
    </div>
  );
}

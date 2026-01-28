import {
  Package,
  AlertTriangle,
  ShoppingCart,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  AlertCircle,
  ClipboardCheck,
} from "lucide-react";
import prisma from "@/lib/prisma";
import DashboardCharts from "@/components/charts/DashboardCharts";

// 동적 렌더링 강제 (빌드 시점이 아닌 요청 시점에 DB 쿼리)
export const dynamic = "force-dynamic";

// 트렌드 계산 헬퍼 함수
function calculateTrend(current: number, previous: number): { value: number; isPositive: boolean } | null {
  if (previous === 0) {
    return current > 0 ? { value: 100, isPositive: true } : null;
  }
  const change = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(Math.round(change)),
    isPositive: change >= 0,
  };
}

interface LowStockPart {
  id: number;
  partName: string;
  currentQty: number;
  safetyStock: number;
}

interface RecentTransaction {
  id: number;
  transactionCode: string;
  transactionType: string;
  quantity: number;
  beforeQty: number;
  afterQty: number;
  createdAt: Date;
  part: {
    partName: string;
  };
}

async function getDashboardStats(): Promise<{
  partsCount: number;
  partsCountTrend: { value: number; isPositive: boolean } | null;
  lowStockCount: number;
  lowStockTrend: { value: number; isPositive: boolean } | null;
  pendingOrdersCount: number;
  recentTransactions: RecentTransaction[];
  lowStockParts: LowStockPart[];
  monthlyInbound: number;
  monthlyInboundTrend: { value: number; isPositive: boolean } | null;
  totalInventoryValue: number;
  criticalMrpCount: number;
  pendingAuditCount: number;
}> {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      partsCount,
      lastMonthPartsCount,
      pendingOrdersCount,
      recentTransactions,
      monthlyInbound,
      lastMonthInbound,
      totalInventoryValue,
      criticalMrpCount,
      pendingAuditCount,
    ] = await Promise.all([
      // 현재 파츠 수
      prisma.part.count({ where: { isActive: true } }),
      // 지난 달 파츠 수 (생성일 기준)
      prisma.part.count({
        where: {
          isActive: true,
          createdAt: { lt: firstDayOfMonth }
        }
      }),
      // 대기 발주 수
      prisma.order.count({ where: { status: "DRAFT" } }),
      // 최근 거래 내역
      prisma.transaction.findMany({
        take: 3,
        orderBy: { createdAt: "desc" },
        include: { part: true },
      }),
      // 이번 달 입고 수량
      prisma.transaction.aggregate({
        where: {
          transactionType: "INBOUND",
          createdAt: { gte: firstDayOfMonth },
        },
        _sum: { quantity: true },
      }),
      // 지난 달 입고 수량
      prisma.transaction.aggregate({
        where: {
          transactionType: "INBOUND",
          createdAt: { gte: firstDayOfLastMonth, lt: firstDayOfMonth },
        },
        _sum: { quantity: true },
      }),
      // 총 재고 금액
      prisma.$queryRaw<[{ total: number | null }]>`
        SELECT SUM(i.current_qty * p.unit_price) as total
        FROM inventory i
        JOIN parts p ON i.part_id = p.id
        WHERE p.is_active = true
      `,
      // MRP 긴급 품목 수
      prisma.mrpResult.count({
        where: {
          status: "PENDING",
          suggestedOrderQty: { gt: 0 }
        },
      }),
      // 진행 중 실사 수
      prisma.auditRecord.count({
        where: { status: "IN_PROGRESS" },
      }),
    ]);

    // 저재고 품목 카운트 (별도 쿼리)
    const lowStockCountResult = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM parts p
      JOIN inventory i ON p.id = i.part_id
      WHERE i.current_qty <= p.safety_stock AND p.is_active = true
    `;

    // 저재고 품목 목록 (표시용, 3개 제한)
    const lowStockParts = await prisma.$queryRaw<LowStockPart[]>`
      SELECT p.id, p.part_name as "partName", i.current_qty as "currentQty", p.safety_stock as "safetyStock"
      FROM parts p
      JOIN inventory i ON p.id = i.part_id
      WHERE i.current_qty <= p.safety_stock AND p.is_active = true
      ORDER BY (i.current_qty - p.safety_stock) ASC
      LIMIT 3
    `;

    // 지난달 저재고 수 (트렌드 계산용)
    const lastMonthLowStockResult = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM parts p
      JOIN inventory i ON p.id = i.part_id
      WHERE i.current_qty <= p.safety_stock AND p.is_active = true
      AND p.created_at < ${firstDayOfMonth}
    `;

    const lowStockCount = Number(lowStockCountResult[0]?.count ?? 0);
    const lastMonthLowStock = Number(lastMonthLowStockResult[0]?.count ?? 0);
    const currentMonthInbound = monthlyInbound._sum.quantity ?? 0;
    const previousMonthInbound = lastMonthInbound._sum.quantity ?? 0;

    return {
      partsCount,
      partsCountTrend: calculateTrend(partsCount, lastMonthPartsCount),
      lowStockCount,
      lowStockTrend: calculateTrend(lowStockCount, lastMonthLowStock),
      pendingOrdersCount,
      recentTransactions,
      lowStockParts,
      monthlyInbound: currentMonthInbound,
      monthlyInboundTrend: calculateTrend(currentMonthInbound, previousMonthInbound),
      totalInventoryValue: totalInventoryValue[0]?.total ?? 0,
      criticalMrpCount,
      pendingAuditCount,
    };
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return {
      partsCount: 0,
      partsCountTrend: null,
      lowStockCount: 0,
      lowStockTrend: null,
      pendingOrdersCount: 0,
      recentTransactions: [] as RecentTransaction[],
      lowStockParts: [] as LowStockPart[],
      monthlyInbound: 0,
      monthlyInboundTrend: null,
      totalInventoryValue: 0,
      criticalMrpCount: 0,
      pendingAuditCount: 0,
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

      {/* Stats Grid - Row 1: 기본 지표 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="총 파츠 수"
          value={stats.partsCount}
          icon={Package}
          trend={stats.partsCountTrend}
          color="primary"
          delay={0}
        />
        <StatCard
          title="저재고 품목"
          value={stats.lowStockCount}
          icon={AlertTriangle}
          trend={stats.lowStockTrend ? { ...stats.lowStockTrend, isPositive: !stats.lowStockTrend.isPositive } : undefined}
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
          value={stats.monthlyInbound}
          icon={TrendingUp}
          trend={stats.monthlyInboundTrend}
          color="success"
          delay={3}
        />
      </div>

      {/* Stats Grid - Row 2: 추가 지표 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="총 재고 금액"
          value={stats.totalInventoryValue}
          icon={DollarSign}
          color="success"
          delay={4}
          format="currency"
        />
        <StatCard
          title="MRP 발주 필요"
          value={stats.criticalMrpCount}
          icon={AlertCircle}
          color="danger"
          delay={5}
        />
        <StatCard
          title="진행 중 실사"
          value={stats.pendingAuditCount}
          icon={ClipboardCheck}
          color="info"
          delay={6}
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alert */}
        <div className="glass-card p-5 animate-slide-up stagger-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-gradient-to-b from-[var(--warning-500)] to-[var(--warning-600)] rounded-full" />
            저재고 알림
          </h2>
          {stats.lowStockParts.length > 0 ? (
            <div className="space-y-2">
              {stats.lowStockParts.map((part, index) => (
                <div
                  key={part.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-[var(--gray-50)] hover:bg-[var(--gray-100)] transition-colors"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div>
                    <p className="font-medium text-[var(--text-primary)] text-sm">
                      {part.partName}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] tabular-nums">
                      안전재고: {part.safetyStock}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[var(--danger-600)] tabular-nums">
                      {part.currentQty}
                    </p>
                    <span className="badge badge-danger text-xs">부족</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-10 h-10 rounded-full bg-[var(--success-50)] flex items-center justify-center mb-2">
                <Package className="w-5 h-5 text-[var(--success-500)]" />
              </div>
              <p className="text-sm text-[var(--text-muted)]">저재고 품목이 없습니다.</p>
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="glass-card p-5 animate-slide-up stagger-5">
          <h2 className="text-base font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-gradient-to-b from-[var(--primary-500)] to-[var(--primary-600)] rounded-full" />
            최근 입출고
          </h2>
          {stats.recentTransactions.length > 0 ? (
            <div className="space-y-2">
              {stats.recentTransactions.map((tx, index) => {
                // ADJUSTMENT의 경우 실제 변화량 계산, 그 외는 quantity 사용
                const changeAmount = tx.transactionType === "ADJUSTMENT"
                  ? tx.afterQty - tx.beforeQty
                  : tx.transactionType === "INBOUND"
                    ? tx.quantity
                    : -tx.quantity;
                const isPositive = changeAmount >= 0;

                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--gray-50)] hover:bg-[var(--gray-100)] transition-colors"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isPositive
                            ? "bg-[var(--success-100)] text-[var(--success-600)]"
                            : "bg-[var(--danger-100)] text-[var(--danger-600)]"
                        }`}
                      >
                        {isPositive ? (
                          <ArrowDownRight className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-primary)] text-sm">
                          {tx.part.partName}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mono">
                          {tx.transactionCode}
                          {tx.transactionType === "ADJUSTMENT" && (
                            <span className="ml-1 text-[var(--info)]">(조정)</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-bold tabular-nums ${
                          isPositive
                            ? "text-[var(--success-600)]"
                            : "text-[var(--danger-600)]"
                        }`}
                      >
                        {isPositive ? "+" : ""}{changeAmount}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {new Date(tx.createdAt).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-10 h-10 rounded-full bg-[var(--gray-100)] flex items-center justify-center mb-2">
                <TrendingUp className="w-5 h-5 text-[var(--gray-400)]" />
              </div>
              <p className="text-sm text-[var(--text-muted)]">최근 입출고 내역이 없습니다.</p>
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
  trend?: { value: number; isPositive: boolean } | null;
  color: "primary" | "success" | "warning" | "danger" | "info";
  delay?: number;
  format?: "number" | "currency";
}

function StatCard({ title, value, icon: Icon, trend, color, delay = 0, format = "number" }: StatCardProps) {
  const colorClasses = {
    primary: "stat-card-icon primary",
    success: "stat-card-icon success",
    warning: "stat-card-icon warning",
    danger: "stat-card-icon danger",
    info: "bg-[var(--info-100)] text-[var(--info-600)]",
  };

  const formatValue = (val: number) => {
    if (format === "currency") {
      if (val >= 100000000) {
        return `${(val / 100000000).toFixed(1)}억`;
      }
      if (val >= 10000) {
        return `${(val / 10000).toFixed(0)}만`;
      }
      return `₩${val.toLocaleString()}`;
    }
    return val.toLocaleString();
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
      <p className="stat-value">{formatValue(value)}</p>
      <p className="stat-label">{title}</p>
    </div>
  );
}

"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Box,
  Edit2,
  Layers,
  Package,
  ShoppingCart,
  FileText,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import type { Product, BomItem, SalesOrder, SalesOrderItemStatus } from "@/types/entities";
import { usePermission } from "@/hooks/usePermission";

interface ProductWithBom extends Product {
  bomItems: (BomItem & {
    part: {
      id: number;
      partCode: string;
      partName: string;
      unit: string;
      unitPrice: number;
    };
  })[];
}

interface SalesOrderItemWithOrder {
  id: number;
  orderQty: number;
  producedQty: number;
  status: SalesOrderItemStatus;
  salesOrder: SalesOrder;
}

async function fetchProduct(id: string): Promise<ProductWithBom> {
  const res = await fetch(`/api/products/${id}`);
  if (!res.ok) throw new Error("Failed to fetch product");
  return res.json();
}

async function fetchProductSalesOrders(id: string): Promise<SalesOrderItemWithOrder[]> {
  const res = await fetch(`/api/products/${id}/sales-orders`);
  if (!res.ok) throw new Error("Failed to fetch sales orders");
  return res.json();
}

const statusColors: Record<string, string> = {
  RECEIVED: "badge-info",
  IN_PROGRESS: "badge-warning",
  COMPLETED: "badge-success",
  CANCELLED: "badge-secondary",
  PENDING: "badge-secondary",
};

const statusLabels: Record<string, string> = {
  RECEIVED: "접수",
  IN_PROGRESS: "진행중",
  COMPLETED: "완료",
  CANCELLED: "취소",
  PENDING: "대기",
};

const statusIcons: Record<string, React.ElementType> = {
  RECEIVED: FileText,
  IN_PROGRESS: Clock,
  COMPLETED: CheckCircle,
  CANCELLED: XCircle,
  PENDING: Clock,
};

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { can } = usePermission();

  const {
    data: product,
    isLoading: productLoading,
    error: productError,
  } = useQuery({
    queryKey: ["product", id],
    queryFn: () => fetchProduct(id),
  });

  const { data: salesOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ["product-sales-orders", id],
    queryFn: () => fetchProductSalesOrders(id),
    enabled: !!product,
  });

  if (productLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin"
          role="status"
          aria-label="로딩 중"
        />
      </div>
    );
  }

  if (productError || !product) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-[var(--danger)]">제품을 찾을 수 없습니다.</p>
        <Link href="/master-data?tab=products" className="mt-4 text-[var(--primary)] hover:underline">
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  // Calculate total BOM cost
  const totalBomCost = product.bomItems.reduce((sum, item) => {
    const effectiveQty = item.quantityPerUnit * (1 + (item.lossRate || 0));
    return sum + effectiveQty * item.part.unitPrice;
  }, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-[var(--glass-bg)] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                {product.productCode}
              </h1>
              <span
                className={`badge ${product.isActive ? "badge-success" : "badge-secondary"}`}
              >
                {product.isActive ? "활성" : "비활성"}
              </span>
            </div>
            <p className="text-[var(--text-secondary)]">{product.productName}</p>
          </div>
        </div>
        {can("master-data", "edit") && (
          <Link
            href={`/master-data?tab=products&edit=${id}`}
            className="btn btn-primary"
          >
            <Edit2 className="w-4 h-4" />
            편집
          </Link>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* BOM Items Count */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">BOM 항목</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {product.bomItems.length}
                <span className="text-sm font-normal ml-1">개</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--primary)]/10">
              <Layers className="w-6 h-6 text-[var(--primary)]" />
            </div>
          </div>
        </div>

        {/* Total BOM Cost */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">BOM 원가</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                ₩{totalBomCost.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--success)]/10">
              <Package className="w-6 h-6 text-[var(--success)]" />
            </div>
          </div>
        </div>

        {/* Active Orders */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">진행중 수주</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {salesOrders?.filter(
                  (o) => o.salesOrder.status === "IN_PROGRESS" || o.salesOrder.status === "RECEIVED"
                ).length ?? 0}
                <span className="text-sm font-normal ml-1">건</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--warning)]/10">
              <ShoppingCart className="w-6 h-6 text-[var(--warning)]" />
            </div>
          </div>
        </div>

        {/* Total Orders */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">전체 수주</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {salesOrders?.length ?? 0}
                <span className="text-sm font-normal ml-1">건</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--info)]/10">
              <FileText className="w-6 h-6 text-[var(--info)]" />
            </div>
          </div>
        </div>
      </div>

      {/* Product Info & BOM */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Details */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            제품 정보
          </h2>
          <div className="space-y-4">
            {product.description && (
              <div>
                <p className="text-sm text-[var(--text-muted)]">설명</p>
                <p className="text-[var(--text-primary)]">{product.description}</p>
              </div>
            )}

            <div>
              <p className="text-sm text-[var(--text-muted)]">카테고리</p>
              <p className="text-[var(--text-primary)]">{product.category || "-"}</p>
            </div>

            <div>
              <p className="text-sm text-[var(--text-muted)]">단위</p>
              <p className="text-[var(--text-primary)]">{product.unit}</p>
            </div>

            <div className="pt-4 border-t border-[var(--glass-border)]">
              <p className="text-sm text-[var(--text-muted)]">등록일</p>
              <p className="text-[var(--text-primary)]">
                {new Date(product.createdAt).toLocaleDateString("ko-KR")}
              </p>
            </div>

            {product.notes && (
              <div>
                <p className="text-sm text-[var(--text-muted)]">비고</p>
                <p className="text-[var(--text-secondary)]">{product.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* BOM List */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              BOM (자재명세서)
            </h2>
            <span className="text-sm text-[var(--text-muted)]">
              {product.bomItems.length}개 항목
            </span>
          </div>

          {product.bomItems.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <Layers className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>등록된 BOM 항목이 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-bordered">
                <thead>
                  <tr className="border-b border-[var(--glass-border)]">
                    <th className="text-left px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      파츠코드
                    </th>
                    <th className="text-left px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      파츠명
                    </th>
                    <th className="text-right px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      수량
                    </th>
                    <th className="text-right px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      로스율
                    </th>
                    <th className="text-right px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      단가
                    </th>
                    <th className="text-right px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      소계
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {product.bomItems.map((item) => {
                    const effectiveQty = item.quantityPerUnit * (1 + (item.lossRate || 0));
                    const subtotal = effectiveQty * item.part.unitPrice;
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-[var(--glass-border)] hover:bg-[var(--glass-bg)]/50"
                      >
                        <td className="px-3 py-3">
                          <Link
                            href={`/parts/${item.part.id}`}
                            className="font-mono text-sm text-[var(--primary)] hover:underline"
                          >
                            {item.part.partCode}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-[var(--text-primary)]">
                          {item.part.partName}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {item.quantityPerUnit}
                          <span className="text-[var(--text-muted)] ml-1">
                            {item.part.unit}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-[var(--text-secondary)] tabular-nums">
                          {item.lossRate ? `${(item.lossRate * 100).toFixed(1)}%` : "-"}
                        </td>
                        <td className="px-3 py-3 text-right text-[var(--text-secondary)] tabular-nums">
                          ₩{item.part.unitPrice.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right font-medium tabular-nums">
                          ₩{subtotal.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[var(--glass-bg)]">
                    <td colSpan={5} className="px-3 py-3 text-right font-medium">
                      합계
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-[var(--primary)] tabular-nums">
                      ₩{totalBomCost.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Sales Orders History */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            수주 기록
          </h2>
          <Link
            href="/sales-orders"
            className="text-sm text-[var(--primary)] hover:underline"
          >
            전체 보기
          </Link>
        </div>

        {ordersLoading ? (
          <div className="flex items-center justify-center h-32">
            <div
              className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"
              role="status"
            />
          </div>
        ) : !salesOrders || salesOrders.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-muted)]">
            <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>수주 기록이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-bordered">
              <thead>
                <tr className="border-b border-[var(--glass-border)]">
                  <th className="text-left px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                    수주번호
                  </th>
                  <th className="text-left px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                    프로젝트
                  </th>
                  <th className="text-right px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                    수주량
                  </th>
                  <th className="text-right px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                    생산량
                  </th>
                  <th className="text-center px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                    상태
                  </th>
                  <th className="text-left px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                    납기일
                  </th>
                  <th className="text-left px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                    수주일
                  </th>
                </tr>
              </thead>
              <tbody>
                {salesOrders.slice(0, 10).map((item) => {
                  const Icon = statusIcons[item.salesOrder.status] || FileText;
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-[var(--glass-border)] hover:bg-[var(--glass-bg)]/50"
                    >
                      <td className="px-3 py-3">
                        <Link
                          href={`/sales-orders/${item.salesOrder.id}`}
                          className="font-mono text-sm text-[var(--primary)] hover:underline"
                        >
                          {item.salesOrder.orderCode}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-[var(--text-primary)]">
                        {item.salesOrder.project || "-"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {item.orderQty}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        <span
                          className={
                            item.producedQty >= item.orderQty
                              ? "text-[var(--success)]"
                              : "text-[var(--text-primary)]"
                          }
                        >
                          {item.producedQty}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`badge ${
                            statusColors[item.salesOrder.status] || "badge-secondary"
                          } flex items-center gap-1 w-fit mx-auto`}
                        >
                          <Icon className="w-3 h-3" />
                          {statusLabels[item.salesOrder.status] || item.salesOrder.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[var(--text-secondary)]">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {item.salesOrder.dueDate
                            ? new Date(item.salesOrder.dueDate).toLocaleDateString("ko-KR")
                            : "-"}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm text-[var(--text-muted)]">
                        {new Date(item.salesOrder.orderDate).toLocaleDateString("ko-KR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

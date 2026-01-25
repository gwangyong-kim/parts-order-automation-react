// Common chart utilities for report visualizations

// Color palette matching the design system
export const CHART_COLORS = {
  primary: "#1e5eff",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
  purple: "#8b5cf6",
  pink: "#ec4899",
  teal: "#14b8a6",
};

// Extended palette for multi-series charts
export const COLOR_PALETTE = [
  "#6366f1", // indigo
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
];

// Order status colors
export const ORDER_STATUS_COLORS: Record<string, string> = {
  DRAFT: "#94a3b8",      // gray
  SUBMITTED: "#3b82f6",  // blue
  APPROVED: "#22c55e",   // green
  ORDERED: "#f59e0b",    // amber
  RECEIVED: "#6366f1",   // indigo
  CANCELLED: "#ef4444",  // red
};

// Sales order status colors
export const SALES_STATUS_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",       // amber
  CONFIRMED: "#3b82f6",     // blue
  IN_PRODUCTION: "#8b5cf6", // purple
  COMPLETED: "#22c55e",     // green
  CANCELLED: "#ef4444",     // red
};

// Common tooltip style
export const TOOLTIP_STYLE = {
  backgroundColor: "var(--glass-bg)",
  border: "1px solid var(--glass-border)",
  borderRadius: "12px",
  backdropFilter: "blur(20px)",
  color: "var(--text-primary)",
};

// Korean status labels
export const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: "작성중",
  SUBMITTED: "제출됨",
  APPROVED: "승인됨",
  ORDERED: "발주됨",
  RECEIVED: "입고완료",
  CANCELLED: "취소됨",
};

export const SALES_STATUS_LABELS: Record<string, string> = {
  PENDING: "대기중",
  CONFIRMED: "확정",
  IN_PRODUCTION: "생산중",
  COMPLETED: "완료",
  CANCELLED: "취소",
};

// Number formatters
export function formatNumber(value: number): string {
  return value.toLocaleString("ko-KR");
}

export function formatCurrency(value: number): string {
  return value.toLocaleString("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  });
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// Date formatter for chart labels
export function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatMonthLabel(monthStr: string): string {
  const [, month] = monthStr.split("-");
  return `${parseInt(month)}월`;
}

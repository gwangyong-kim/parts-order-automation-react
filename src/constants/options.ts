/**
 * Options Constants
 *
 * 공통 옵션 상수 정의 (단위, 카테고리 등)
 */

// ==================== 단위 옵션 ====================

export const UNIT_OPTIONS = [
  { value: "EA", label: "EA (개)" },
  { value: "BOX", label: "BOX (박스)" },
  { value: "SET", label: "SET (세트)" },
  { value: "KG", label: "KG (킬로그램)" },
  { value: "G", label: "G (그램)" },
  { value: "L", label: "L (리터)" },
  { value: "ML", label: "ML (밀리리터)" },
  { value: "M", label: "M (미터)" },
  { value: "CM", label: "CM (센티미터)" },
  { value: "MM", label: "MM (밀리미터)" },
  { value: "ROLL", label: "ROLL (롤)" },
  { value: "SHEET", label: "SHEET (장)" },
  { value: "PAIR", label: "PAIR (쌍)" },
  { value: "PKG", label: "PKG (패키지)" },
] as const;

export type UnitValue = (typeof UNIT_OPTIONS)[number]["value"];

// ==================== 결제 조건 옵션 ====================

export const PAYMENT_TERMS_OPTIONS = [
  { value: "CASH", label: "현금" },
  { value: "NET30", label: "30일 후 결제" },
  { value: "NET60", label: "60일 후 결제" },
  { value: "NET90", label: "90일 후 결제" },
  { value: "COD", label: "착불" },
  { value: "PREPAID", label: "선불" },
] as const;

export type PaymentTermsValue = (typeof PAYMENT_TERMS_OPTIONS)[number]["value"];

// ==================== 불일치 원인 분류 ====================

export const DISCREPANCY_CAUSE_OPTIONS = [
  { value: "COUNTING_ERROR", label: "실사 오류" },
  { value: "SYSTEM_ERROR", label: "시스템 오류" },
  { value: "THEFT", label: "도난/분실" },
  { value: "DAMAGE", label: "파손/훼손" },
  { value: "UNREPORTED_MOVEMENT", label: "미신고 이동" },
  { value: "RECEIVING_ERROR", label: "입고 오류" },
  { value: "SHIPPING_ERROR", label: "출고 오류" },
  { value: "OTHER", label: "기타" },
] as const;

export type DiscrepancyCauseValue = (typeof DISCREPANCY_CAUSE_OPTIONS)[number]["value"];

// ==================== 참조 유형 옵션 ====================

export const REFERENCE_TYPE_OPTIONS = [
  { value: "ORDER", label: "발주" },
  { value: "SALES_ORDER", label: "수주" },
  { value: "AUDIT", label: "실사" },
  { value: "RETURN", label: "반품" },
  { value: "ADJUSTMENT", label: "조정" },
  { value: "MANUAL", label: "수동" },
] as const;

export type ReferenceTypeValue = (typeof REFERENCE_TYPE_OPTIONS)[number]["value"];

// ==================== 동기화 유형 옵션 ====================

export const SYNC_TYPE_OPTIONS = [
  { value: "SALES_ORDER", label: "수주" },
  { value: "PARTS", label: "파츠" },
  { value: "INVENTORY", label: "재고" },
] as const;

export type SyncTypeValue = (typeof SYNC_TYPE_OPTIONS)[number]["value"];

// ==================== 리포트 유형 ====================

export const REPORT_TYPE_OPTIONS = [
  { value: "INVENTORY_SUMMARY", label: "재고 현황", icon: "Package" },
  { value: "LOW_STOCK", label: "저재고 현황", icon: "AlertTriangle" },
  { value: "TRANSACTION_HISTORY", label: "입출고 내역", icon: "ArrowLeftRight" },
  { value: "ORDER_SUMMARY", label: "발주 현황", icon: "ShoppingCart" },
  { value: "SUPPLIER_PERFORMANCE", label: "공급업체 분석", icon: "Truck" },
  { value: "MRP_ANALYSIS", label: "MRP 분석", icon: "Calculator" },
  { value: "AUDIT_RESULT", label: "실사 결과", icon: "ClipboardCheck" },
  { value: "DISCREPANCY", label: "불일치 분석", icon: "AlertCircle" },
] as const;

export type ReportTypeValue = (typeof REPORT_TYPE_OPTIONS)[number]["value"];

// ==================== 테마 옵션 ====================

export const THEME_OPTIONS = [
  { value: "glassmorphism", label: "Glassmorphism" },
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
  { value: "system", label: "시스템 설정" },
] as const;

export type ThemeValue = (typeof THEME_OPTIONS)[number]["value"];

// ==================== 기본값 ====================

export const DEFAULTS = {
  UNIT: "EA",
  SAFETY_STOCK: 0,
  MIN_ORDER_QTY: 1,
  LEAD_TIME_DAYS: 7,
  LOSS_RATE: 0,
  PAGE_SIZE: 20,
  ITEMS_PER_PAGE: [10, 20, 50, 100],
} as const;

// ==================== 날짜 형식 ====================

export const DATE_FORMAT = {
  DISPLAY: "yyyy-MM-dd",
  DISPLAY_WITH_TIME: "yyyy-MM-dd HH:mm",
  DISPLAY_FULL: "yyyy년 MM월 dd일",
  DISPLAY_SHORT: "MM/dd",
  API: "yyyy-MM-dd",
  API_WITH_TIME: "yyyy-MM-dd'T'HH:mm:ss",
} as const;

// ==================== 통화 형식 ====================

export const CURRENCY = {
  CODE: "KRW",
  SYMBOL: "₩",
  LOCALE: "ko-KR",
} as const;

// ==================== 헬퍼 함수 ====================

/**
 * 옵션 배열에서 값으로 레이블 조회
 */
export function getOptionLabel<T extends readonly { value: string; label: string }[]>(
  options: T,
  value: string
): string {
  const option = options.find((opt) => opt.value === value);
  return option?.label || value;
}

/**
 * 통화 형식으로 숫자 포맷팅
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(CURRENCY.LOCALE, {
    style: "currency",
    currency: CURRENCY.CODE,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * 숫자 형식으로 포맷팅
 */
export function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(CURRENCY.LOCALE, {
    maximumFractionDigits,
  }).format(value);
}

/**
 * 날짜 형식으로 포맷팅
 */
export function formatDate(date: string | Date, includeTime = false): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(CURRENCY.LOCALE, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(includeTime && { hour: "2-digit", minute: "2-digit" }),
  });
}

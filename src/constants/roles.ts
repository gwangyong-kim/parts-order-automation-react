/**
 * Role Constants
 *
 * 사용자 역할 및 권한 관련 상수 정의
 */

// ==================== 사용자 역할 ====================

export const USER_ROLE = {
  ADMIN: { value: "ADMIN", label: "관리자", level: 4 },
  MANAGER: { value: "MANAGER", label: "매니저", level: 3 },
  OPERATOR: { value: "OPERATOR", label: "운영자", level: 2 },
  VIEWER: { value: "VIEWER", label: "조회자", level: 1 },
} as const;

export const userRoleOptions = Object.values(USER_ROLE);

export type UserRoleValue = keyof typeof USER_ROLE;

// ==================== 리소스 ====================

export const RESOURCE = {
  PARTS: "parts",
  PRODUCTS: "products",
  SUPPLIERS: "suppliers",
  CATEGORIES: "categories",
  ORDERS: "orders",
  SALES_ORDERS: "sales_orders",
  INVENTORY: "inventory",
  TRANSACTIONS: "transactions",
  MRP: "mrp",
  AUDIT: "audit",
  REPORTS: "reports",
  USERS: "users",
  SETTINGS: "settings",
} as const;

export type ResourceValue = (typeof RESOURCE)[keyof typeof RESOURCE];

// ==================== 액션 ====================

export const ACTION = {
  VIEW: "view",
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  APPROVE: "approve",
  EXPORT: "export",
  IMPORT: "import",
} as const;

export type ActionValue = (typeof ACTION)[keyof typeof ACTION];

// ==================== 기본 권한 매핑 ====================

export const DEFAULT_PERMISSIONS: Record<UserRoleValue, Record<ResourceValue, ActionValue[]>> = {
  ADMIN: {
    [RESOURCE.PARTS]: ["view", "create", "update", "delete", "export", "import"],
    [RESOURCE.PRODUCTS]: ["view", "create", "update", "delete", "export", "import"],
    [RESOURCE.SUPPLIERS]: ["view", "create", "update", "delete", "export", "import"],
    [RESOURCE.CATEGORIES]: ["view", "create", "update", "delete"],
    [RESOURCE.ORDERS]: ["view", "create", "update", "delete", "approve", "export"],
    [RESOURCE.SALES_ORDERS]: ["view", "create", "update", "delete", "export", "import"],
    [RESOURCE.INVENTORY]: ["view", "update", "export"],
    [RESOURCE.TRANSACTIONS]: ["view", "create", "export"],
    [RESOURCE.MRP]: ["view", "create", "export"],
    [RESOURCE.AUDIT]: ["view", "create", "update", "approve", "export"],
    [RESOURCE.REPORTS]: ["view", "export"],
    [RESOURCE.USERS]: ["view", "create", "update", "delete"],
    [RESOURCE.SETTINGS]: ["view", "update"],
  },
  MANAGER: {
    [RESOURCE.PARTS]: ["view", "create", "update", "export", "import"],
    [RESOURCE.PRODUCTS]: ["view", "create", "update", "export", "import"],
    [RESOURCE.SUPPLIERS]: ["view", "create", "update", "export"],
    [RESOURCE.CATEGORIES]: ["view", "create", "update"],
    [RESOURCE.ORDERS]: ["view", "create", "update", "approve", "export"],
    [RESOURCE.SALES_ORDERS]: ["view", "create", "update", "export", "import"],
    [RESOURCE.INVENTORY]: ["view", "update", "export"],
    [RESOURCE.TRANSACTIONS]: ["view", "create", "export"],
    [RESOURCE.MRP]: ["view", "create", "export"],
    [RESOURCE.AUDIT]: ["view", "create", "update", "export"],
    [RESOURCE.REPORTS]: ["view", "export"],
    [RESOURCE.USERS]: ["view"],
    [RESOURCE.SETTINGS]: ["view"],
  },
  OPERATOR: {
    [RESOURCE.PARTS]: ["view", "create", "update"],
    [RESOURCE.PRODUCTS]: ["view", "create", "update"],
    [RESOURCE.SUPPLIERS]: ["view"],
    [RESOURCE.CATEGORIES]: ["view"],
    [RESOURCE.ORDERS]: ["view", "create", "update"],
    [RESOURCE.SALES_ORDERS]: ["view", "create", "update"],
    [RESOURCE.INVENTORY]: ["view", "update"],
    [RESOURCE.TRANSACTIONS]: ["view", "create"],
    [RESOURCE.MRP]: ["view"],
    [RESOURCE.AUDIT]: ["view", "create", "update"],
    [RESOURCE.REPORTS]: ["view"],
    [RESOURCE.USERS]: [],
    [RESOURCE.SETTINGS]: [],
  },
  VIEWER: {
    [RESOURCE.PARTS]: ["view"],
    [RESOURCE.PRODUCTS]: ["view"],
    [RESOURCE.SUPPLIERS]: ["view"],
    [RESOURCE.CATEGORIES]: ["view"],
    [RESOURCE.ORDERS]: ["view"],
    [RESOURCE.SALES_ORDERS]: ["view"],
    [RESOURCE.INVENTORY]: ["view"],
    [RESOURCE.TRANSACTIONS]: ["view"],
    [RESOURCE.MRP]: ["view"],
    [RESOURCE.AUDIT]: ["view"],
    [RESOURCE.REPORTS]: ["view"],
    [RESOURCE.USERS]: [],
    [RESOURCE.SETTINGS]: [],
  },
};

// ==================== 헬퍼 함수 ====================

/**
 * 역할이 특정 리소스에 대한 액션을 수행할 수 있는지 확인
 */
export function hasPermission(
  role: UserRoleValue,
  resource: ResourceValue,
  action: ActionValue
): boolean {
  const permissions = DEFAULT_PERMISSIONS[role]?.[resource];
  return permissions?.includes(action) ?? false;
}

/**
 * 역할의 레벨 조회
 */
export function getRoleLevel(role: UserRoleValue): number {
  return USER_ROLE[role]?.level ?? 0;
}

/**
 * 역할 A가 역할 B보다 높은지 확인
 */
export function isRoleHigherOrEqual(roleA: UserRoleValue, roleB: UserRoleValue): boolean {
  return getRoleLevel(roleA) >= getRoleLevel(roleB);
}

/**
 * 역할의 레이블 조회
 */
export function getRoleLabel(role: string): string {
  const roleInfo = USER_ROLE[role as UserRoleValue];
  return roleInfo?.label || role;
}

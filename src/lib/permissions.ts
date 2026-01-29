/**
 * Role-Based Access Control (RBAC) Permissions
 *
 * 역할별 권한 매트릭스 정의
 */

export type Role = "ADMIN" | "MANAGER" | "OPERATOR" | "VIEWER";

export type Resource =
  | "dashboard"
  | "sales-orders"
  | "orders"
  | "inventory"
  | "mrp"
  | "master-data"
  | "warehouse"
  | "reports"
  | "settings"
  | "users"
  | "backup";

export type Action = "view" | "create" | "edit" | "delete" | "export" | "import";

// 역할별 권한 매트릭스
export const ROLE_PERMISSIONS: Record<Role, Record<Resource, Action[]>> = {
  ADMIN: {
    "dashboard": ["view"],
    "sales-orders": ["view", "create", "edit", "delete", "export", "import"],
    "orders": ["view", "create", "edit", "delete", "export", "import"],
    "inventory": ["view", "create", "edit", "delete", "export", "import"],
    "mrp": ["view", "create", "edit", "delete", "export"],
    "master-data": ["view", "create", "edit", "delete", "export", "import"],
    "warehouse": ["view", "create", "edit", "delete", "export"],
    "reports": ["view", "export"],
    "settings": ["view", "edit"],
    "users": ["view", "create", "edit", "delete"],
    "backup": ["view", "create", "delete"],
  },
  MANAGER: {
    "dashboard": ["view"],
    "sales-orders": ["view", "create", "edit", "delete", "export", "import"],
    "orders": ["view", "create", "edit", "delete", "export", "import"],
    "inventory": ["view", "create", "edit", "delete", "export", "import"],
    "mrp": ["view", "create", "edit", "export"],
    "master-data": ["view", "create", "edit", "delete", "export", "import"],
    "warehouse": ["view", "create", "edit", "delete", "export"],
    "reports": ["view", "export"],
    "settings": ["view", "edit"],
    "users": ["view"],
    "backup": ["view", "create"],
  },
  OPERATOR: {
    "dashboard": ["view"],
    "sales-orders": ["view", "create", "edit", "export"],
    "orders": ["view", "create", "edit", "export"],
    "inventory": ["view", "edit", "export"],
    "mrp": ["view", "export"],
    "master-data": ["view", "export"],
    "warehouse": ["view", "edit"],
    "reports": ["view", "export"],
    "settings": ["view"],
    "users": [],
    "backup": [],
  },
  VIEWER: {
    "dashboard": ["view"],
    "sales-orders": ["view"],
    "orders": ["view"],
    "inventory": ["view"],
    "mrp": ["view"],
    "master-data": ["view"],
    "warehouse": ["view"],
    "reports": ["view"],
    "settings": ["view"],
    "users": [],
    "backup": [],
  },
};

// 역할 설명
export const ROLE_DESCRIPTIONS: Record<Role, { name: string; description: string }> = {
  ADMIN: {
    name: "관리자",
    description: "시스템의 모든 기능에 접근 가능. 사용자 관리, 백업, 시스템 설정 포함.",
  },
  MANAGER: {
    name: "매니저",
    description: "대부분의 업무 기능 사용 가능. 사용자 삭제 및 일부 시스템 설정 제한.",
  },
  OPERATOR: {
    name: "운영자",
    description: "일상적인 업무 처리 가능. 수주, 발주, 재고 관리 등 운영 업무 담당.",
  },
  VIEWER: {
    name: "뷰어",
    description: "데이터 조회만 가능. 수정, 삭제, 생성 권한 없음.",
  },
};

// 권한 확인 함수
export function hasPermission(role: Role, resource: Resource, action: Action): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;

  const resourcePermissions = permissions[resource];
  if (!resourcePermissions) return false;

  return resourcePermissions.includes(action);
}

// 리소스에 대한 모든 권한 확인
export function getPermissions(role: Role, resource: Resource): Action[] {
  return ROLE_PERMISSIONS[role]?.[resource] || [];
}

// 역할 계층 확인
export function getRoleLevel(role: Role): number {
  const levels: Record<Role, number> = {
    ADMIN: 4,
    MANAGER: 3,
    OPERATOR: 2,
    VIEWER: 1,
  };
  return levels[role] || 0;
}

// 특정 레벨 이상인지 확인
export function hasMinRole(userRole: Role, minRole: Role): boolean {
  return getRoleLevel(userRole) >= getRoleLevel(minRole);
}

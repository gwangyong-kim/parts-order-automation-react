"use client";

import { useSession } from "next-auth/react";
import {
  Role,
  Resource,
  Action,
  hasPermission,
  getPermissions,
  hasMinRole as checkMinRole,
  ROLE_DESCRIPTIONS,
} from "@/lib/permissions";

/**
 * 권한 체크 훅
 *
 * 세션이 로딩 중이거나 없으면 모든 권한을 거부합니다.
 * 이는 SSR 하이드레이션 시 권한이 있는 것처럼 표시되는 문제를 방지합니다.
 */
export function usePermission() {
  const { data: session, status } = useSession();

  // 세션이 로딩 중이거나 인증되지 않으면 권한 없음
  const isAuthenticated = status === "authenticated" && !!session?.user?.role;
  const userRole = isAuthenticated ? (session.user.role as Role) : null;

  return {
    role: userRole,
    roleInfo: userRole ? ROLE_DESCRIPTIONS[userRole] : null,
    isLoading: status === "loading",
    isAuthenticated,

    // 특정 리소스/액션 권한 확인 - 인증되지 않으면 항상 false
    can: (resource: Resource, action: Action): boolean => {
      if (!isAuthenticated || !userRole) return false;
      return hasPermission(userRole, resource, action);
    },

    // 리소스에 대한 모든 권한 가져오기
    getPermissionsFor: (resource: Resource): Action[] => {
      if (!isAuthenticated || !userRole) return [];
      return getPermissions(userRole, resource);
    },

    // 최소 역할 확인
    hasMinRole: (minRole: Role): boolean => {
      if (!isAuthenticated || !userRole) return false;
      return checkMinRole(userRole, minRole);
    },

    // 역할별 빠른 체크
    isAdmin: userRole === "ADMIN",
    isManager: userRole === "MANAGER",
    isOperator: userRole === "OPERATOR",
    isViewer: userRole === "VIEWER",

    // 관리 권한 확인 (ADMIN, MANAGER)
    hasAdminAccess: isAuthenticated && userRole ? ["ADMIN", "MANAGER"].includes(userRole) : false,

    // 운영 권한 확인 (ADMIN, MANAGER, OPERATOR)
    hasOperatorAccess: isAuthenticated && userRole ? ["ADMIN", "MANAGER", "OPERATOR"].includes(userRole) : false,
  };
}

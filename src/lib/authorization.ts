/**
 * Authorization Utility
 *
 * RBAC (Role-Based Access Control) 유틸리티
 */

import { auth } from "@/lib/auth";
import { unauthorized, forbidden } from "@/lib/api-error";
import type { Session } from "next-auth";

export type Role = "ADMIN" | "MANAGER" | "OPERATOR" | "VIEWER";

const ROLE_HIERARCHY: Record<Role, number> = {
  ADMIN: 4,
  MANAGER: 3,
  OPERATOR: 2,
  VIEWER: 1,
};

interface AuthResult {
  session: Session;
  error?: never;
}

interface AuthError {
  session?: never;
  error: ReturnType<typeof unauthorized> | ReturnType<typeof forbidden>;
}

type AuthResponse = AuthResult | AuthError;

/**
 * 인증된 사용자인지 확인
 * @returns session 또는 error
 */
export async function requireAuth(): Promise<AuthResponse> {
  const session = await auth();
  if (!session?.user) {
    return { error: unauthorized() };
  }
  return { session };
}

/**
 * 특정 역할이 필요한지 확인
 * @param allowedRoles 허용된 역할 목록
 * @returns session 또는 error
 */
export async function requireRole(allowedRoles: Role[]): Promise<AuthResponse> {
  const result = await requireAuth();
  if ("error" in result) return result;

  const userRole = result.session.user.role as Role;
  if (!allowedRoles.includes(userRole)) {
    return { error: forbidden("권한이 없습니다.") };
  }
  return result;
}

/**
 * 최소 역할 레벨 확인
 * @param minRole 최소 필요 역할
 * @returns session 또는 error
 */
export async function requireMinRole(minRole: Role): Promise<AuthResponse> {
  const result = await requireAuth();
  if ("error" in result) return result;

  const userRole = result.session.user.role as Role;
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const minLevel = ROLE_HIERARCHY[minRole];

  if (userLevel < minLevel) {
    return { error: forbidden("권한이 없습니다.") };
  }
  return result;
}

/**
 * 관리자 권한 확인 (ADMIN, MANAGER)
 */
export async function requireAdmin(): Promise<AuthResponse> {
  return requireRole(["ADMIN", "MANAGER"]);
}

/**
 * 운영자 이상 권한 확인 (ADMIN, MANAGER, OPERATOR)
 */
export async function requireOperator(): Promise<AuthResponse> {
  return requireRole(["ADMIN", "MANAGER", "OPERATOR"]);
}

/**
 * 역할 확인 헬퍼 함수
 */
export function isAdmin(role: string): boolean {
  return role === "ADMIN";
}

export function isManager(role: string): boolean {
  return role === "MANAGER";
}

export function isOperator(role: string): boolean {
  return role === "OPERATOR";
}

export function isViewer(role: string): boolean {
  return role === "VIEWER";
}

export function hasAdminAccess(role: string): boolean {
  return ["ADMIN", "MANAGER"].includes(role);
}

export function hasOperatorAccess(role: string): boolean {
  return ["ADMIN", "MANAGER", "OPERATOR"].includes(role);
}

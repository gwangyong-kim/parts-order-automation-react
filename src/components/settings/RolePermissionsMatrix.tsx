"use client";

import { Check, X, Shield } from "lucide-react";
import {
  Role,
  Resource,
  Action,
  ROLE_PERMISSIONS,
  ROLE_DESCRIPTIONS,
} from "@/lib/permissions";

const RESOURCE_LABELS: Record<Resource, string> = {
  "dashboard": "대시보드",
  "sales-orders": "수주 관리",
  "orders": "발주 관리",
  "inventory": "재고 관리",
  "mrp": "MRP",
  "master-data": "마스터 데이터",
  "warehouse": "창고 관리",
  "reports": "보고서",
  "settings": "설정",
  "users": "사용자 관리",
  "backup": "백업 관리",
};

const ACTION_LABELS: Record<Action, string> = {
  view: "조회",
  create: "생성",
  edit: "수정",
  delete: "삭제",
  export: "내보내기",
  import: "가져오기",
};

const ROLE_COLORS: Record<Role, string> = {
  ADMIN: "bg-red-100 text-red-700 border-red-200",
  MANAGER: "bg-orange-100 text-orange-700 border-orange-200",
  OPERATOR: "bg-blue-100 text-blue-700 border-blue-200",
  VIEWER: "bg-gray-100 text-gray-700 border-gray-200",
};

export default function RolePermissionsMatrix() {
  const roles: Role[] = ["ADMIN", "MANAGER", "OPERATOR", "VIEWER"];
  const resources: Resource[] = [
    "dashboard",
    "sales-orders",
    "orders",
    "inventory",
    "mrp",
    "master-data",
    "warehouse",
    "reports",
    "settings",
    "users",
    "backup",
  ];
  const actions: Action[] = ["view", "create", "edit", "delete", "export", "import"];

  const hasPermission = (role: Role, resource: Resource, action: Action): boolean => {
    return ROLE_PERMISSIONS[role]?.[resource]?.includes(action) || false;
  };

  return (
    <div className="space-y-6">
      {/* Role Descriptions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {roles.map((role) => (
          <div
            key={role}
            className={`p-4 rounded-xl border-2 ${ROLE_COLORS[role]}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5" />
              <h3 className="font-bold">{ROLE_DESCRIPTIONS[role].name}</h3>
            </div>
            <p className="text-sm opacity-80">{ROLE_DESCRIPTIONS[role].description}</p>
          </div>
        ))}
      </div>

      {/* Permissions Matrix */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-[var(--glass-border)]">
          <h3 className="font-semibold text-[var(--text-primary)]">역할별 권한 매트릭스</h3>
          <p className="text-sm text-[var(--text-muted)]">각 역할이 사용할 수 있는 기능을 확인합니다.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--glass-bg)]">
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--glass-border)] sticky left-0 bg-[var(--glass-bg)] z-10">
                  리소스 / 액션
                </th>
                {roles.map((role) => (
                  <th
                    key={role}
                    colSpan={actions.length}
                    className="px-2 py-3 text-center text-sm font-semibold border-b border-l border-[var(--glass-border)]"
                  >
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${ROLE_COLORS[role]}`}>
                      <Shield className="w-3 h-3" />
                      {ROLE_DESCRIPTIONS[role].name}
                    </span>
                  </th>
                ))}
              </tr>
              <tr className="bg-[var(--glass-bg)]">
                <th className="px-4 py-2 text-left text-xs font-medium text-[var(--text-muted)] border-b border-[var(--glass-border)] sticky left-0 bg-[var(--glass-bg)] z-10">
                  &nbsp;
                </th>
                {roles.map((role) =>
                  actions.map((action) => (
                    <th
                      key={`${role}-${action}`}
                      className="px-1 py-2 text-center text-xs font-medium text-[var(--text-muted)] border-b border-[var(--glass-border)] whitespace-nowrap"
                    >
                      {ACTION_LABELS[action]}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {resources.map((resource, idx) => (
                <tr
                  key={resource}
                  className={idx % 2 === 0 ? "bg-white" : "bg-[var(--glass-bg)]/50"}
                >
                  <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)] border-b border-[var(--glass-border)] sticky left-0 bg-inherit z-10">
                    {RESOURCE_LABELS[resource]}
                  </td>
                  {roles.map((role) =>
                    actions.map((action) => (
                      <td
                        key={`${role}-${resource}-${action}`}
                        className="px-1 py-3 text-center border-b border-[var(--glass-border)]"
                      >
                        {hasPermission(role, resource, action) ? (
                          <Check className="w-4 h-4 text-[var(--success)] mx-auto" />
                        ) : (
                          <X className="w-4 h-4 text-[var(--gray-300)] mx-auto" />
                        )}
                      </td>
                    ))
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Default Accounts Info */}
      <div className="glass-card p-4">
        <h3 className="font-semibold text-[var(--text-primary)] mb-3">기본 테스트 계정</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { role: "ADMIN", username: "admin", password: "admin123" },
            { role: "MANAGER", username: "manager", password: "manager123" },
            { role: "OPERATOR", username: "operator", password: "operator123" },
            { role: "VIEWER", username: "viewer", password: "viewer123" },
          ].map((account) => (
            <div
              key={account.role}
              className="p-3 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]"
            >
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs mb-2 ${ROLE_COLORS[account.role as Role]}`}>
                {ROLE_DESCRIPTIONS[account.role as Role].name}
              </span>
              <p className="text-sm">
                <span className="text-[var(--text-muted)]">ID:</span>{" "}
                <code className="bg-[var(--gray-100)] px-1 rounded">{account.username}</code>
              </p>
              <p className="text-sm">
                <span className="text-[var(--text-muted)]">PW:</span>{" "}
                <code className="bg-[var(--gray-100)] px-1 rounded">{account.password}</code>
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-3">
          * 테스트 계정은 개발 환경에서만 사용하세요. 프로덕션 환경에서는 비밀번호를 변경하거나 계정을 삭제하세요.
        </p>
      </div>
    </div>
  );
}

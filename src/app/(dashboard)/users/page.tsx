"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Plus,
  Search,
  Filter,
  Download,
  Edit2,
  Trash2,
  Shield,
  Mail,
  Calendar,
  CheckCircle,
  XCircle,
  ChevronDown,
  KeyRound,
} from "lucide-react";
import UserForm from "@/components/forms/UserForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import RolePermissionsMatrix from "@/components/settings/RolePermissionsMatrix";
import { usePermission } from "@/hooks/usePermission";

interface User {
  id: number;
  username: string;
  name: string;
  email: string | null;
  role: string;
  department: string | null;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
}

interface UsersResponse {
  data: User[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

async function fetchUsers(): Promise<User[]> {
  const res = await fetch("/api/users?pageSize=1000");
  if (!res.ok) throw new Error("Failed to fetch users");
  const result: UsersResponse = await res.json();
  return result.data;
}

async function createUser(data: Partial<User>): Promise<User> {
  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to create user");
  }
  return res.json();
}

async function updateUser(id: number, data: Partial<User>): Promise<User> {
  const res = await fetch(`/api/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to update user");
  }
  return res.json();
}

async function deleteUser(id: number): Promise<void> {
  const res = await fetch(`/api/users/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete user");
}

const roleColors: Record<string, string> = {
  ADMIN: "badge-danger",
  MANAGER: "badge-warning",
  OPERATOR: "badge-info",
  VIEWER: "badge-secondary",
};

const roleLabels: Record<string, string> = {
  ADMIN: "관리자",
  MANAGER: "매니저",
  OPERATOR: "운영자",
  VIEWER: "조회자",
};

type TabType = "users" | "permissions";

export default function UsersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can } = usePermission();
  const [activeTab, setActiveTab] = useState<TabType>("users");
  const [searchTerm, setSearchTerm] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const filterRef = useRef<HTMLDivElement>(null);

  const { data: users, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExport = () => {
    if (!filteredUsers || filteredUsers.length === 0) {
      toast.error("내보낼 데이터가 없습니다.");
      return;
    }

    const headers = ["아이디", "이름", "이메일", "역할", "부서", "상태", "마지막 로그인", "등록일"];
    const rows = filteredUsers.map((user) => [
      user.username,
      user.name,
      user.email || "",
      roleLabels[user.role] || user.role,
      user.department || "",
      user.isActive ? "활성" : "비활성",
      user.lastLogin ? new Date(user.lastLogin).toLocaleString("ko-KR") : "",
      new Date(user.createdAt).toLocaleDateString("ko-KR"),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `users_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("파일이 다운로드되었습니다.");
  };

  const clearFilters = () => {
    setFilterRole("all");
    setFilterStatus("all");
    setShowFilterDropdown(false);
  };

  const hasActiveFilters = filterRole !== "all" || filterStatus !== "all";
  const activeFilterCount = (filterRole !== "all" ? 1 : 0) + (filterStatus !== "all" ? 1 : 0);

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("사용자가 추가되었습니다.");
      setShowFormModal(false);
    },
    onError: (error: Error) => {
      if (error.message === "Username already exists") {
        toast.error("이미 사용중인 아이디입니다.");
      } else {
        toast.error("사용자 추가에 실패했습니다.");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<User> }) =>
      updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("사용자가 수정되었습니다.");
      setShowFormModal(false);
      setSelectedUser(null);
    },
    onError: () => {
      toast.error("사용자 수정에 실패했습니다.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("사용자가 비활성화되었습니다.");
      setShowDeleteDialog(false);
      setSelectedUser(null);
    },
    onError: () => {
      toast.error("사용자 삭제에 실패했습니다.");
    },
  });

  const handleCreate = () => {
    setSelectedUser(null);
    setShowFormModal(true);
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setShowFormModal(true);
  };

  const handleDelete = (user: User) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };

  const handleFormSubmit = (data: Partial<User>) => {
    if (selectedUser) {
      updateMutation.mutate({ id: selectedUser.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDeleteConfirm = () => {
    if (selectedUser) {
      deleteMutation.mutate(selectedUser.id);
    }
  };

  const filteredUsers = users?.filter((user) => {
    const matchesSearch =
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === "all" || user.role === filterRole;
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && user.isActive) ||
      (filterStatus === "inactive" && !user.isActive);
    return matchesSearch && matchesRole && matchesStatus;
  });

  // 사용자 관리 권한 체크
  const canViewUsers = can("users", "view");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" role="status" aria-label="로딩 중" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-[var(--danger)]">데이터를 불러오는데 실패했습니다.</p>
      </div>
    );
  }

  // 사용자 관리 권한이 없으면 접근 차단
  if (!canViewUsers) {
    return (
      <div className="glass-card p-6 text-center">
        <Shield className="w-12 h-12 mx-auto mb-4 text-[var(--warning)]" />
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">접근 권한이 없습니다</h2>
        <p className="text-[var(--text-secondary)]">사용자 관리 페이지에 접근하려면 관리자 권한이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-[var(--primary)]" />
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">사용자 관리</h1>
            <p className="text-[var(--text-secondary)]">
              시스템 사용자 계정 및 권한을 관리합니다.
            </p>
          </div>
        </div>
        {activeTab === "users" && can("users", "create") && (
          <button onClick={handleCreate} className="btn btn-primary btn-lg">
            <Plus className="w-5 h-5" />
            사용자 추가
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-[var(--glass-border)]">
        <nav className="-mb-px flex gap-1">
          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "users"
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--gray-300)]"
            }`}
          >
            <Users className="w-4 h-4" />
            사용자 목록
          </button>
          <button
            onClick={() => setActiveTab("permissions")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "permissions"
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--gray-300)]"
            }`}
          >
            <KeyRound className="w-4 h-4" />
            역할별 권한
          </button>
        </nav>
      </div>

      {/* Permissions Tab */}
      {activeTab === "permissions" && <RolePermissionsMatrix />}

      {/* Users Tab */}
      {activeTab === "users" && (
        <>
          {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--primary)]/10 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">전체 사용자</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {users?.length || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--success)]/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-[var(--success)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">활성</p>
              <p className="text-xl font-bold text-[var(--success)]">
                {users?.filter((u) => u.isActive).length || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--danger)]/10 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-[var(--danger)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">비활성</p>
              <p className="text-xl font-bold text-[var(--danger)]">
                {users?.filter((u) => !u.isActive).length || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--warning)]/10 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-[var(--warning)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">관리자</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {users?.filter((u) => u.role === "ADMIN").length || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="이름, 아이디, 이메일로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input input-with-icon w-full"
              autoComplete="off"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className={`btn-secondary ${hasActiveFilters ? "ring-2 ring-[var(--primary-500)] ring-offset-1" : ""}`}
              >
                <Filter className="w-4 h-4" />
                필터
                {hasActiveFilters && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-[var(--primary-500)] text-white rounded-full">
                    {activeFilterCount}
                  </span>
                )}
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilterDropdown ? "rotate-180" : ""}`} />
              </button>

              {showFilterDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-[var(--gray-200)] shadow-lg py-3 z-50 animate-scale-in">
                  <div className="px-4 pb-2 mb-2 border-b border-[var(--gray-100)] flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--gray-900)]">필터</span>
                    {hasActiveFilters && (
                      <button onClick={clearFilters} className="text-xs text-[var(--primary-500)] hover:underline">
                        초기화
                      </button>
                    )}
                  </div>
                  <div className="px-4 py-2">
                    <label className="text-xs font-medium text-[var(--gray-600)] mb-1.5 block">역할</label>
                    <select
                      value={filterRole}
                      onChange={(e) => setFilterRole(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-[var(--gray-300)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
                    >
                      <option value="all">전체</option>
                      <option value="ADMIN">관리자</option>
                      <option value="MANAGER">매니저</option>
                      <option value="OPERATOR">운영자</option>
                      <option value="VIEWER">조회자</option>
                    </select>
                  </div>
                  <div className="px-4 py-2">
                    <label className="text-xs font-medium text-[var(--gray-600)] mb-1.5 block">상태</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as "all" | "active" | "inactive")}
                      className="w-full px-3 py-2 text-sm border border-[var(--gray-300)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
                    >
                      <option value="all">전체</option>
                      <option value="active">활성</option>
                      <option value="inactive">비활성</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <button onClick={handleExport} className="btn-secondary">
              <Download className="w-4 h-4" />
              내보내기
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-bordered">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                <th className="table-header table-col-name-lg">사용자</th>
                <th className="table-header table-col-code">아이디</th>
                <th className="table-header table-col-status">역할</th>
                <th className="table-header table-col-short">부서</th>
                <th className="table-header table-col-status">상태</th>
                <th className="table-header table-col-datetime">마지막 로그인</th>
                <th className="table-header table-col-date">등록일</th>
                <th className="table-header text-center table-col-action">작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-cell text-center py-8">
                    <Users className="w-12 h-12 mx-auto mb-2 text-[var(--text-muted)]" />
                    <p className="text-[var(--text-muted)]">
                      {searchTerm ? "검색 결과가 없습니다." : "사용자가 없습니다."}
                    </p>
                    {!searchTerm && (
                      <button
                        onClick={handleCreate}
                        className="mt-4 text-[var(--primary)] hover:underline"
                      >
                        첫 번째 사용자 추가하기
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredUsers?.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-[var(--glass-border)] hover:bg-[var(--glass-bg)] transition-colors"
                  >
                    <td className="table-cell table-col-name-lg">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-[var(--primary)]/10 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="font-semibold text-[var(--primary)]">
                            {user.name.charAt(0)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-[var(--text-primary)] table-truncate" title={user.name}>{user.name}</p>
                          {user.email && (
                            <p className="text-sm text-[var(--text-muted)] flex items-center gap-1">
                              <Mail className="w-3 h-3 flex-shrink-0" />
                              <span className="table-truncate" title={user.email}>{user.email}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="table-cell font-mono table-col-code">
                      <span className="table-truncate block" title={user.username}>{user.username}</span>
                    </td>
                    <td className="table-cell table-col-status">
                      <span className={`badge ${roleColors[user.role]} flex items-center gap-1 w-fit`}>
                        <Shield className="w-3 h-3" />
                        {roleLabels[user.role]}
                      </span>
                    </td>
                    <td className="table-cell table-col-short">{user.department || "-"}</td>
                    <td className="table-cell table-col-status">
                      {user.isActive ? (
                        <span className="badge badge-success flex items-center gap-1 w-fit">
                          <CheckCircle className="w-3 h-3" />
                          활성
                        </span>
                      ) : (
                        <span className="badge badge-secondary flex items-center gap-1 w-fit">
                          <XCircle className="w-3 h-3" />
                          비활성
                        </span>
                      )}
                    </td>
                    <td className="table-cell text-[var(--text-secondary)] table-col-datetime">
                      {user.lastLogin ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(user.lastLogin).toLocaleString("ko-KR")}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="table-cell text-[var(--text-secondary)] table-col-date">
                      {new Date(user.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="table-cell text-center table-col-action">
                      <div className="flex items-center justify-center gap-1">
                        {can("users", "edit") && (
                          <button
                            onClick={() => handleEdit(user)}
                            className="table-action-btn edit"
                            title="수정"
                            aria-label={`${user.name} 수정`}
                          >
                            <Edit2 className="w-4 h-4 text-[var(--text-secondary)]" />
                          </button>
                        )}
                        {can("users", "delete") && (
                          <button
                            onClick={() => handleDelete(user)}
                            className="table-action-btn delete"
                            title="비활성화"
                            aria-label={`${user.name} 비활성화`}
                          >
                            <Trash2 className="w-4 h-4 text-[var(--text-secondary)]" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

        {/* User Form Modal */}
        <UserForm
          isOpen={showFormModal}
          onClose={() => {
            setShowFormModal(false);
            setSelectedUser(null);
          }}
          onSubmit={handleFormSubmit}
          initialData={selectedUser}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          isOpen={showDeleteDialog}
          onClose={() => {
            setShowDeleteDialog(false);
            setSelectedUser(null);
          }}
          onConfirm={handleDeleteConfirm}
          title="사용자 비활성화"
          message={`"${selectedUser?.name}" 사용자를 비활성화하시겠습니까? 비활성화된 사용자는 로그인할 수 없습니다.`}
          confirmText="비활성화"
          variant="danger"
          isLoading={deleteMutation.isPending}
        />
        </>
      )}
    </div>
  );
}

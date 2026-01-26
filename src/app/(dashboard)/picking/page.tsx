"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ClipboardCheck,
  Play,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Filter,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { PickingTask, PickingTaskStatus, PickingTaskPriority } from "@/types/warehouse";

async function fetchPickingTasks(): Promise<PickingTask[]> {
  const res = await fetch("/api/picking-tasks");
  if (!res.ok) throw new Error("Failed to fetch picking tasks");
  return res.json();
}

async function updateTaskStatus(id: number, status: string): Promise<PickingTask> {
  const res = await fetch(`/api/picking-tasks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update task");
  return res.json();
}

async function deletePickingTask(id: number): Promise<void> {
  const res = await fetch(`/api/picking-tasks/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete task");
}

const statusConfig: Record<PickingTaskStatus, { label: string; color: string; icon: React.ElementType }> = {
  PENDING: { label: "대기", color: "badge-secondary", icon: Clock },
  IN_PROGRESS: { label: "진행중", color: "badge-warning", icon: Play },
  COMPLETED: { label: "완료", color: "badge-success", icon: CheckCircle },
  CANCELLED: { label: "취소", color: "badge-danger", icon: XCircle },
};

const priorityConfig: Record<PickingTaskPriority, { label: string; color: string }> = {
  URGENT: { label: "긴급", color: "text-[var(--danger)] font-bold" },
  HIGH: { label: "높음", color: "text-[var(--warning)]" },
  NORMAL: { label: "보통", color: "text-[var(--text-secondary)]" },
  LOW: { label: "낮음", color: "text-[var(--text-muted)]" },
};

export default function PickingPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<PickingTaskStatus | "all">("all");
  const [deleteTarget, setDeleteTarget] = useState<PickingTask | null>(null);

  const { data: tasks, isLoading, error } = useQuery({
    queryKey: ["picking-tasks"],
    queryFn: fetchPickingTasks,
  });

  const startMutation = useMutation({
    mutationFn: (id: number) => updateTaskStatus(id, "IN_PROGRESS"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["picking-tasks"] });
      toast.success("피킹 작업이 시작되었습니다.");
    },
    onError: () => toast.error("작업 시작에 실패했습니다."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePickingTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["picking-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["active-picking-data"] });
      toast.success("피킹 작업이 삭제되었습니다.");
      setDeleteTarget(null);
    },
    onError: () => toast.error("작업 삭제에 실패했습니다."),
  });

  const filteredTasks = tasks?.filter(
    (task) => statusFilter === "all" || task.status === statusFilter
  );

  // Stats
  const stats = {
    pending: tasks?.filter((t) => t.status === "PENDING").length || 0,
    inProgress: tasks?.filter((t) => t.status === "IN_PROGRESS").length || 0,
    completed: tasks?.filter((t) => t.status === "COMPLETED").length || 0,
    total: tasks?.length || 0,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="w-8 h-8 text-[var(--primary)]" />
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">피킹 작업</h1>
            <p className="text-[var(--text-secondary)]">
              창고 피킹 작업을 관리합니다
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => setStatusFilter("PENDING")}
          className={`glass-card p-4 text-left transition-all ${
            statusFilter === "PENDING" ? "ring-2 ring-[var(--primary)]" : ""
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--gray-200)]">
              <Clock className="w-5 h-5 text-[var(--text-secondary)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">대기</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">{stats.pending}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setStatusFilter("IN_PROGRESS")}
          className={`glass-card p-4 text-left transition-all ${
            statusFilter === "IN_PROGRESS" ? "ring-2 ring-[var(--primary)]" : ""
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--warning)]/10">
              <Play className="w-5 h-5 text-[var(--warning)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">진행중</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">{stats.inProgress}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setStatusFilter("COMPLETED")}
          className={`glass-card p-4 text-left transition-all ${
            statusFilter === "COMPLETED" ? "ring-2 ring-[var(--primary)]" : ""
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--success)]/10">
              <CheckCircle className="w-5 h-5 text-[var(--success)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">완료</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">{stats.completed}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setStatusFilter("all")}
          className={`glass-card p-4 text-left transition-all ${
            statusFilter === "all" ? "ring-2 ring-[var(--primary)]" : ""
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--primary)]/10">
              <ClipboardCheck className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">전체</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">{stats.total}</p>
            </div>
          </div>
        </button>
      </div>

      {/* Task List */}
      <div className="glass-card overflow-hidden">
        {!filteredTasks || filteredTasks.length === 0 ? (
          <div className="p-8 text-center">
            <ClipboardCheck className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)]" />
            <p className="text-[var(--text-muted)]">
              {statusFilter !== "all" ? "해당 상태의 작업이 없습니다." : "피킹 작업이 없습니다."}
            </p>
            <p className="text-sm text-[var(--text-muted)] mt-2">
              수주 페이지에서 피킹 작업을 생성할 수 있습니다.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--glass-border)] bg-[var(--glass-bg)]">
                  <th className="text-left px-6 py-4 text-sm font-semibold text-[var(--text-secondary)]">
                    작업 코드
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-[var(--text-secondary)]">
                    수주
                  </th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-[var(--text-secondary)]">
                    우선순위
                  </th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-[var(--text-secondary)]">
                    진행률
                  </th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-[var(--text-secondary)]">
                    상태
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-[var(--text-secondary)]">
                    담당자
                  </th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-[var(--text-secondary)]">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => {
                  const status = statusConfig[task.status];
                  const priority = priorityConfig[task.priority];
                  const StatusIcon = status.icon;
                  const progress = task.totalItems > 0
                    ? Math.round((task.pickedItems / task.totalItems) * 100)
                    : 0;

                  return (
                    <tr
                      key={task.id}
                      className="border-b border-[var(--glass-border)] hover:bg-[var(--glass-bg)]/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <Link
                          href={`/picking/${task.id}`}
                          className="font-mono text-sm text-[var(--primary)] hover:underline"
                        >
                          {task.taskCode}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        {task.salesOrder ? (
                          <div>
                            <p className="font-medium">{task.salesOrder.orderCode}</p>
                            {task.salesOrder.project && (
                              <p className="text-sm text-[var(--text-muted)]">
                                {task.salesOrder.project}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)]">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={priority.color}>
                          {task.priority === "URGENT" && (
                            <AlertTriangle className="w-4 h-4 inline mr-1" />
                          )}
                          {priority.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-[var(--gray-200)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[var(--primary)] transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-sm text-[var(--text-muted)] w-16 text-right">
                            {task.pickedItems}/{task.totalItems}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`badge ${status.color} inline-flex items-center gap-1`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {task.assignedTo || (
                          <span className="text-[var(--text-muted)]">미배정</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {task.status === "PENDING" && (
                            <button
                              onClick={() => startMutation.mutate(task.id)}
                              className="btn btn-primary btn-sm"
                              disabled={startMutation.isPending}
                            >
                              <Play className="w-4 h-4" />
                              시작
                            </button>
                          )}
                          {task.status === "IN_PROGRESS" && (
                            <Link
                              href={`/picking/${task.id}`}
                              className="btn btn-primary btn-sm"
                            >
                              계속
                            </Link>
                          )}
                          {task.status === "COMPLETED" && (
                            <Link
                              href={`/picking/${task.id}`}
                              className="btn-secondary btn-sm"
                            >
                              상세
                            </Link>
                          )}
                          {/* 삭제 버튼 - 완료되지 않은 작업만 */}
                          {task.status !== "COMPLETED" && (
                            <button
                              onClick={() => setDeleteTarget(task)}
                              className="p-2 text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded-lg transition-colors"
                              title="작업 삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="피킹 작업 삭제"
        message={`피킹 작업 "${deleteTarget?.taskCode}"을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

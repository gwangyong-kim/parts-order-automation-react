"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ClipboardCheck,
  MapPin,
  Package,
  Check,
  SkipForward,
  AlertTriangle,
  CheckCircle,
  Play,
} from "lucide-react";
import WarehouseMap from "@/components/warehouse/WarehouseMap";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import type { PickingTask, PickingItem, WarehouseLayout, PickingItemStatus } from "@/types/warehouse";

async function fetchPickingTask(id: string): Promise<PickingTask> {
  const res = await fetch(`/api/picking-tasks/${id}`);
  if (!res.ok) throw new Error("Failed to fetch picking task");
  return res.json();
}

async function fetchWarehouseLayout(): Promise<WarehouseLayout | null> {
  const res = await fetch("/api/warehouse");
  if (!res.ok) return null;
  const warehouses = await res.json();
  if (warehouses.length === 0) return null;

  const layoutRes = await fetch(`/api/warehouse/${warehouses[0].id}/layout`);
  if (!layoutRes.ok) return null;
  return layoutRes.json();
}

async function updatePickingItem(
  id: number,
  data: { action?: string; pickedQty?: number; notes?: string }
): Promise<PickingItem> {
  const res = await fetch(`/api/picking-items/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update picking item");
  return res.json();
}

async function completePicking(
  taskId: number,
  performedBy?: string
): Promise<{ task: PickingTask; transactions: number; message: string }> {
  const res = await fetch(`/api/picking-tasks/${taskId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ performedBy }),
  });
  if (!res.ok) throw new Error("Failed to complete picking");
  return res.json();
}

async function startTask(taskId: number): Promise<PickingTask> {
  const res = await fetch(`/api/picking-tasks/${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "IN_PROGRESS" }),
  });
  if (!res.ok) throw new Error("Failed to start task");
  return res.json();
}

const itemStatusConfig: Record<PickingItemStatus, { label: string; color: string }> = {
  PENDING: { label: "대기", color: "badge-secondary" },
  IN_PROGRESS: { label: "스캔됨", color: "badge-info" },
  PICKED: { label: "완료", color: "badge-success" },
  SKIPPED: { label: "스킵", color: "badge-warning" },
};

export default function PickingSessionPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [pickedQty, setPickedQty] = useState<number | null>(null);

  const { data: task, isLoading: taskLoading } = useQuery({
    queryKey: ["picking-task", taskId],
    queryFn: () => fetchPickingTask(taskId),
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: layout } = useQuery({
    queryKey: ["warehouse-layout-default"],
    queryFn: fetchWarehouseLayout,
  });

  const startMutation = useMutation({
    mutationFn: () => startTask(parseInt(taskId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["picking-task", taskId] });
      toast.success("피킹 작업이 시작되었습니다.");
    },
    onError: () => toast.error("작업 시작에 실패했습니다."),
  });

  const pickMutation = useMutation({
    mutationFn: ({ itemId, qty }: { itemId: number; qty: number }) =>
      updatePickingItem(itemId, { action: "pick", pickedQty: qty }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["picking-task", taskId] });
      toast.success("피킹이 완료되었습니다.");
      setPickedQty(null);
    },
    onError: () => toast.error("피킹 처리에 실패했습니다."),
  });

  const scanMutation = useMutation({
    mutationFn: (itemId: number) => updatePickingItem(itemId, { action: "scan" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["picking-task", taskId] });
      toast.success("스캔 완료");
    },
  });

  const skipMutation = useMutation({
    mutationFn: (itemId: number) =>
      updatePickingItem(itemId, { action: "skip", notes: "Skipped by user" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["picking-task", taskId] });
      toast.info("항목을 건너뛰었습니다.");
    },
    onError: () => toast.error("처리에 실패했습니다."),
  });

  const completeMutation = useMutation({
    mutationFn: () => completePicking(parseInt(taskId)),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["picking-task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["picking-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success(result.message);
      setShowCompleteDialog(false);
      router.push("/picking");
    },
    onError: () => toast.error("완료 처리에 실패했습니다."),
  });

  if (taskLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-[var(--danger)]">피킹 작업을 찾을 수 없습니다.</p>
        <Link href="/picking" className="text-[var(--primary)] hover:underline">
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  // Find current/next item to pick
  const currentItem = task.items?.find(
    (item) => item.status === "PENDING" || item.status === "IN_PROGRESS"
  );
  const progress = task.totalItems > 0
    ? Math.round((task.pickedItems / task.totalItems) * 100)
    : 0;
  const isCompleted = task.status === "COMPLETED";
  const allPicked = task.items?.every(
    (item) => item.status === "PICKED" || item.status === "SKIPPED"
  );

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
                {task.taskCode}
              </h1>
              <span
                className={`badge ${
                  task.status === "COMPLETED"
                    ? "badge-success"
                    : task.status === "IN_PROGRESS"
                    ? "badge-warning"
                    : "badge-secondary"
                }`}
              >
                {task.status === "COMPLETED"
                  ? "완료"
                  : task.status === "IN_PROGRESS"
                  ? "진행중"
                  : "대기"}
              </span>
            </div>
            {task.salesOrder && (
              <p className="text-[var(--text-secondary)]">
                수주: {task.salesOrder.orderCode}
                {task.salesOrder.project && ` - ${task.salesOrder.project}`}
              </p>
            )}
          </div>
        </div>

        {task.status === "PENDING" && (
          <button
            onClick={() => startMutation.mutate()}
            className="btn btn-primary btn-lg"
            disabled={startMutation.isPending}
          >
            <Play className="w-5 h-5" />
            작업 시작
          </button>
        )}

        {task.status === "IN_PROGRESS" && allPicked && (
          <button
            onClick={() => setShowCompleteDialog(true)}
            className="btn btn-primary btn-lg"
          >
            <CheckCircle className="w-5 h-5" />
            완료 처리
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            진행률: {task.pickedItems}/{task.totalItems} 항목
          </span>
          <span className="text-sm font-bold text-[var(--primary)]">{progress}%</span>
        </div>
        <div className="h-3 bg-[var(--gray-200)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--primary)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Task Panel */}
        <div className="space-y-4">
          {/* Active Task Info */}
          <div className="glass-card p-4">
            <span className="badge badge-info mb-2">ACTIVE TASK</span>
            <h3 className="font-semibold text-[var(--text-primary)]">
              Pick Order #{task.taskCode.split("-").pop()}
            </h3>
            {task.salesOrder?.project && (
              <p className="text-sm text-[var(--text-muted)]">
                {task.salesOrder.project}
              </p>
            )}
          </div>

          {/* Next Step */}
          {currentItem && task.status === "IN_PROGRESS" && (
            <div className="glass-card p-4 border-l-4 border-[var(--primary)]">
              <p className="text-xs text-[var(--primary)] font-semibold mb-2">NEXT STEP</p>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-[var(--primary)] flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-lg">Proceed to Bin {currentItem.storageLocation}</p>
                  <p className="text-sm text-[var(--text-muted)]">
                    맵에서 파란색으로 표시된 위치를 찾으세요
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Checklist */}
          {currentItem && task.status === "IN_PROGRESS" && (
            <div className="glass-card p-4">
              <p className="text-xs text-[var(--text-muted)] font-semibold mb-3">ACTION CHECKLIST</p>

              {/* Scan Button */}
              <button
                onClick={() => scanMutation.mutate(currentItem.id)}
                disabled={currentItem.status === "IN_PROGRESS" || scanMutation.isPending}
                className={`w-full p-3 rounded-lg flex items-center gap-3 mb-2 transition-colors ${
                  currentItem.status === "IN_PROGRESS"
                    ? "bg-[var(--primary)] text-white"
                    : "bg-[var(--gray-100)] hover:bg-[var(--gray-200)]"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                    currentItem.status === "IN_PROGRESS"
                      ? "border-white bg-white"
                      : "border-[var(--gray-400)]"
                  }`}
                >
                  {currentItem.status === "IN_PROGRESS" && (
                    <Check className="w-4 h-4 text-[var(--primary)]" />
                  )}
                </div>
                <span>Scan Item at {currentItem.storageLocation}</span>
              </button>

              {/* Verify & Pick */}
              {currentItem.status === "IN_PROGRESS" && (
                <div className="p-3 bg-white rounded-lg border border-[var(--gray-200)]">
                  <div className="flex items-center gap-2 mb-3">
                    <Check className="w-5 h-5 text-[var(--text-muted)]" />
                    <span>Verify Quantity ({currentItem.requiredQty} {currentItem.part?.unit})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={pickedQty ?? currentItem.requiredQty}
                      onChange={(e) => setPickedQty(parseInt(e.target.value) || 0)}
                      className="input flex-1"
                      min={0}
                      max={currentItem.requiredQty * 2}
                    />
                    <button
                      onClick={() =>
                        pickMutation.mutate({
                          itemId: currentItem.id,
                          qty: pickedQty ?? currentItem.requiredQty,
                        })
                      }
                      disabled={pickMutation.isPending}
                      className="btn btn-primary"
                    >
                      <Check className="w-4 h-4" />
                      확인
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => toast.warning("이슈 플래그 기능 - 개발 예정")}
                  className="flex-1 py-2 px-3 border border-[var(--danger)] text-[var(--danger)] rounded-lg hover:bg-[var(--danger)]/10 transition-colors"
                >
                  FLAG ISSUE
                </button>
                <button
                  onClick={() => skipMutation.mutate(currentItem.id)}
                  disabled={skipMutation.isPending}
                  className="flex-1 py-2 px-3 border border-[var(--gray-400)] rounded-lg hover:bg-[var(--gray-100)] transition-colors"
                >
                  SKIP STEP
                </button>
              </div>
            </div>
          )}

          {/* Completed Message */}
          {(isCompleted || (task.status === "IN_PROGRESS" && allPicked)) && (
            <div className="glass-card p-6 text-center">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-[var(--success)]" />
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {isCompleted ? "피킹 작업이 완료되었습니다!" : "모든 항목을 처리했습니다!"}
              </p>
              {!isCompleted && (
                <button
                  onClick={() => setShowCompleteDialog(true)}
                  className="btn btn-primary mt-4"
                >
                  완료 처리
                </button>
              )}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="lg:col-span-2 glass-card p-4">
          {layout ? (
            <WarehouseMap
              layout={layout}
              highlightLocation={currentItem?.storageLocation}
              showPartCounts={false}
            />
          ) : (
            <div className="flex items-center justify-center h-[400px] text-[var(--text-muted)]">
              <div className="text-center">
                <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>창고 레이아웃이 없습니다.</p>
                <Link href="/warehouse" className="text-[var(--primary)] hover:underline">
                  창고 설정하기
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Task Item List */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Task Item List ({task.taskCode})
            </h2>
          </div>
          <span className="text-sm text-[var(--text-muted)]">
            Showing {task.items?.length || 0} items required
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                <th className="text-left px-4 py-3 text-sm font-medium text-[var(--text-muted)]">
                  BIN LOCATION
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-[var(--text-muted)]">
                  ITEM DESCRIPTION
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-[var(--text-muted)]">
                  PICK QTY
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-[var(--text-muted)]">
                  TASK STATUS
                </th>
              </tr>
            </thead>
            <tbody>
              {task.items?.map((item) => {
                const isCurrent = currentItem?.id === item.id;
                const status = itemStatusConfig[item.status];

                return (
                  <tr
                    key={item.id}
                    className={`border-b border-[var(--glass-border)] ${
                      isCurrent ? "bg-[var(--primary)]/5" : ""
                    }`}
                  >
                    <td className="px-4 py-4">
                      <span
                        className={`font-mono ${
                          isCurrent ? "text-[var(--primary)] font-bold" : ""
                        }`}
                      >
                        {item.storageLocation}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium">{item.part?.partName || "-"}</p>
                      <p className="text-sm text-[var(--text-muted)]">
                        {item.part?.partCode}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-xl font-bold">{item.requiredQty}</span>
                      {item.status === "PICKED" && item.pickedQty !== item.requiredQty && (
                        <span className="text-sm text-[var(--text-muted)] ml-1">
                          (실제: {item.pickedQty})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {isCurrent && item.status === "PENDING" ? (
                        <span className="badge badge-info animate-pulse">● NEXT UP</span>
                      ) : (
                        <span className={`badge ${status.color}`}>
                          {item.status === "PICKED" && <Check className="w-3 h-3 inline mr-1" />}
                          {status.label}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Complete Confirmation */}
      <ConfirmDialog
        isOpen={showCompleteDialog}
        onClose={() => setShowCompleteDialog(false)}
        onConfirm={() => completeMutation.mutate()}
        title="피킹 작업 완료"
        message="피킹 작업을 완료하시겠습니까? 피킹된 파츠들의 출고 처리가 자동으로 진행됩니다."
        confirmText="완료 처리"
        variant="info"
        isLoading={completeMutation.isPending}
      />
    </div>
  );
}

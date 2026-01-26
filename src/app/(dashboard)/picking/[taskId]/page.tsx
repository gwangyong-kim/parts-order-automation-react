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
  Edit2,
  MessageSquare,
  Settings,
  X,
  Save,
  Undo2,
  RotateCcw,
  Trash2,
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

async function updatePickingTask(
  taskId: number,
  data: { priority?: string; assignedTo?: string; notes?: string; action?: string }
): Promise<PickingTask> {
  const res = await fetch(`/api/picking-tasks/${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update picking task");
  return res.json();
}

async function deletePickingTask(taskId: number): Promise<void> {
  const res = await fetch(`/api/picking-tasks/${taskId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete picking task");
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
  const [showRevertTaskDialog, setShowRevertTaskDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pickedQty, setPickedQty] = useState<number | null>(null);

  // Phase 1: 편집 기능 상태
  const [showTaskEditModal, setShowTaskEditModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingQty, setEditingQty] = useState<number>(0);
  const [noteEditingItemId, setNoteEditingItemId] = useState<number | null>(null);
  const [itemNote, setItemNote] = useState<string>("");
  const [taskEditData, setTaskEditData] = useState({
    priority: "",
    assignedTo: "",
    notes: "",
  });

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
      updatePickingItem(itemId, { action: "skip", notes: "사용자가 건너뜀" }),
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

  // Phase 1.1: 완료 아이템 수량 수정 mutation
  const updateQtyMutation = useMutation({
    mutationFn: ({ itemId, qty }: { itemId: number; qty: number }) =>
      updatePickingItem(itemId, { pickedQty: qty }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["picking-task", taskId] });
      toast.success("수량이 수정되었습니다.");
      setEditingItemId(null);
      setEditingQty(0);
    },
    onError: () => toast.error("수량 수정에 실패했습니다."),
  });

  // Phase 1.2: 작업 메타데이터 편집 mutation
  const updateTaskMutation = useMutation({
    mutationFn: (data: { priority?: string; assignedTo?: string; notes?: string }) =>
      updatePickingTask(parseInt(taskId), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["picking-task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["picking-tasks"] });
      toast.success("작업 정보가 수정되었습니다.");
      setShowTaskEditModal(false);
    },
    onError: () => toast.error("작업 정보 수정에 실패했습니다."),
  });

  // Phase 1.3: 아이템 메모 수정 mutation
  const updateItemNoteMutation = useMutation({
    mutationFn: ({ itemId, notes }: { itemId: number; notes: string }) =>
      updatePickingItem(itemId, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["picking-task", taskId] });
      toast.success("메모가 저장되었습니다.");
      setNoteEditingItemId(null);
      setItemNote("");
    },
    onError: () => toast.error("메모 저장에 실패했습니다."),
  });

  // 스킵 롤백 mutation (SKIPPED -> PENDING)
  const revertSkipMutation = useMutation({
    mutationFn: (itemId: number) =>
      updatePickingItem(itemId, { action: "revert-skip" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["picking-task", taskId] });
      toast.success("스킵이 취소되었습니다.");
    },
    onError: () => toast.error("스킵 취소에 실패했습니다."),
  });

  // 피킹 완료 롤백 mutation (PICKED -> PENDING)
  const revertPickMutation = useMutation({
    mutationFn: (itemId: number) =>
      updatePickingItem(itemId, { action: "revert-pick" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["picking-task", taskId] });
      toast.success("피킹이 취소되었습니다.");
    },
    onError: () => toast.error("피킹 취소에 실패했습니다."),
  });

  // 전체 작업 롤백 mutation (COMPLETED -> IN_PROGRESS)
  const revertTaskMutation = useMutation({
    mutationFn: () => updatePickingTask(parseInt(taskId), { action: "revert" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["picking-task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["picking-tasks"] });
      toast.success("작업이 진행 중 상태로 되돌려졌습니다.");
      setShowRevertTaskDialog(false);
    },
    onError: () => toast.error("작업 롤백에 실패했습니다."),
  });

  // 작업 삭제 mutation
  const deleteMutation = useMutation({
    mutationFn: () => deletePickingTask(parseInt(taskId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["picking-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["active-picking-data"] });
      toast.success("피킹 작업이 삭제되었습니다.");
      router.push("/picking");
    },
    onError: () => toast.error("작업 삭제에 실패했습니다."),
  });

  // 작업 편집 모달 열기
  const openTaskEditModal = () => {
    if (task) {
      setTaskEditData({
        priority: task.priority || "NORMAL",
        assignedTo: task.assignedTo || "",
        notes: task.notes || "",
      });
      setShowTaskEditModal(true);
    }
  };

  // 아이템 수량 편집 시작
  const startEditingQty = (item: PickingItem) => {
    setEditingItemId(item.id);
    setEditingQty(item.pickedQty || item.requiredQty);
  };

  // 아이템 메모 편집 시작
  const startEditingNote = (item: PickingItem) => {
    setNoteEditingItemId(item.id);
    setItemNote(item.notes || "");
  };

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

        <div className="flex items-center gap-2">
          {/* Phase 1.2: 작업 편집 버튼 */}
          {task.status !== "COMPLETED" && (
            <button
              onClick={openTaskEditModal}
              className="btn btn-secondary"
              title="작업 설정 편집"
            >
              <Settings className="w-5 h-5" />
              편집
            </button>
          )}

          {/* 삭제 버튼 - 완료되지 않은 작업만 */}
          {task.status !== "COMPLETED" && (
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="btn btn-danger"
              title="작업 삭제"
            >
              <Trash2 className="w-5 h-5" />
              삭제
            </button>
          )}

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

          {/* 완료된 작업 롤백 버튼 */}
          {task.status === "COMPLETED" && (
            <button
              onClick={() => setShowRevertTaskDialog(true)}
              className="btn btn-warning"
            >
              <RotateCcw className="w-5 h-5" />
              작업 되돌리기
            </button>
          )}
        </div>
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
            <span className="badge badge-info mb-2">현재 작업</span>
            <h3 className="font-semibold text-[var(--text-primary)]">
              피킹 주문 #{task.taskCode.split("-").pop()}
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
              <p className="text-xs text-[var(--primary)] font-semibold mb-2">다음 단계</p>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-[var(--primary)] flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-lg">{currentItem.storageLocation} 위치로 이동</p>
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
              <p className="text-xs text-[var(--text-muted)] font-semibold mb-3">작업 체크리스트</p>

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
                <span>{currentItem.storageLocation} 위치에서 아이템 스캔</span>
              </button>

              {/* Verify & Pick */}
              {currentItem.status === "IN_PROGRESS" && (
                <div className="p-3 bg-white rounded-lg border border-[var(--gray-200)]">
                  <div className="flex items-center gap-2 mb-3">
                    <Check className="w-5 h-5 text-[var(--text-muted)]" />
                    <span>수량 확인 ({currentItem.requiredQty} {currentItem.part?.unit})</span>
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
                  이슈 신고
                </button>
                <button
                  onClick={() => skipMutation.mutate(currentItem.id)}
                  disabled={skipMutation.isPending}
                  className="flex-1 py-2 px-3 border border-[var(--gray-400)] rounded-lg hover:bg-[var(--gray-100)] transition-colors"
                >
                  건너뛰기
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
              피킹 항목 목록 ({task.taskCode})
            </h2>
          </div>
          <span className="text-sm text-[var(--text-muted)]">
            총 {task.items?.length || 0}개 항목
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                <th className="text-left px-4 py-3 text-sm font-medium text-[var(--text-muted)]">
                  저장 위치
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-[var(--text-muted)]">
                  품목 정보
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-[var(--text-muted)]">
                  피킹 수량
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-[var(--text-muted)]">
                  상태
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-[var(--text-muted)]">
                  작업
                </th>
              </tr>
            </thead>
            <tbody>
              {task.items?.map((item) => {
                const isCurrent = currentItem?.id === item.id;
                const status = itemStatusConfig[item.status];
                const isEditingThisItem = editingItemId === item.id;
                const isEditingThisNote = noteEditingItemId === item.id;

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
                      {/* Phase 1.3: 메모 표시 */}
                      {item.notes && !isEditingThisNote && (
                        <p className="text-xs text-[var(--text-muted)] mt-1 italic">
                          메모: {item.notes}
                        </p>
                      )}
                      {/* Phase 1.3: 메모 편집 인라인 */}
                      {isEditingThisNote && (
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="text"
                            value={itemNote}
                            onChange={(e) => setItemNote(e.target.value)}
                            className="input text-sm flex-1"
                            placeholder="메모 입력..."
                            autoFocus
                          />
                          <button
                            onClick={() => updateItemNoteMutation.mutate({ itemId: item.id, notes: itemNote })}
                            disabled={updateItemNoteMutation.isPending}
                            className="p-1.5 text-[var(--success)] hover:bg-[var(--success)]/10 rounded"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setNoteEditingItemId(null); setItemNote(""); }}
                            className="p-1.5 text-[var(--text-muted)] hover:bg-[var(--gray-100)] rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {/* Phase 1.1: 수량 편집 인라인 */}
                      {isEditingThisItem ? (
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="number"
                            value={editingQty}
                            onChange={(e) => setEditingQty(parseInt(e.target.value) || 0)}
                            className="input w-20 text-right"
                            min={0}
                            autoFocus
                          />
                          <button
                            onClick={() => updateQtyMutation.mutate({ itemId: item.id, qty: editingQty })}
                            disabled={updateQtyMutation.isPending}
                            className="p-1.5 text-[var(--success)] hover:bg-[var(--success)]/10 rounded"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setEditingItemId(null); setEditingQty(0); }}
                            className="p-1.5 text-[var(--text-muted)] hover:bg-[var(--gray-100)] rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-xl font-bold">{item.requiredQty}</span>
                          {item.status === "PICKED" && item.pickedQty !== item.requiredQty && (
                            <span className="text-sm text-[var(--text-muted)] ml-1">
                              (실제: {item.pickedQty})
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {isCurrent && item.status === "PENDING" ? (
                        <span className="badge badge-info animate-pulse">● 다음 항목</span>
                      ) : (
                        <span className={`badge ${status.color}`}>
                          {item.status === "PICKED" && <Check className="w-3 h-3 inline mr-1" />}
                          {status.label}
                        </span>
                      )}
                    </td>
                    {/* Phase 1: 액션 열 */}
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {/* Phase 1.1: 수량 수정 버튼 (PICKED 상태일 때) */}
                        {item.status === "PICKED" && task.status !== "COMPLETED" && !isEditingThisItem && (
                          <button
                            onClick={() => startEditingQty(item)}
                            className="p-1.5 text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded"
                            title="수량 수정"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {/* 피킹 완료 롤백 버튼 (PICKED -> PENDING) */}
                        {item.status === "PICKED" && task.status !== "COMPLETED" && (
                          <button
                            onClick={() => revertPickMutation.mutate(item.id)}
                            disabled={revertPickMutation.isPending}
                            className="p-1.5 text-[var(--warning)] hover:bg-[var(--warning)]/10 rounded"
                            title="피킹 취소 (대기로 되돌리기)"
                          >
                            <Undo2 className="w-4 h-4" />
                          </button>
                        )}
                        {/* 스킵 롤백 버튼 (SKIPPED -> PENDING) */}
                        {item.status === "SKIPPED" && task.status !== "COMPLETED" && (
                          <button
                            onClick={() => revertSkipMutation.mutate(item.id)}
                            disabled={revertSkipMutation.isPending}
                            className="p-1.5 text-[var(--info)] hover:bg-[var(--info)]/10 rounded"
                            title="스킵 취소 (대기로 되돌리기)"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        {/* Phase 1.3: 메모 버튼 */}
                        {task.status !== "COMPLETED" && !isEditingThisNote && (
                          <button
                            onClick={() => startEditingNote(item)}
                            className="p-1.5 text-[var(--text-muted)] hover:bg-[var(--gray-100)] rounded"
                            title="메모 추가/편집"
                          >
                            <MessageSquare className="w-4 h-4" />
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

      {/* Task Revert Confirmation */}
      <ConfirmDialog
        isOpen={showRevertTaskDialog}
        onClose={() => setShowRevertTaskDialog(false)}
        onConfirm={() => revertTaskMutation.mutate()}
        title="작업 되돌리기"
        message="완료된 작업을 진행 중 상태로 되돌리시겠습니까? 출고 처리된 재고는 자동으로 복원되지 않으며, 필요시 수동으로 처리해야 합니다."
        confirmText="되돌리기"
        variant="warning"
        isLoading={revertTaskMutation.isPending}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="피킹 작업 삭제"
        message={`피킹 작업 "${task.taskCode}"을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* Phase 1.2: 작업 편집 모달 */}
      {showTaskEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass-card p-6 w-full max-w-md mx-4 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                피킹 작업 편집
              </h2>
              <button
                onClick={() => setShowTaskEditModal(false)}
                className="p-1 hover:bg-[var(--gray-100)] rounded"
              >
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 우선순위 */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  우선순위
                </label>
                <select
                  value={taskEditData.priority}
                  onChange={(e) => setTaskEditData({ ...taskEditData, priority: e.target.value })}
                  className="input w-full"
                >
                  <option value="URGENT">긴급</option>
                  <option value="HIGH">높음</option>
                  <option value="NORMAL">보통</option>
                  <option value="LOW">낮음</option>
                </select>
              </div>

              {/* 담당자 */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  담당자
                </label>
                <input
                  type="text"
                  value={taskEditData.assignedTo}
                  onChange={(e) => setTaskEditData({ ...taskEditData, assignedTo: e.target.value })}
                  className="input w-full"
                  placeholder="담당자 이름"
                />
              </div>

              {/* 작업 메모 */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  작업 메모
                </label>
                <textarea
                  value={taskEditData.notes}
                  onChange={(e) => setTaskEditData({ ...taskEditData, notes: e.target.value })}
                  className="input w-full"
                  rows={3}
                  placeholder="작업 관련 메모..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowTaskEditModal(false)}
                className="btn btn-secondary"
              >
                취소
              </button>
              <button
                onClick={() => updateTaskMutation.mutate(taskEditData)}
                disabled={updateTaskMutation.isPending}
                className="btn btn-primary"
              >
                {updateTaskMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    저장 중...
                  </span>
                ) : (
                  "저장"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

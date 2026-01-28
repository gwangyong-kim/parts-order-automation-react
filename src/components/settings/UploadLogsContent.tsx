"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  Package,
  Layers,
  FileText,
  ShoppingCart,
  ArrowLeftRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

type UploadType = "ALL" | "PARTS" | "PRODUCTS" | "SALES_ORDERS" | "ORDERS" | "TRANSACTIONS";
type UploadStatus = "ALL" | "COMPLETED" | "PARTIAL" | "FAILED";

interface BulkUploadLog {
  id: number;
  uploadType: string;
  fileName: string | null;
  totalRows: number;
  successCount: number;
  failedCount: number;
  status: string;
  hasErrors: boolean;
  errorCount: number;
  performedBy: string | null;
  createdAt: string;
}

interface LogStats {
  total: number;
  completed: number;
  partial: number;
  failed: number;
}

const UPLOAD_TYPE_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  PARTS: { label: "파츠", icon: Package, color: "text-blue-500 bg-blue-100" },
  PRODUCTS: { label: "제품/BOM", icon: Layers, color: "text-purple-500 bg-purple-100" },
  SALES_ORDERS: { label: "수주", icon: FileText, color: "text-green-500 bg-green-100" },
  ORDERS: { label: "발주", icon: ShoppingCart, color: "text-orange-500 bg-orange-100" },
  TRANSACTIONS: { label: "재고이동", icon: ArrowLeftRight, color: "text-cyan-500 bg-cyan-100" },
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  COMPLETED: { label: "성공", icon: CheckCircle2, color: "text-emerald-600 bg-emerald-100" },
  PARTIAL: { label: "부분성공", icon: AlertTriangle, color: "text-amber-600 bg-amber-100" },
  FAILED: { label: "실패", icon: XCircle, color: "text-red-600 bg-red-100" },
};

async function fetchUploadLogs(
  uploadType?: string,
  status?: string,
  includeStats?: boolean
): Promise<{ data: BulkUploadLog[]; total: number; stats: LogStats | null }> {
  const params = new URLSearchParams();
  if (uploadType && uploadType !== "ALL") params.set("uploadType", uploadType);
  if (status && status !== "ALL") params.set("status", status);
  if (includeStats) params.set("includeStats", "true");
  params.set("limit", "100");

  const res = await fetch(`/api/bulk-upload-logs?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch upload logs");
  return res.json();
}

async function fetchLogErrors(id: number): Promise<string[]> {
  const res = await fetch(`/api/bulk-upload-logs/${id}`);
  if (!res.ok) throw new Error("Failed to fetch log errors");
  const data = await res.json();
  return data.errors || [];
}

const LogItem = ({
  log,
  isExpanded,
  onToggleExpand,
  onDelete,
}: {
  log: BulkUploadLog;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
}) => {
  const [errors, setErrors] = useState<string[] | null>(null);
  const [isLoadingErrors, setIsLoadingErrors] = useState(false);

  const typeConfig = UPLOAD_TYPE_CONFIG[log.uploadType] || {
    label: log.uploadType,
    icon: Upload,
    color: "text-gray-500 bg-gray-100",
  };
  const statusConfig = STATUS_CONFIG[log.status] || STATUS_CONFIG.COMPLETED;
  const TypeIcon = typeConfig.icon;
  const StatusIcon = statusConfig.icon;

  const handleToggle = async () => {
    if (!isExpanded && log.hasErrors && errors === null) {
      setIsLoadingErrors(true);
      try {
        const fetchedErrors = await fetchLogErrors(log.id);
        setErrors(fetchedErrors);
      } catch {
        setErrors([]);
      } finally {
        setIsLoadingErrors(false);
      }
    }
    onToggleExpand();
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeConfig.color}`}>
          <TypeIcon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[var(--text-primary)]">
              {typeConfig.label} 업로드
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusConfig.color}`}>
              <StatusIcon className="w-3 h-3" />
              {statusConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-[var(--text-secondary)]">
            <span>{format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss")}</span>
            <span>총 {log.totalRows}행 | 성공 {log.successCount}건 | 실패 {log.failedCount}건</span>
            {log.performedBy && <span>작업자: {log.performedBy}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {log.hasErrors && (
            <button onClick={handleToggle} className="btn btn-secondary text-sm">
              {isLoadingErrors ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  오류 ({log.errorCount}건)
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </>
              )}
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="삭제"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isExpanded && log.hasErrors && errors && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="font-medium text-red-800 mb-2 flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            오류 내역 ({errors.length}건)
          </h4>
          <ul className="space-y-1 max-h-64 overflow-y-auto">
            {errors.map((error, idx) => (
              <li key={idx} className="text-sm text-red-700 font-mono bg-white/50 px-2 py-1 rounded">
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default function UploadLogsContent() {
  const [selectedType, setSelectedType] = useState<UploadType>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<UploadStatus>("ALL");
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "single"; id: number } | { type: "days"; days: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const toast = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["upload-logs", selectedType, selectedStatus],
    queryFn: () => fetchUploadLogs(selectedType, selectedStatus, true),
    staleTime: 30000,
  });

  const logs = useMemo(() => data?.data || [], [data?.data]);
  const stats = useMemo<LogStats>(() => data?.stats || { total: 0, completed: 0, partial: 0, failed: 0 }, [data?.stats]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const params = new URLSearchParams();
      if (deleteTarget.type === "single") {
        params.set("id", deleteTarget.id.toString());
      } else {
        params.set("days", deleteTarget.days.toString());
      }

      const res = await fetch(`/api/bulk-upload-logs?${params.toString()}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("삭제 실패");

      const result = await res.json();
      toast.success(result.message);
      queryClient.invalidateQueries({ queryKey: ["upload-logs"] });
    } catch {
      toast.error("로그 삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, queryClient, toast]);

  const toggleExpand = useCallback((id: number) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  }, []);

  const TypeFilterButtons = useMemo(
    () => (
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => setSelectedType("ALL")}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            selectedType === "ALL"
              ? "bg-[var(--primary)] text-white"
              : "bg-[var(--gray-100)] text-[var(--text-secondary)] hover:bg-[var(--gray-200)]"
          }`}
        >
          전체
        </button>
        {Object.entries(UPLOAD_TYPE_CONFIG).map(([key, config]) => {
          const Icon = config.icon;
          return (
            <button
              key={key}
              onClick={() => setSelectedType(key as UploadType)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${
                selectedType === key
                  ? "bg-[var(--primary)] text-white"
                  : "bg-[var(--gray-100)] text-[var(--text-secondary)] hover:bg-[var(--gray-200)]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {config.label}
            </button>
          );
        })}
      </div>
    ),
    [selectedType]
  );

  const StatusFilterButtons = useMemo(
    () => (
      <div className="flex gap-1">
        <button
          onClick={() => setSelectedStatus("ALL")}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            selectedStatus === "ALL"
              ? "bg-[var(--primary)] text-white"
              : "bg-[var(--gray-100)] text-[var(--text-secondary)] hover:bg-[var(--gray-200)]"
          }`}
        >
          전체
        </button>
        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
          const Icon = config.icon;
          return (
            <button
              key={key}
              onClick={() => setSelectedStatus(key as UploadStatus)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${
                selectedStatus === key
                  ? "bg-[var(--primary)] text-white"
                  : "bg-[var(--gray-100)] text-[var(--text-secondary)] hover:bg-[var(--gray-200)]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {config.label}
            </button>
          );
        })}
      </div>
    ),
    [selectedStatus]
  );

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <p className="text-[var(--text-secondary)]">
          대량 업로드 작업의 실행 이력과 오류 내역을 확인합니다.
        </p>

        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="btn btn-secondary" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            새로고침
          </button>
          <button
            onClick={() => {
              setDeleteTarget({ type: "days", days: 30 });
              setShowDeleteDialog(true);
            }}
            className="btn btn-secondary text-red-500 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
            30일 이전 삭제
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
              <Upload className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-secondary)]">전체</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">{stats.total}건</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-secondary)]">성공</p>
              <p className="text-xl font-bold text-emerald-600">{stats.completed}건</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-secondary)]">부분성공</p>
              <p className="text-xl font-bold text-amber-600">{stats.partial}건</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-secondary)]">실패</p>
              <p className="text-xl font-bold text-red-600">{stats.failed}건</p>
            </div>
          </div>
        </div>
      </div>

      {/* 필터 탭 */}
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-secondary)]">유형:</span>
            {TypeFilterButtons}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-secondary)]">상태:</span>
            {StatusFilterButtons}
          </div>
        </div>
      </div>

      {/* 로그 목록 */}
      <div className="glass-card">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-[var(--text-muted)]">
            <Upload className="w-12 h-12 mb-3 opacity-50" />
            <p>업로드 로그가 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--glass-border)]">
            {logs.map((log) => (
              <LogItem
                key={log.id}
                log={log}
                isExpanded={expandedLogId === log.id}
                onToggleExpand={() => toggleExpand(log.id)}
                onDelete={() => {
                  setDeleteTarget({ type: "single", id: log.id });
                  setShowDeleteDialog(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setDeleteTarget(null);
        }}
        onConfirm={handleDelete}
        title="로그 삭제"
        message={
          deleteTarget?.type === "single"
            ? "이 로그를 삭제하시겠습니까?"
            : `${deleteTarget?.days}일 이전의 모든 로그를 삭제하시겠습니까?`
        }
        confirmText="삭제"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}

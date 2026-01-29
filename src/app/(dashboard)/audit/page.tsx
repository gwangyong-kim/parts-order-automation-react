"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
  ColumnResizeMode,
} from "@tanstack/react-table";
import {
  ClipboardCheck,
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Edit2,
  Trash2,
  Calendar,
  Repeat,
  Target,
  FileText,
  ArrowRight,
  Info,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import AuditForm from "@/components/forms/AuditForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { usePermission } from "@/hooks/usePermission";

interface AuditRecord {
  id: number;
  auditCode: string;
  auditDate: string;
  auditType: string;
  auditScope: "ALL" | "PARTIAL";
  status: string;
  totalItems: number;
  matchedItems: number;
  discrepancyItems: number;
  notes: string | null;
  createdBy: {
    id: number;
    name: string;
  } | null;
  completedAt: string | null;
}

const auditTypeLabels: Record<string, string> = {
  MONTHLY: "월간 실사",
  QUARTERLY: "분기 실사",
  YEARLY: "연간 실사",
  SPOT: "비정기 실사",
};

const auditTypeColors: Record<string, string> = {
  MONTHLY: "badge-primary",
  QUARTERLY: "badge-info",
  YEARLY: "badge-warning",
  SPOT: "badge-secondary",
};

async function fetchAudits(): Promise<AuditRecord[]> {
  const res = await fetch("/api/audit?pageSize=1000");
  if (!res.ok) throw new Error("Failed to fetch audits");
  const result = await res.json();
  return result.data;
}

async function createAudit(data: Partial<AuditRecord>): Promise<AuditRecord> {
  const res = await fetch("/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create audit");
  return res.json();
}

async function updateAudit(id: number, data: Partial<AuditRecord>): Promise<AuditRecord> {
  const res = await fetch(`/api/audit/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update audit");
  return res.json();
}

async function deleteAudit(id: number): Promise<void> {
  const res = await fetch(`/api/audit/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete audit");
}

const statusColors: Record<string, string> = {
  PLANNED: "badge-secondary",
  IN_PROGRESS: "badge-warning",
  COMPLETED: "badge-success",
  CANCELLED: "badge-danger",
};

const statusLabels: Record<string, string> = {
  PLANNED: "예정",
  IN_PROGRESS: "진행중",
  COMPLETED: "완료",
  CANCELLED: "취소",
};

const columnHelper = createColumnHelper<AuditRecord>();

export default function AuditPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can } = usePermission();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<AuditRecord | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnResizeMode] = useState<ColumnResizeMode>("onChange");

  const { data: audits, isLoading, error } = useQuery({
    queryKey: ["audits"],
    queryFn: fetchAudits,
  });

  const createMutation = useMutation({
    mutationFn: createAudit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audits"] });
      toast.success("실사가 생성되었습니다.");
      setShowFormModal(false);
    },
    onError: () => {
      toast.error("실사 생성에 실패했습니다.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AuditRecord> }) =>
      updateAudit(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["audits"] });
      // 실사 시작(상태 변경만)이 아닌 경우에만 메시지 표시 및 상태 초기화
      if (variables.data.status !== "IN_PROGRESS" || Object.keys(variables.data).length > 1) {
        toast.success("실사가 수정되었습니다.");
        setShowFormModal(false);
        setSelectedAudit(null);
      }
    },
    onError: () => {
      toast.error("실사 수정에 실패했습니다.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAudit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audits"] });
      toast.success("실사가 삭제되었습니다.");
      setShowDeleteDialog(false);
      setSelectedAudit(null);
    },
    onError: () => {
      toast.error("실사 삭제에 실패했습니다.");
    },
  });

  const handleCreate = () => {
    setSelectedAudit(null);
    setShowFormModal(true);
  };

  const handleEdit = (audit: AuditRecord) => {
    setSelectedAudit(audit);
    setShowFormModal(true);
  };

  const handleDelete = (audit: AuditRecord) => {
    setSelectedAudit(audit);
    setShowDeleteDialog(true);
  };

  const handleStartAudit = (audit: AuditRecord) => {
    setSelectedAudit(audit);
    updateMutation.mutate(
      {
        id: audit.id,
        data: { status: "IN_PROGRESS" },
      },
      {
        onSuccess: () => {
          setShowGuideModal(true);
        },
      }
    );
  };

  const handleFormSubmit = (data: Partial<AuditRecord>) => {
    if (selectedAudit) {
      updateMutation.mutate({ id: selectedAudit.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDeleteConfirm = () => {
    if (selectedAudit) {
      deleteMutation.mutate(selectedAudit.id);
    }
  };

  // TanStack Table 컬럼 정의
  const columns = useMemo(
    () => [
      // 실사코드
      columnHelper.accessor("auditCode", {
        header: "실사코드",
        size: 130,
        minSize: 100,
        maxSize: 180,
        cell: (info) => (
          <span className="font-medium">{info.getValue()}</span>
        ),
      }),
      // 유형
      columnHelper.accessor("auditType", {
        header: "유형",
        size: 100,
        minSize: 80,
        maxSize: 130,
        cell: (info) => (
          <span className={`badge ${auditTypeColors[info.getValue()] || "badge-secondary"}`}>
            {auditTypeLabels[info.getValue()] || info.getValue()}
          </span>
        ),
      }),
      // 실사일
      columnHelper.accessor("auditDate", {
        header: "실사일",
        size: 110,
        minSize: 100,
        maxSize: 140,
        cell: (info) => new Date(info.getValue()).toLocaleDateString("ko-KR"),
      }),
      // 상태
      columnHelper.accessor("status", {
        header: "상태",
        size: 85,
        minSize: 70,
        maxSize: 100,
        cell: (info) => (
          <span className={`badge ${statusColors[info.getValue()]}`}>
            {statusLabels[info.getValue()]}
          </span>
        ),
      }),
      // 총 품목
      columnHelper.accessor("totalItems", {
        header: "총 품목",
        size: 85,
        minSize: 70,
        maxSize: 100,
        cell: (info) => (
          <span className="tabular-nums text-right block">{info.getValue()}</span>
        ),
      }),
      // 일치
      columnHelper.accessor("matchedItems", {
        header: "일치",
        size: 75,
        minSize: 60,
        maxSize: 90,
        cell: (info) => (
          <span className="tabular-nums text-right block text-[var(--success)]">
            {info.getValue()}
          </span>
        ),
      }),
      // 불일치
      columnHelper.accessor("discrepancyItems", {
        header: "불일치",
        size: 80,
        minSize: 65,
        maxSize: 100,
        cell: (info) => {
          const value = info.getValue();
          return value > 0 ? (
            <span className="text-[var(--danger)] font-medium tabular-nums text-right block">
              {value}
            </span>
          ) : (
            <span className="text-[var(--text-muted)] tabular-nums text-right block">0</span>
          );
        },
      }),
      // 담당자
      columnHelper.accessor((row) => row.createdBy?.name ?? "-", {
        id: "createdBy",
        header: "담당자",
        size: 100,
        minSize: 80,
        maxSize: 140,
        cell: (info) => info.getValue(),
      }),
      // 완료일
      columnHelper.accessor("completedAt", {
        header: "완료일",
        size: 110,
        minSize: 100,
        maxSize: 140,
        cell: (info) => {
          const value = info.getValue();
          return value ? (
            <span className="text-[var(--text-secondary)]">
              {new Date(value).toLocaleDateString("ko-KR")}
            </span>
          ) : (
            "-"
          );
        },
      }),
      // 작업
      columnHelper.display({
        id: "actions",
        header: "작업",
        size: 130,
        minSize: 120,
        maxSize: 160,
        enableResizing: false,
        cell: ({ row }) => {
          const audit = row.original;
          return (
            <div className="flex items-center justify-center gap-2">
              <Link
                href={`/audit/${audit.id}`}
                className="table-action-btn edit"
                title="상세보기"
                aria-label={`${audit.auditCode} 상세보기`}
              >
                <Eye className="w-4 h-4 text-[var(--text-secondary)]" />
              </Link>
              {audit.status === "PLANNED" && can("inventory", "edit") && (
                <button
                  onClick={() => handleStartAudit(audit)}
                  className="table-action-btn edit"
                  title="실사 시작"
                  aria-label={`${audit.auditCode} 실사 시작`}
                >
                  <Play className="w-4 h-4 text-[var(--primary)]" />
                </button>
              )}
              {can("inventory", "edit") && (
                <button
                  onClick={() => handleEdit(audit)}
                  className="table-action-btn edit"
                  title="수정"
                  aria-label={`${audit.auditCode} 수정`}
                >
                  <Edit2 className="w-4 h-4 text-[var(--text-secondary)]" />
                </button>
              )}
              {can("inventory", "delete") && (
                <button
                  onClick={() => handleDelete(audit)}
                  className="table-action-btn delete"
                  title="삭제"
                  aria-label={`${audit.auditCode} 삭제`}
                >
                  <Trash2 className="w-4 h-4 text-[var(--text-secondary)]" />
                </button>
              )}
            </div>
          );
        },
      }),
    ],
    [can]
  );

  // 내보내기 기능
  const handleExport = () => {
    if (!filteredAudits || filteredAudits.length === 0) {
      toast.error("내보낼 데이터가 없습니다.");
      return;
    }

    const headers = ["실사코드", "유형", "실사일", "상태", "총 품목", "일치", "불일치", "담당자", "완료일"];
    const rows = filteredAudits.map((audit) => [
      audit.auditCode,
      auditTypeLabels[audit.auditType] || audit.auditType,
      new Date(audit.auditDate).toLocaleDateString("ko-KR"),
      statusLabels[audit.status] || audit.status,
      audit.totalItems,
      audit.matchedItems,
      audit.discrepancyItems,
      audit.createdBy?.name || "",
      audit.completedAt ? new Date(audit.completedAt).toLocaleDateString("ko-KR") : "",
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
    link.download = `audit_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("파일이 다운로드되었습니다.");
  };

  const filteredAudits = useMemo(() => {
    if (!audits) return [];
    return audits.filter((audit) => {
      const matchesSearch = audit.auditCode.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === "ALL" || audit.auditType === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [audits, searchTerm, typeFilter]);

  // TanStack Table 설정
  const table = useReactTable({
    data: filteredAudits,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode,
    enableColumnResizing: true,
  });

  const inProgressCount = audits?.filter((a) => a.status === "IN_PROGRESS").length || 0;
  const completedCount = audits?.filter((a) => a.status === "COMPLETED").length || 0;
  const discrepancyCount = audits?.reduce((sum, a) => sum + (a.discrepancyItems || 0), 0) || 0;

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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">실사 관리</h1>
          <p className="text-[var(--text-secondary)]">
            재고 실사를 계획하고 불일치 항목을 관리합니다.
          </p>
        </div>
        {can("inventory", "create") && (
          <button onClick={handleCreate} className="btn btn-primary btn-lg">
            <Plus className="w-5 h-5" />
            실사 생성
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--warning)]/10 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-[var(--warning)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">진행중</p>
              <p className="text-xl font-bold text-[var(--warning)]">{inProgressCount}</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--success)]/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-[var(--success)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">완료</p>
              <p className="text-xl font-bold text-[var(--success)]">{completedCount}</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--danger)]/10 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-[var(--danger)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">불일치 항목</p>
              <p className="text-xl font-bold text-[var(--danger)]">{discrepancyCount}</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--primary)]/10 rounded-lg flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">총 실사</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">{audits?.length || 0}</p>
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
              placeholder="실사코드로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input input-with-icon w-full"
              autoComplete="off"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input"
            >
              <option value="ALL">모든 유형</option>
              <option value="MONTHLY">월간 실사</option>
              <option value="QUARTERLY">분기 실사</option>
              <option value="YEARLY">연간 실사</option>
              <option value="SPOT">비정기 실사</option>
            </select>
            {can("inventory", "export") && (
              <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
                <Download className="w-4 h-4" />
                내보내기
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Audits Table - TanStack Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full tanstack-table" style={{ minWidth: table.getCenterTotalSize() }}>
            <thead className="border-b border-[var(--glass-border)] bg-[var(--glass-bg)]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="relative px-3 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap border-r border-[var(--glass-border)] last:border-r-0"
                      style={{ width: header.getSize() }}
                    >
                      <div
                        className={`flex items-center gap-1 ${
                          header.column.getCanSort() ? "cursor-pointer select-none hover:text-[var(--text-primary)]" : ""
                        }`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span className="text-[var(--text-muted)]">
                            {header.column.getIsSorted() === "asc" ? (
                              <ArrowUp className="w-3 h-3" />
                            ) : header.column.getIsSorted() === "desc" ? (
                              <ArrowDown className="w-3 h-3" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-50" />
                            )}
                          </span>
                        )}
                      </div>
                      {/* 컬럼 리사이즈 핸들 */}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-[var(--primary)] ${
                            header.column.getIsResizing() ? "bg-[var(--primary)]" : "bg-transparent"
                          }`}
                        />
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-[var(--glass-border)]">
              {filteredAudits.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center">
                    <ClipboardCheck className="w-12 h-12 mx-auto mb-2 text-[var(--text-muted)]" />
                    <p className="text-[var(--text-muted)]">
                      {searchTerm ? "검색 결과가 없습니다." : "실사 기록이 없습니다."}
                    </p>
                    {!searchTerm && can("inventory", "create") && (
                      <button
                        onClick={handleCreate}
                        className="mt-4 text-[var(--primary)] hover:underline"
                      >
                        첫 번째 실사 생성하기
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-[var(--glass-bg)] transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-3 py-3 text-sm border-r border-[var(--glass-border)] last:border-r-0"
                        style={{ width: cell.column.getSize() }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* 테이블 하단 안내 */}
        {filteredAudits.length > 0 && (
          <div className="px-4 py-2 border-t border-[var(--glass-border)] bg-[var(--glass-bg)]/50 text-xs text-[var(--text-muted)]">
            헤더 경계를 드래그하여 컬럼 너비 조절 | 헤더 클릭으로 정렬
          </div>
        )}
      </div>

      {/* Audit Form Modal */}
      <AuditForm
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setSelectedAudit(null);
        }}
        onSubmit={handleFormSubmit}
        initialData={selectedAudit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedAudit(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="실사 삭제"
        message={`"${selectedAudit?.auditCode}" 실사를 삭제하시겠습니까?`}
        confirmText="삭제"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* Audit Start Guide Modal */}
      <Modal
        isOpen={showGuideModal}
        onClose={() => {
          setShowGuideModal(false);
          setSelectedAudit(null);
        }}
        title="실사가 시작되었습니다"
        size="lg"
      >
        <div className="space-y-6">
          {/* Header Info */}
          <div className="bg-[var(--primary)]/10 rounded-lg p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-[var(--primary)] mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-[var(--text-primary)]">
                {selectedAudit?.auditCode} 실사가 시작되었습니다.
              </p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                아래 안내에 따라 실사를 진행해 주세요.
              </p>
            </div>
          </div>

          {/* Step Guide */}
          <div className="space-y-4">
            <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <FileText className="w-5 h-5" />
              실사 진행 단계
            </h3>

            <div className="space-y-3">
              {/* Step 1 */}
              <div className="flex items-start gap-3 p-3 rounded-lg border border-[var(--glass-border)] hover:bg-[var(--glass-bg)] transition-colors">
                <div className="w-8 h-8 bg-[var(--primary)] text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm">
                  1
                </div>
                <div>
                  <p className="font-medium text-[var(--text-primary)]">재고 품목 확인</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    실사 대상 품목 목록을 확인하고 실제 재고 위치를 파악합니다.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3 p-3 rounded-lg border border-[var(--glass-border)] hover:bg-[var(--glass-bg)] transition-colors">
                <div className="w-8 h-8 bg-[var(--primary)] text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm">
                  2
                </div>
                <div>
                  <p className="font-medium text-[var(--text-primary)]">실제 수량 입력</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    각 품목의 실제 수량을 확인하여 시스템에 입력합니다. 상세 페이지에서 품목별 수량을 기록할 수 있습니다.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3 p-3 rounded-lg border border-[var(--glass-border)] hover:bg-[var(--glass-bg)] transition-colors">
                <div className="w-8 h-8 bg-[var(--primary)] text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm">
                  3
                </div>
                <div>
                  <p className="font-medium text-[var(--text-primary)]">불일치 항목 처리</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    시스템 수량과 실제 수량이 다른 경우, 원인을 파악하고 조정 사유를 기록합니다.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex items-start gap-3 p-3 rounded-lg border border-[var(--glass-border)] hover:bg-[var(--glass-bg)] transition-colors">
                <div className="w-8 h-8 bg-[var(--success)] text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm">
                  4
                </div>
                <div>
                  <p className="font-medium text-[var(--text-primary)]">실사 완료</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    모든 품목의 실사가 완료되면 상태를 &apos;완료&apos;로 변경합니다. 필요시 관리자 승인을 요청합니다.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--glass-border)]">
            <button
              onClick={() => {
                setShowGuideModal(false);
                setSelectedAudit(null);
              }}
              className="btn-secondary"
            >
              나중에 하기
            </button>
            <button
              onClick={() => {
                if (selectedAudit?.id) {
                  setShowGuideModal(false);
                  // Navigate to audit detail page
                  window.location.href = `/audit/${selectedAudit.id}`;
                }
              }}
              className="btn-primary flex items-center gap-2"
              disabled={!selectedAudit?.id}
            >
              실사 시작하기
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

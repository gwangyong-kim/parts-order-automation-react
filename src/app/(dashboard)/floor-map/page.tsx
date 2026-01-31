"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import {
  Map,
  Search,
  Package,
  MapPin,
  X,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  Play,
  ChevronRight,
  Loader2,
  ScanLine,
  AlertTriangle,
  Flag,
  CheckSquare,
  Square,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";
import WarehouseMap from "@/components/warehouse/WarehouseMap";
import type { WarehouseLayout, LocationLookup, PickingTask, PickingItem, PickingLocationInfo } from "@/types/warehouse";

interface ActivePickingData {
  tasks: PickingTask[];
  locationSummary: Record<string, PickingLocationInfo>;
}

async function fetchWarehouseLayout(warehouseId: number): Promise<WarehouseLayout> {
  const res = await fetch(`/api/warehouse/${warehouseId}/layout`);
  if (!res.ok) throw new Error("Failed to fetch warehouse layout");
  return res.json();
}

async function fetchWarehouses() {
  const res = await fetch("/api/warehouse");
  if (!res.ok) throw new Error("Failed to fetch warehouses");
  return res.json();
}

async function lookupLocation(code: string): Promise<LocationLookup> {
  const res = await fetch(`/api/locations?code=${encodeURIComponent(code)}`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Location not found");
  }
  return res.json();
}

async function fetchPickingTasks(): Promise<PickingTask[]> {
  const res = await fetch("/api/picking-tasks?status=PENDING&status=IN_PROGRESS");
  if (!res.ok) throw new Error("Failed to fetch picking tasks");
  return res.json();
}

async function fetchActivePickingData(): Promise<ActivePickingData> {
  const res = await fetch("/api/picking-tasks/active");
  if (!res.ok) throw new Error("Failed to fetch active picking data");
  return res.json();
}

async function updatePickingItem(itemId: number, action: string, data?: Record<string, unknown>) {
  const res = await fetch(`/api/picking-items/${itemId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...data }),
  });
  if (!res.ok) throw new Error("Failed to update picking item");
  return res.json();
}

async function startPickingTask(taskId: number) {
  const res = await fetch(`/api/picking-tasks/${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "IN_PROGRESS", startedAt: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error("Failed to start picking task");
  return res.json();
}

type WorkflowStep = "navigate" | "scan" | "verify";

interface FlagIssueData {
  type: "stock_mismatch" | "damaged" | "wrong_location" | "other";
  notes: string;
}

export default function FloorMapPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const taskIdParam = searchParams.get("task");
  const scanInputRef = useRef<HTMLInputElement>(null);

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightLocation, setHighlightLocation] = useState<string | undefined>();
  const [locationInfo, setLocationInfo] = useState<LocationLookup | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<PickingTask | null>(null);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);

  // Workflow states
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>("navigate");
  const [scanInput, setScanInput] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanned, setIsScanned] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  // Flag issue modal
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagData, setFlagData] = useState<FlagIssueData>({ type: "stock_mismatch", notes: "" });

  // 피킹 위치 선택 상태
  const [selectedPickingLocation, setSelectedPickingLocation] = useState<string | null>(null);
  const [selectedPickingInfo, setSelectedPickingInfo] = useState<PickingLocationInfo | null>(null);

  const { data: warehouses, isLoading: warehousesLoading } = useQuery({
    queryKey: ["warehouses"],
    queryFn: fetchWarehouses,
  });

  const activeWarehouseId = selectedWarehouseId || warehouses?.[0]?.id;

  const { data: layout, isLoading: layoutLoading } = useQuery({
    queryKey: ["warehouse-layout", activeWarehouseId],
    queryFn: () => fetchWarehouseLayout(activeWarehouseId!),
    enabled: !!activeWarehouseId,
  });

  const { data: pickingTasks } = useQuery({
    queryKey: ["picking-tasks-active"],
    queryFn: fetchPickingTasks,
    refetchInterval: 10000,
  });

  // 피킹 위치 시각화를 위한 데이터 조회
  const { data: activePickingData } = useQuery({
    queryKey: ["active-picking-data"],
    queryFn: fetchActivePickingData,
    refetchInterval: 5000,
  });

  const pickItemMutation = useMutation({
    mutationFn: ({ itemId, action, data }: { itemId: number; action: string; data?: Record<string, unknown> }) =>
      updatePickingItem(itemId, action, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["picking-tasks-active"] });
    },
  });

  const startTaskMutation = useMutation({
    mutationFn: startPickingTask,
    onSuccess: (updatedTask) => {
      setActiveTask(updatedTask);
      queryClient.invalidateQueries({ queryKey: ["picking-tasks-active"] });
    },
  });

  // Reset workflow when item changes
  useEffect(() => {
    setWorkflowStep("navigate");
    setIsScanned(false);
    setIsVerified(false);
    setScanInput("");
    setScanError(null);
  }, [currentItemIndex, activeTask?.id]);

  // Focus scan input when step changes to scan
  useEffect(() => {
    if (workflowStep === "scan" && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [workflowStep]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearchError(null);
    setLocationInfo(null);

    try {
      const info = await lookupLocation(searchTerm.trim().toUpperCase());
      setLocationInfo(info);
      setHighlightLocation(info.locationCode);

      if (info.warehouse.id !== activeWarehouseId) {
        setSelectedWarehouseId(info.warehouse.id);
      }
    } catch (error) {
      setSearchError((error as Error).message);
      setHighlightLocation(undefined);
    }
  };

  const handleLocationClick = async (locationCode: string) => {
    setSearchTerm(locationCode);
    try {
      const info = await lookupLocation(locationCode);
      setLocationInfo(info);
      setHighlightLocation(locationCode);
      setSearchError(null);
    } catch (error) {
      setSearchError((error as Error).message);
    }
  };

  const clearSearch = () => {
    setSearchTerm("");
    setHighlightLocation(undefined);
    setLocationInfo(null);
    setSearchError(null);
    setSelectedPickingLocation(null);
    setSelectedPickingInfo(null);
  };

  // 피킹 위치 클릭 핸들러
  const handlePickingLocationClick = (locationCode: string, pickingInfo: PickingLocationInfo) => {
    setSelectedPickingLocation(locationCode);
    setSelectedPickingInfo(pickingInfo);
    setHighlightLocation(locationCode);
    // 기존 위치 정보 초기화
    setLocationInfo(null);
  };

  const handleStartTask = useCallback((task: PickingTask) => {
    if (task.status === "PENDING") {
      startTaskMutation.mutate(task.id);
    } else {
      setActiveTask(task);
    }
    setCurrentItemIndex(0);
    setWorkflowStep("navigate");
    const firstPendingItem = task.items?.find((item) => item.status === "PENDING" || item.status === "IN_PROGRESS");
    if (firstPendingItem) {
      setHighlightLocation(firstPendingItem.storageLocation);
    }
  }, [startTaskMutation]);

  // URL 파라미터로 작업 자동 선택
  useEffect(() => {
    if (taskIdParam && pickingTasks && !activeTask) {
      const task = pickingTasks.find(t => t.id === parseInt(taskIdParam));
      if (task) {
        handleStartTask(task);
      }
    }
  }, [taskIdParam, pickingTasks, activeTask, handleStartTask]);

  const handleScanSubmit = () => {
    const currentItem = activeTask?.items?.[currentItemIndex];
    if (!currentItem) return;

    const scannedCode = scanInput.trim().toUpperCase();
    if (scannedCode === currentItem.storageLocation) {
      setIsScanned(true);
      setScanError(null);
      setWorkflowStep("verify");
      // Update item status to scanned
      pickItemMutation.mutate({ itemId: currentItem.id, action: "scan" });
    } else {
      setScanError(`위치 불일치: ${scannedCode} ≠ ${currentItem.storageLocation}`);
    }
  };

  const handleVerify = () => {
    setIsVerified(true);
  };

  const handlePickItem = () => {
    const currentItem = activeTask?.items?.[currentItemIndex];
    if (!currentItem) return;

    pickItemMutation.mutate(
      { itemId: currentItem.id, action: "pick", data: { pickedQty: currentItem.requiredQty } },
      {
        onSuccess: () => {
          moveToNextItem();
        },
      }
    );
  };

  const handleSkipItem = () => {
    const currentItem = activeTask?.items?.[currentItemIndex];
    if (!currentItem) return;

    pickItemMutation.mutate(
      { itemId: currentItem.id, action: "skip" },
      {
        onSuccess: () => {
          moveToNextItem();
        },
      }
    );
  };

  const handleFlagIssue = () => {
    const currentItem = activeTask?.items?.[currentItemIndex];
    if (!currentItem) return;

    pickItemMutation.mutate(
      {
        itemId: currentItem.id,
        action: "flag",
        data: { flagType: flagData.type, notes: flagData.notes }
      },
      {
        onSuccess: () => {
          setShowFlagModal(false);
          setFlagData({ type: "stock_mismatch", notes: "" });
          moveToNextItem();
        },
      }
    );
  };

  const moveToNextItem = () => {
    if (activeTask?.items) {
      const nextIndex = currentItemIndex + 1;
      if (nextIndex < activeTask.items.length) {
        setCurrentItemIndex(nextIndex);
        setHighlightLocation(activeTask.items[nextIndex].storageLocation);
      } else {
        setActiveTask(null);
        setHighlightLocation(undefined);
      }
    }
  };

  const navigateToItem = (index: number) => {
    if (activeTask?.items && index < activeTask.items.length) {
      setCurrentItemIndex(index);
      setHighlightLocation(activeTask.items[index].storageLocation);
    }
  };

  if (warehousesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!warehouses || warehouses.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Map className="w-8 h-8 text-[var(--primary)]" />
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Warehouse Map</h1>
            <p className="text-[var(--text-secondary)]">창고 레이아웃 및 피킹 작업</p>
          </div>
        </div>

        <div className="glass-card p-8 text-center">
          <Map className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)]" />
          <p className="text-[var(--text-muted)] mb-4">등록된 창고가 없습니다.</p>
          <a href="/warehouse" className="text-[var(--primary)] hover:underline">
            창고 관리로 이동하여 창고를 등록하세요
          </a>
        </div>
      </div>
    );
  }

  const currentItem = activeTask?.items?.[currentItemIndex];
  const pendingTasks = pickingTasks?.filter((t) => t.status === "PENDING" || t.status === "IN_PROGRESS") || [];

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Map className="w-7 h-7 text-[var(--primary)]" />
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">창고 맵</h1>
            <p className="text-sm text-[var(--text-secondary)]">창고 레이아웃 및 피킹 작업</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {warehouses.length > 1 && (
            <select
              value={activeWarehouseId || ""}
              onChange={(e) => setSelectedWarehouseId(Number(e.target.value))}
              className="input text-sm"
            >
              {warehouses.map((wh: { id: number; name: string; code: string }) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} ({wh.code})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-card p-2 flex-shrink-0">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="위치 코드로 검색 (예: A-01-02)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="input input-with-icon w-full text-sm py-2"
              autoComplete="off"
            />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-[var(--gray-200)] rounded"
              >
                <X className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            )}
          </div>
          <button onClick={handleSearch} className="btn btn-primary text-sm py-2">
            <MapPin className="w-4 h-4" />
            찾기
          </button>
        </div>
        {searchError && <p className="mt-1 text-xs text-[var(--danger)]">{searchError}</p>}
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">
        {/* Left: Map (expanded) */}
        <div className="col-span-9 glass-card p-2 flex flex-col min-h-0">
          {layoutLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : layout ? (
            <WarehouseMap
              layout={layout}
              highlightLocation={highlightLocation}
              onLocationClick={handleLocationClick}
              showPartCounts
              className="flex-1"
              fullHeight
              pickingMode={!!activePickingData?.locationSummary && Object.keys(activePickingData.locationSummary).length > 0}
              activePickingLocations={activePickingData?.locationSummary}
              onPickingLocationClick={handlePickingLocationClick}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
              레이아웃을 불러올 수 없습니다
            </div>
          )}
        </div>

        {/* Right: Picking Workflow / Location Info */}
        <div className="col-span-3 glass-card p-3 flex flex-col min-h-0 overflow-hidden">
          {activeTask && currentItem ? (
            <div className="flex flex-col h-full">
              {/* Active Task Header */}
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setActiveTask(null);
                      setCurrentItemIndex(0);
                      setWorkflowStep("navigate");
                      setIsScanned(false);
                      setIsVerified(false);
                      setHighlightLocation(undefined);
                    }}
                    className="p-1 hover:bg-[var(--gray-100)] rounded transition-colors"
                    title="작업 목록으로 돌아가기"
                  >
                    <ArrowLeft className="w-4 h-4 text-[var(--text-muted)]" />
                  </button>
                  <span className="px-2 py-0.5 bg-[var(--primary)] text-white text-[10px] font-medium rounded">
                    ACTIVE TASK
                  </span>
                </div>
                <span className="text-xs text-[var(--text-muted)]">
                  {currentItemIndex + 1}/{activeTask.items?.length || 0} Items
                </span>
              </div>

              {/* Task Info */}
              <div className="mb-3 flex-shrink-0">
                <p className="font-semibold text-sm">{activeTask.taskCode}</p>
                {activeTask.salesOrder && (
                  <p className="text-xs text-[var(--text-muted)]">
                    {activeTask.salesOrder.project || activeTask.salesOrder.orderCode}
                  </p>
                )}
              </div>

              {/* Progress Bar */}
              <div className="mb-4 flex-shrink-0">
                <div className="h-1.5 bg-[var(--gray-200)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--primary)] transition-all duration-300"
                    style={{
                      width: `${((activeTask.items?.filter((i) => i.status === "PICKED" || i.status === "SKIPPED").length || 0) / (activeTask.items?.length || 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Next Step Card */}
              <div className="p-3 bg-[var(--info-50)] border border-[var(--info-200)] rounded-xl mb-4 flex-shrink-0">
                <p className="text-[10px] font-semibold text-[var(--info-600)] mb-1">NEXT STEP</p>
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 bg-[var(--primary)] rounded-full flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-lg text-[var(--text-primary)]">{currentItem.storageLocation}</p>
                    <p className="text-xs text-[var(--text-muted)]">맵에서 파란색 위치로 이동</p>
                  </div>
                </div>
              </div>

              {/* Action Checklist */}
              <div className="mb-4 flex-shrink-0">
                <p className="text-[10px] font-semibold text-[var(--text-secondary)] mb-2">ACTION CHECKLIST</p>

                {/* Step 1: Scan */}
                <div className="mb-2">
                  <button
                    onClick={() => !isScanned && setWorkflowStep("scan")}
                    disabled={isScanned}
                    className={`w-full p-3 rounded-lg flex items-center gap-3 transition-all ${
                      isScanned
                        ? "bg-[var(--success-100)] border border-[var(--success-200)]"
                        : workflowStep === "scan"
                          ? "bg-[var(--primary)] text-white"
                          : "bg-white border border-[var(--gray-200)] hover:border-[var(--primary)]"
                    }`}
                  >
                    {isScanned ? (
                      <CheckSquare className="w-5 h-5 text-[var(--success-600)]" />
                    ) : (
                      <ScanLine className={`w-5 h-5 ${workflowStep === "scan" ? "text-white" : "text-[var(--primary)]"}`} />
                    )}
                    <span className={`text-sm font-medium ${isScanned ? "text-[var(--success-600)]" : ""}`}>
                      {currentItem.storageLocation} 스캔
                    </span>
                  </button>

                  {/* Scan Input */}
                  {workflowStep === "scan" && !isScanned && (
                    <div className="mt-2 p-2 bg-[var(--gray-50)] rounded-lg">
                      <div className="flex gap-2">
                        <input
                          ref={scanInputRef}
                          type="text"
                          placeholder="위치 코드 스캔/입력"
                          value={scanInput}
                          onChange={(e) => setScanInput(e.target.value.toUpperCase())}
                          onKeyDown={(e) => e.key === "Enter" && handleScanSubmit()}
                          className="input text-sm flex-1"
                          autoComplete="off"
                        />
                        <button onClick={handleScanSubmit} className="btn btn-primary text-sm">
                          확인
                        </button>
                      </div>
                      {scanError && (
                        <p className="mt-1 text-xs text-[var(--danger)] flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {scanError}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Step 2: Verify Quantity */}
                <button
                  onClick={handleVerify}
                  disabled={!isScanned || isVerified}
                  className={`w-full p-3 rounded-lg flex items-center gap-3 transition-all ${
                    isVerified
                      ? "bg-[var(--success-100)] border border-[var(--success-200)]"
                      : isScanned
                        ? "bg-white border border-[var(--gray-200)] hover:border-[var(--primary)]"
                        : "bg-[var(--gray-50)] border border-[var(--gray-200)] opacity-50 cursor-not-allowed"
                  }`}
                >
                  {isVerified ? (
                    <CheckSquare className="w-5 h-5 text-[var(--success-600)]" />
                  ) : (
                    <Square className={`w-5 h-5 ${isScanned ? "text-[var(--text-muted)]" : "text-[var(--gray-300)]"}`} />
                  )}
                  <span className={`text-sm font-medium ${isVerified ? "text-[var(--success-600)]" : isScanned ? "" : "text-[var(--text-muted)]"}`}>
                    수량 확인 ({currentItem.requiredQty.toLocaleString()} {currentItem.part?.unit})
                  </span>
                </button>
              </div>

              {/* Part Info */}
              <div className="p-3 bg-white rounded-lg border border-[var(--gray-200)] mb-4 flex-shrink-0">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">파츠</p>
                    <p className="font-medium text-sm text-[var(--primary)]">{currentItem.part?.partCode}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{currentItem.part?.partName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[var(--text-muted)]">수량</p>
                    <p className="text-xl font-bold">{currentItem.requiredQty}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-auto flex-shrink-0">
                <button
                  onClick={() => setShowFlagModal(true)}
                  className="flex-1 btn btn-secondary text-xs py-2 flex items-center justify-center gap-1"
                >
                  <Flag className="w-3 h-3" />
                  문제 신고
                </button>
                <button
                  onClick={handleSkipItem}
                  disabled={pickItemMutation.isPending}
                  className="flex-1 btn btn-secondary text-xs py-2"
                >
                  건너뛰기
                </button>
              </div>
              <button
                onClick={handlePickItem}
                disabled={!isVerified || pickItemMutation.isPending}
                className={`w-full mt-2 btn text-sm py-2.5 flex items-center justify-center gap-2 ${
                  isVerified ? "btn-primary" : "btn-secondary opacity-50 cursor-not-allowed"
                }`}
              >
                {pickItemMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    피킹 완료
                  </>
                )}
              </button>
            </div>
          ) : selectedPickingLocation && selectedPickingInfo ? (
            // 피킹 위치 정보 모드
            <>
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedPickingLocation(null);
                      setSelectedPickingInfo(null);
                      setHighlightLocation(undefined);
                    }}
                    className="p-1 hover:bg-[var(--gray-100)] rounded transition-colors"
                    title="목록으로 돌아가기"
                  >
                    <ArrowLeft className="w-4 h-4 text-[var(--text-muted)]" />
                  </button>
                  <h2 className="text-xs font-semibold text-[var(--text-primary)]">피킹 정보</h2>
                </div>
                <button
                  onClick={() => {
                    setSelectedPickingLocation(null);
                    setSelectedPickingInfo(null);
                    setHighlightLocation(undefined);
                  }}
                  className="p-1 hover:bg-[var(--gray-100)] rounded"
                >
                  <X className="w-4 h-4 text-[var(--text-muted)]" />
                </button>
              </div>

              <div className="space-y-3 overflow-y-auto flex-1">
                {/* 위치 코드 */}
                <div className="p-3 bg-[var(--primary)]/10 rounded-lg">
                  <p className="text-[10px] text-[var(--text-muted)]">위치 코드</p>
                  <p className="text-xl font-bold text-[var(--primary)]">{selectedPickingLocation}</p>
                </div>

                {/* 작업 정보 */}
                <div className="p-2 bg-[var(--info-50)] rounded-lg">
                  <p className="text-[10px] text-[var(--text-muted)]">피킹 작업</p>
                  <p className="text-sm font-medium">{selectedPickingInfo.taskCode}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    selectedPickingInfo.status === "completed"
                      ? "bg-[var(--success-100)] text-[var(--success-600)]"
                      : selectedPickingInfo.status === "in_progress"
                      ? "bg-[var(--info-100)] text-[var(--info-600)]"
                      : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {selectedPickingInfo.status === "completed" ? "완료" :
                     selectedPickingInfo.status === "in_progress" ? "진행중" : "대기"}
                  </span>
                </div>

                {/* 진행률 */}
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-[var(--text-muted)]">피킹 진행률</span>
                    <span className="font-medium">{selectedPickingInfo.totalPicked}/{selectedPickingInfo.totalRequired}</span>
                  </div>
                  <div className="h-2 bg-[var(--gray-200)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--primary)] transition-all"
                      style={{ width: `${(selectedPickingInfo.totalPicked / selectedPickingInfo.totalRequired) * 100}%` }}
                    />
                  </div>
                </div>

                {/* 피킹 아이템 목록 */}
                <div className="pt-3 border-t border-[var(--glass-border)]">
                  <p className="text-[10px] font-medium text-[var(--text-secondary)] mb-2">피킹 아이템</p>
                  <div className="space-y-1.5">
                    {selectedPickingInfo.items.map((item) => (
                      <div key={item.id} className="p-2 bg-white rounded-lg border border-[var(--gray-200)]">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-xs">{item.partCode}</p>
                            <p className="text-[10px] text-[var(--text-secondary)]">{item.partName}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm">{item.pickedQty}/{item.requiredQty}</p>
                            <p className="text-[10px] text-[var(--text-muted)]">{item.unit}</p>
                          </div>
                        </div>
                        <span className={`text-[8px] px-1 py-0.5 rounded mt-1 inline-block ${
                          item.status === "PICKED" ? "bg-[var(--success-100)] text-[var(--success-600)]" :
                          item.status === "IN_PROGRESS" ? "bg-[var(--info-100)] text-[var(--info-600)]" :
                          item.status === "SKIPPED" ? "bg-[var(--gray-100)] text-[var(--text-muted)]" :
                          "bg-yellow-100 text-yellow-700"
                        }`}>
                          {item.status === "PICKED" ? "피킹완료" :
                           item.status === "IN_PROGRESS" ? "진행중" :
                           item.status === "SKIPPED" ? "건너뜀" : "대기"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 피킹 작업 이동 버튼 */}
                <a
                  href={`/picking/${selectedPickingInfo.taskId}`}
                  className="btn btn-primary w-full text-sm py-2 flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  피킹 작업으로 이동
                </a>
              </div>
            </>
          ) : (
            // Location Info Mode
            <>
              <h2 className="text-xs font-semibold text-[var(--text-primary)] mb-3 flex-shrink-0">위치 정보</h2>

              {locationInfo ? (
                <div className="space-y-3 overflow-y-auto flex-1">
                  <div className="p-3 bg-[var(--primary)]/10 rounded-lg">
                    <p className="text-[10px] text-[var(--text-muted)]">위치 코드</p>
                    <p className="text-xl font-bold text-[var(--primary)]">{locationInfo.locationCode}</p>
                  </div>

                  <div>
                    <p className="text-[10px] text-[var(--text-muted)]">Zone / 랙</p>
                    <p className="text-sm font-medium">
                      {locationInfo.zone.name} / Row {locationInfo.rack.rowNumber}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[var(--glass-border)]">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-medium text-[var(--text-secondary)]">보관 파츠</p>
                      <span className="text-[10px] px-1.5 py-0.5 bg-[var(--info-100)] text-[var(--info-600)] rounded">
                        {locationInfo.partCount}개
                      </span>
                    </div>

                    {locationInfo.parts.length > 0 ? (
                      <div className="space-y-1.5">
                        {locationInfo.parts.map((part) => (
                          <div key={part.id} className="p-2 bg-white rounded-lg border border-[var(--gray-200)]">
                            <div className="flex items-start justify-between">
                              <div>
                                <a href={`/parts/${part.id}`} className="font-medium text-[var(--primary)] hover:underline text-xs">
                                  {part.partCode}
                                </a>
                                <p className="text-[10px] text-[var(--text-secondary)]">{part.partName}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-sm">{part.currentQty}</p>
                                <p className="text-[10px] text-[var(--text-muted)]">{part.unit}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-3 text-[var(--text-muted)]">
                        <Package className="w-5 h-5 mx-auto mb-1 opacity-50" />
                        <p className="text-[10px]">파츠 없음</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* 피킹 작업 목록 */}
                  {pendingTasks.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between mb-2 flex-shrink-0">
                        <h3 className="text-[10px] font-semibold text-[var(--text-secondary)] flex items-center gap-1">
                          <ClipboardList className="w-3 h-3" />
                          피킹 작업
                        </h3>
                        <span className="text-[10px] px-1.5 py-0.5 bg-[var(--info-100)] text-[var(--info-600)] rounded">
                          {pendingTasks.length}개
                        </span>
                      </div>
                      <div className="space-y-1.5 overflow-y-auto flex-1">
                        {pendingTasks.map((task) => (
                          <button
                            key={task.id}
                            onClick={() => handleStartTask(task)}
                            className={`w-full p-2 rounded-lg text-left transition-all ${
                              activeTask?.id === task.id
                                ? "bg-[var(--primary)] text-white"
                                : "bg-white hover:bg-[var(--gray-100)] border border-[var(--gray-200)]"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[10px] font-mono">{task.taskCode}</span>
                              <span
                                className={`text-[10px] px-1 py-0.5 rounded ${
                                  task.status === "IN_PROGRESS"
                                    ? activeTask?.id === task.id
                                      ? "bg-white/20 text-white"
                                      : "bg-[var(--info-100)] text-[var(--info-600)]"
                                    : activeTask?.id === task.id
                                      ? "bg-white/20 text-white"
                                      : "bg-[var(--gray-100)] text-[var(--text-muted)]"
                                }`}
                              >
                                {task.status === "IN_PROGRESS" ? "진행" : "대기"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] ${activeTask?.id === task.id ? "text-white/80" : "text-[var(--text-muted)]"}`}>
                                {task.pickedItems}/{task.totalItems} 항목
                              </span>
                              <ChevronRight className="w-3 h-3 opacity-50" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-center text-[var(--text-muted)]">
                      <div>
                        <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">위치를 검색하거나</p>
                        <p className="text-xs">맵에서 클릭하세요</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bottom: Task Item List Table */}
      {activeTask && activeTask.items && activeTask.items.length > 0 && (
        <div className="flex-shrink-0 glass-card p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Task Item List ({activeTask.taskCode})
            </h3>
            <span className="text-[10px] text-[var(--text-muted)]">
              {activeTask.items.filter(i => i.status === "PICKED").length} / {activeTask.items.length} 완료
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--gray-200)]">
                  <th className="text-left py-2 px-3 text-[10px] font-medium text-[var(--text-muted)] uppercase">BIN Location</th>
                  <th className="text-left py-2 px-3 text-[10px] font-medium text-[var(--text-muted)] uppercase">Item Description</th>
                  <th className="text-center py-2 px-3 text-[10px] font-medium text-[var(--text-muted)] uppercase">Pick Qty</th>
                  <th className="text-center py-2 px-3 text-[10px] font-medium text-[var(--text-muted)] uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {activeTask.items.map((item, idx) => (
                  <tr
                    key={item.id}
                    onClick={() => navigateToItem(idx)}
                    className={`border-b border-[var(--gray-100)] cursor-pointer transition-colors ${
                      idx === currentItemIndex
                        ? "bg-[var(--primary)]/5"
                        : "hover:bg-[var(--gray-50)]"
                    }`}
                  >
                    <td className="py-2 px-3">
                      <span className={`font-mono ${idx === currentItemIndex ? "text-[var(--primary)] font-semibold" : ""}`}>
                        {item.storageLocation}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <div>
                        <p className="font-medium">{item.part?.partCode}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">{item.part?.partName}</p>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-center font-bold">{item.requiredQty}</td>
                    <td className="py-2 px-3 text-center">
                      {idx === currentItemIndex ? (
                        <span className="px-2 py-0.5 bg-[var(--primary)] text-white text-[10px] rounded-full">
                          NEXT UP
                        </span>
                      ) : item.status === "PICKED" ? (
                        <span className="px-2 py-0.5 bg-[var(--success-100)] text-[var(--success-600)] text-[10px] rounded-full flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          PICKED
                        </span>
                      ) : item.status === "SKIPPED" ? (
                        <span className="px-2 py-0.5 bg-[var(--gray-100)] text-[var(--text-muted)] text-[10px] rounded-full">
                          SKIPPED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-[var(--gray-100)] text-[var(--text-muted)] text-[10px] rounded-full">
                          PENDING
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-2 text-right">
            <a href="/picking" className="text-xs text-[var(--primary)] hover:underline flex items-center justify-end gap-1">
              전체 피킹 목록 보기
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* Flag Issue Modal */}
      {showFlagModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Flag className="w-5 h-5 text-[var(--warning-500)]" />
              문제 신고
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--text-secondary)] mb-2 block">문제 유형</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "stock_mismatch", label: "재고 불일치" },
                    { value: "damaged", label: "파손/불량" },
                    { value: "wrong_location", label: "위치 오류" },
                    { value: "other", label: "기타" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setFlagData({ ...flagData, type: option.value as FlagIssueData["type"] })}
                      className={`p-2 rounded-lg border text-sm transition-all ${
                        flagData.type === option.value
                          ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                          : "border-[var(--gray-200)] hover:border-[var(--gray-300)]"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--text-secondary)] mb-2 block">메모</label>
                <textarea
                  value={flagData.notes}
                  onChange={(e) => setFlagData({ ...flagData, notes: e.target.value })}
                  placeholder="상세 내용을 입력하세요..."
                  className="input w-full h-24 resize-none text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowFlagModal(false)}
                className="flex-1 btn btn-secondary"
              >
                취소
              </button>
              <button
                onClick={handleFlagIssue}
                disabled={pickItemMutation.isPending}
                className="flex-1 btn btn-primary flex items-center justify-center gap-2"
              >
                {pickItemMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Flag className="w-4 h-4" />
                    신고하기
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

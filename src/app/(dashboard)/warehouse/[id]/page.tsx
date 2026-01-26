"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Grid3X3,
  Layout,
  Edit2,
  Eye,
  Settings2,
  ClipboardCheck,
} from "lucide-react";
import WarehouseMap from "@/components/warehouse/WarehouseMap";
import PickingInfoPanel from "@/components/warehouse/PickingInfoPanel";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import UsageGuide, {
  LAYOUT_EDIT_GUIDE_SECTIONS,
  LAYOUT_EDIT_GUIDE_TIPS,
  LAYOUT_EDIT_GUIDE_WARNINGS,
} from "@/components/ui/UsageGuide";
import { useToast } from "@/components/ui/Toast";
import type { WarehouseLayout, Zone, Rack, PickingLocationInfo, ActivePickingData } from "@/types/warehouse";

async function fetchWarehouseLayout(id: string): Promise<WarehouseLayout> {
  const res = await fetch(`/api/warehouse/${id}/layout`);
  if (!res.ok) throw new Error("Failed to fetch warehouse layout");
  return res.json();
}

async function createZone(data: Partial<Zone>): Promise<Zone> {
  const res = await fetch("/api/zones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create zone");
  return res.json();
}

async function updateZone(id: number, data: Partial<Zone>): Promise<Zone> {
  const res = await fetch(`/api/zones/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update zone");
  return res.json();
}

async function deleteZone(id: number): Promise<void> {
  const res = await fetch(`/api/zones/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete zone");
}

async function createRack(data: Partial<Rack> & { zoneId: number }): Promise<Rack> {
  const res = await fetch("/api/racks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create rack");
  return res.json();
}

async function updateRack(id: number, data: Partial<Rack>): Promise<Rack> {
  const res = await fetch(`/api/racks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update rack");
  return res.json();
}

async function deleteRack(id: number): Promise<void> {
  const res = await fetch(`/api/racks/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete rack");
}

interface BulkArrangeParams {
  columns: number;
  rows: number | null;
  gapX: number;
  gapY: number;
  startX: number;
  startY: number;
  shelfCount: number | null;
  sortBy: "rowNumber" | "id" | "current";
  arrangeBy: "columns" | "rows";
}

async function bulkArrangeRacks(zoneId: number, params: BulkArrangeParams): Promise<{ message: string }> {
  const res = await fetch(`/api/zones/${zoneId}/bulk-arrange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Failed to bulk arrange racks");
  return res.json();
}

// Phase 2: 활성 피킹 작업 조회
async function fetchActivePickingData(): Promise<ActivePickingData> {
  const res = await fetch("/api/picking-tasks/active");
  if (!res.ok) throw new Error("Failed to fetch active picking data");
  return res.json();
}

// Phase 3: 빠른 피킹 처리
async function quickPickItem(itemId: number, qty: number): Promise<void> {
  // 1. 스캔 처리
  const scanRes = await fetch(`/api/picking-items/${itemId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "scan" }),
  });
  if (!scanRes.ok) throw new Error("Failed to scan item");

  // 2. 피킹 완료 처리
  const pickRes = await fetch(`/api/picking-items/${itemId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "pick", pickedQty: qty }),
  });
  if (!pickRes.ok) throw new Error("Failed to pick item");
}

const ZONE_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#F97316", // Orange
];

export default function WarehouseEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [showRackForm, setShowRackForm] = useState(false);
  const [showDeleteZone, setShowDeleteZone] = useState(false);
  const [showDeleteRack, setShowDeleteRack] = useState(false);
  const [selectedRack, setSelectedRack] = useState<Rack | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isRackEditMode, setIsRackEditMode] = useState(false);
  const [showBulkArrange, setShowBulkArrange] = useState(false);

  // Phase 2: 피킹 모드 상태
  const [pickingMode, setPickingMode] = useState(false);
  const [selectedPickingLocation, setSelectedPickingLocation] = useState<string | null>(null);
  const [selectedPickingInfo, setSelectedPickingInfo] = useState<PickingLocationInfo | null>(null);

  const [bulkArrangeForm, setBulkArrangeForm] = useState({
    columns: 2,
    rows: null as number | null,
    useRows: false,
    gapX: 18,
    gapY: 12,
    startX: 0,
    startY: 0,
    shelfCount: null as number | null,
    updateShelfCount: false,
    sortBy: "rowNumber" as "rowNumber" | "id" | "current",
    arrangeBy: "columns" as "columns" | "rows",
  });

  // zone별 bulk arrange 설정 저장
  const [zoneBulkArrangeSettings, setZoneBulkArrangeSettings] = useState<
    Record<number, typeof bulkArrangeForm>
  >({});

  const [zoneForm, setZoneForm] = useState({
    code: "",
    name: "",
    color: ZONE_COLORS[0],
    posX: 10,
    posY: 10,
    width: 30,
    height: 40,
  });

  const [rackForm, setRackForm] = useState({
    rowNumber: "01",
    posX: 0,
    posY: 0,
    shelfCount: 4,
  });

  const { data: layout, isLoading } = useQuery({
    queryKey: ["warehouse-layout", id],
    queryFn: () => fetchWarehouseLayout(id),
  });

  // Phase 2: 활성 피킹 데이터 조회
  const { data: activePickingData, refetch: refetchPickingData } = useQuery({
    queryKey: ["active-picking-data"],
    queryFn: fetchActivePickingData,
    enabled: pickingMode,
    refetchInterval: pickingMode ? 5000 : false, // 피킹 모드일 때 5초마다 갱신
  });

  const createZoneMutation = useMutation({
    mutationFn: createZone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-layout", id] });
      toast.success("Zone이 추가되었습니다.");
      setShowZoneForm(false);
      resetZoneForm();
    },
    onError: () => toast.error("Zone 추가에 실패했습니다."),
  });

  const updateZoneMutation = useMutation({
    mutationFn: ({ zoneId, data }: { zoneId: number; data: Partial<Zone> }) =>
      updateZone(zoneId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-layout", id] });
      toast.success("Zone이 수정되었습니다.");
      setShowZoneForm(false);
      setIsEditMode(false);
      setSelectedZone(null);
      resetZoneForm();
    },
    onError: () => toast.error("Zone 수정에 실패했습니다."),
  });

  const deleteZoneMutation = useMutation({
    mutationFn: deleteZone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-layout", id] });
      toast.success("Zone이 삭제되었습니다.");
      setShowDeleteZone(false);
      setSelectedZone(null);
    },
    onError: () => toast.error("Zone 삭제에 실패했습니다."),
  });

  const createRackMutation = useMutation({
    mutationFn: createRack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-layout", id] });
      toast.success("Rack이 추가되었습니다.");
      setShowRackForm(false);
      resetRackForm();
    },
    onError: () => toast.error("Rack 추가에 실패했습니다."),
  });

  const updateRackMutation = useMutation({
    mutationFn: ({ rackId, data }: { rackId: number; data: Partial<Rack> }) =>
      updateRack(rackId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-layout", id] });
      toast.success("Rack이 수정되었습니다.");
      setShowRackForm(false);
      setIsRackEditMode(false);
      setSelectedRack(null);
      setSelectedZone(null);
      resetRackForm();
    },
    onError: () => toast.error("Rack 수정에 실패했습니다."),
  });

  const deleteRackMutation = useMutation({
    mutationFn: deleteRack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-layout", id] });
      toast.success("Rack이 삭제되었습니다.");
      setShowDeleteRack(false);
      setSelectedRack(null);
    },
    onError: () => toast.error("Rack 삭제에 실패했습니다."),
  });

  const bulkArrangeMutation = useMutation({
    mutationFn: ({ zoneId, params }: { zoneId: number; params: BulkArrangeParams }) =>
      bulkArrangeRacks(zoneId, params),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-layout", id] });
      toast.success(data.message);
      // 성공 시 현재 설정을 zone별로 저장
      if (selectedZone) {
        setZoneBulkArrangeSettings((prev) => ({
          ...prev,
          [selectedZone.id]: { ...bulkArrangeForm },
        }));
      }
      setShowBulkArrange(false);
      setSelectedZone(null);
    },
    onError: () => toast.error("Rack 일괄 조정에 실패했습니다."),
  });

  // Phase 3: 빠른 피킹 mutation
  const quickPickMutation = useMutation({
    mutationFn: ({ itemId, qty }: { itemId: number; qty: number }) =>
      quickPickItem(itemId, qty),
    onSuccess: () => {
      refetchPickingData();
      queryClient.invalidateQueries({ queryKey: ["picking-tasks"] });
      toast.success("피킹이 완료되었습니다.");
    },
    onError: () => toast.error("피킹 처리에 실패했습니다."),
  });

  // Phase 2: 피킹 위치 클릭 핸들러
  const handlePickingLocationClick = (locationCode: string, pickingInfo: PickingLocationInfo) => {
    setSelectedPickingLocation(locationCode);
    setSelectedPickingInfo(pickingInfo);
  };

  // Phase 3: 빠른 피킹 핸들러
  const handleQuickPick = (itemId: number, qty: number) => {
    quickPickMutation.mutate({ itemId, qty });
  };

  const resetZoneForm = () => {
    const nextCode = String.fromCharCode(
      65 + (layout?.zones?.length || 0)
    );
    setZoneForm({
      code: nextCode,
      name: `Zone ${nextCode}`,
      color: ZONE_COLORS[(layout?.zones?.length || 0) % ZONE_COLORS.length],
      posX: 10 + ((layout?.zones?.length || 0) % 3) * 35,
      posY: 10 + Math.floor((layout?.zones?.length || 0) / 3) * 50,
      width: 30,
      height: 40,
    });
  };

  const resetRackForm = () => {
    const existingRacks = selectedZone?.racks?.length || 0;
    setRackForm({
      rowNumber: String(existingRacks + 1).padStart(2, "0"),
      posX: (existingRacks % 2) * 18,
      posY: Math.floor(existingRacks / 2) * 12,
      shelfCount: 4,
    });
  };

  const handleAddZone = () => {
    setIsEditMode(false);
    setSelectedZone(null);
    resetZoneForm();
    setShowZoneForm(true);
  };

  const handleEditZone = (zone: Zone) => {
    setIsEditMode(true);
    setSelectedZone(zone);
    setZoneForm({
      code: zone.code,
      name: zone.name,
      color: zone.color,
      posX: zone.posX,
      posY: zone.posY,
      width: zone.width,
      height: zone.height,
    });
    setShowZoneForm(true);
  };

  const handleAddRack = (zone: Zone) => {
    setIsRackEditMode(false);
    setSelectedZone(zone);
    setSelectedRack(null);
    const existingRacks = zone.racks?.length || 0;
    setRackForm({
      rowNumber: String(existingRacks + 1).padStart(2, "0"),
      posX: (existingRacks % 2) * 18,
      posY: Math.floor(existingRacks / 2) * 12,
      shelfCount: 4,
    });
    setShowRackForm(true);
  };

  const handleEditRack = (zone: Zone, rack: Rack) => {
    setIsRackEditMode(true);
    setSelectedZone(zone);
    setSelectedRack(rack);
    setRackForm({
      rowNumber: rack.rowNumber,
      posX: rack.posX,
      posY: rack.posY,
      shelfCount: rack.shelfCount,
    });
    setShowRackForm(true);
  };

  const handleBulkArrange = (zone: Zone) => {
    setSelectedZone(zone);

    // 이전 설정이 있으면 불러오기, 없으면 기본값 사용
    const savedSettings = zoneBulkArrangeSettings[zone.id];
    if (savedSettings) {
      setBulkArrangeForm(savedSettings);
    } else {
      const rackCount = zone.racks?.length || 0;
      // 기본값 설정: 열 수는 최대 10개 또는 Rack 수 중 작은 값
      const defaultColumns = Math.min(Math.ceil(Math.sqrt(rackCount)), 10);
      const defaultRows = Math.ceil(rackCount / defaultColumns);
      setBulkArrangeForm({
        columns: defaultColumns,
        rows: defaultRows,
        useRows: false,
        gapX: 18,
        gapY: 12,
        startX: 0,
        startY: 0,
        shelfCount: null,
        updateShelfCount: false,
        sortBy: "rowNumber",
        arrangeBy: "columns",
      });
    }
    setShowBulkArrange(true);
  };

  const handleSubmitBulkArrange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedZone) return;

    bulkArrangeMutation.mutate({
      zoneId: selectedZone.id,
      params: {
        columns: bulkArrangeForm.columns,
        rows: bulkArrangeForm.useRows ? bulkArrangeForm.rows : null,
        gapX: bulkArrangeForm.gapX,
        gapY: bulkArrangeForm.gapY,
        startX: bulkArrangeForm.startX,
        startY: bulkArrangeForm.startY,
        shelfCount: bulkArrangeForm.updateShelfCount ? bulkArrangeForm.shelfCount : null,
        sortBy: bulkArrangeForm.sortBy,
        arrangeBy: bulkArrangeForm.arrangeBy,
      },
    });
  };

  const handleSubmitZone = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditMode && selectedZone) {
      updateZoneMutation.mutate({
        zoneId: selectedZone.id,
        data: zoneForm,
      });
    } else {
      createZoneMutation.mutate({
        warehouseId: parseInt(id),
        ...zoneForm,
      });
    }
  };

  const handleSubmitRack = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRackEditMode && selectedRack) {
      updateRackMutation.mutate({
        rackId: selectedRack.id,
        data: rackForm,
      });
    } else if (selectedZone) {
      createRackMutation.mutate({
        zoneId: selectedZone.id,
        ...rackForm,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!layout) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-[var(--danger)]">창고를 찾을 수 없습니다.</p>
        <Link href="/warehouse" className="text-[var(--primary)] hover:underline">
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

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
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              {layout.name} 레이아웃
            </h1>
            <p className="text-[var(--text-secondary)]">
              Zone 및 Rack 배치를 설정합니다
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <UsageGuide
            title="레이아웃 편집 가이드"
            description="Zone과 Rack 배치 방법을 안내합니다."
            sections={LAYOUT_EDIT_GUIDE_SECTIONS}
            tips={LAYOUT_EDIT_GUIDE_TIPS}
            warnings={LAYOUT_EDIT_GUIDE_WARNINGS}
          />
          {/* Phase 2: 피킹 모드 토글 */}
          <button
            onClick={() => {
              setPickingMode(!pickingMode);
              if (!pickingMode) {
                setPreviewMode(true); // 피킹 모드 활성화 시 미리보기 모드로
              }
              setSelectedPickingLocation(null);
              setSelectedPickingInfo(null);
            }}
            className={`btn-secondary ${pickingMode ? "ring-2 ring-[var(--warning)] bg-yellow-50" : ""}`}
          >
            <ClipboardCheck className="w-4 h-4" />
            {pickingMode ? "피킹 모드 ON" : "피킹 모드"}
          </button>
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`btn-secondary ${previewMode ? "ring-2 ring-[var(--primary)]" : ""}`}
          >
            <Eye className="w-4 h-4" />
            {previewMode ? "편집 모드" : "미리보기"}
          </button>
          <Link href="/floor-map" className="btn btn-primary">
            <Layout className="w-4 h-4" />
            맵 보기
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Zone/Rack List */}
        {!previewMode && (
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Zone 목록
              </h2>
              <button onClick={handleAddZone} className="btn-secondary text-sm">
                <Plus className="w-4 h-4" />
                Zone 추가
              </button>
            </div>

            {layout.zones.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-muted)]">
                <Grid3X3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>등록된 Zone이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {layout.zones.map((zone) => (
                  <div
                    key={zone.id}
                    className="p-4 bg-white rounded-lg border border-[var(--gray-200)]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: zone.color }}
                        />
                        <span className="font-medium">Zone {zone.code}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {zone.racks && zone.racks.length > 0 && (
                          <button
                            onClick={() => handleBulkArrange(zone)}
                            className="p-1 hover:bg-[var(--gray-100)] rounded"
                            title="Rack 일괄 조정"
                          >
                            <Settings2 className="w-4 h-4 text-[var(--text-secondary)]" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEditZone(zone)}
                          className="p-1 hover:bg-[var(--gray-100)] rounded"
                          title="Zone 편집"
                        >
                          <Edit2 className="w-4 h-4 text-[var(--primary)]" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedZone(zone);
                            setShowDeleteZone(true);
                          }}
                          className="p-1 hover:bg-[var(--gray-100)] rounded"
                          title="Zone 삭제"
                        >
                          <Trash2 className="w-4 h-4 text-[var(--danger)]" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] mb-1">
                      {zone.name}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mb-3">
                      위치: ({zone.posX}, {zone.posY}) | 크기: {zone.width} x {zone.height}
                    </p>

                    {/* Racks in Zone */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--text-muted)]">
                          Racks ({zone.racks?.length || 0})
                        </span>
                        <button
                          onClick={() => handleAddRack(zone)}
                          className="text-xs text-[var(--primary)] hover:underline"
                        >
                          + 추가
                        </button>
                      </div>
                      {zone.racks && zone.racks.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {zone.racks.map((rack) => (
                            <div
                              key={rack.id}
                              className="group relative px-2 py-1 bg-[var(--gray-100)] rounded text-xs cursor-pointer hover:bg-[var(--gray-200)]"
                              onClick={() => handleEditRack(zone, rack)}
                              title={`클릭하여 편집 | 위치: (${rack.posX}, ${rack.posY}) | 선반: ${rack.shelfCount}개`}
                            >
                              {zone.code}-{rack.rowNumber}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRack(rack);
                                  setShowDeleteRack(true);
                                }}
                                className="absolute -top-1 -right-1 p-0.5 bg-[var(--danger)] text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-2 h-2" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Map Preview */}
        <div className={`glass-card p-4 ${previewMode && !pickingMode ? "lg:col-span-3" : "lg:col-span-2"}`}>
          <WarehouseMap
            layout={layout}
            showPartCounts={!pickingMode}
            className={previewMode ? "h-[600px]" : ""}
            pickingMode={pickingMode}
            activePickingLocations={activePickingData?.locationSummary}
            onPickingLocationClick={handlePickingLocationClick}
          />
        </div>

        {/* Phase 2: 피킹 정보 패널 */}
        {pickingMode && selectedPickingLocation && (
          <div className="glass-card p-0 lg:col-span-1 h-[600px]">
            <PickingInfoPanel
              locationCode={selectedPickingLocation}
              pickingInfo={selectedPickingInfo}
              onClose={() => {
                setSelectedPickingLocation(null);
                setSelectedPickingInfo(null);
              }}
              onQuickPick={handleQuickPick}
              isLoading={quickPickMutation.isPending}
            />
          </div>
        )}

        {/* 피킹 모드 활성화 상태 표시 */}
        {pickingMode && !selectedPickingLocation && (
          <div className="lg:col-span-1 glass-card p-6 flex items-center justify-center">
            <div className="text-center text-[var(--text-muted)]">
              <ClipboardCheck className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="font-medium mb-2">피킹 모드 활성화</p>
              <p className="text-sm">
                맵에서 피킹 위치를 클릭하여<br />
                피킹 정보를 확인하세요.
              </p>
              {activePickingData?.tasks && activePickingData.tasks.length > 0 && (
                <p className="text-xs mt-4 text-[var(--primary)]">
                  진행 중 작업: {activePickingData.tasks.length}개
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Zone Form Modal */}
      {showZoneForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 animate-scale-in">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">
              {isEditMode ? `Zone ${selectedZone?.code} 편집` : "새 Zone 추가"}
            </h2>

            <form onSubmit={handleSubmitZone} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Zone 코드 *
                  </label>
                  <input
                    type="text"
                    value={zoneForm.code}
                    onChange={(e) =>
                      setZoneForm({ ...zoneForm, code: e.target.value.toUpperCase() })
                    }
                    className="input w-full"
                    placeholder="A"
                    maxLength={2}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    색상
                  </label>
                  <div className="flex gap-1">
                    {ZONE_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setZoneForm({ ...zoneForm, color })}
                        className={`w-6 h-6 rounded ${
                          zoneForm.color === color ? "ring-2 ring-offset-1 ring-[var(--primary)]" : ""
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Zone 이름 *
                </label>
                <input
                  type="text"
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                  className="input w-full"
                  placeholder="Fast Moving"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    위치 X
                  </label>
                  <input
                    type="number"
                    value={zoneForm.posX}
                    onChange={(e) =>
                      setZoneForm({ ...zoneForm, posX: parseInt(e.target.value) || 0 })
                    }
                    className="input w-full"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    위치 Y
                  </label>
                  <input
                    type="number"
                    value={zoneForm.posY}
                    onChange={(e) =>
                      setZoneForm({ ...zoneForm, posY: parseInt(e.target.value) || 0 })
                    }
                    className="input w-full"
                    min={0}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    너비
                  </label>
                  <input
                    type="number"
                    value={zoneForm.width}
                    onChange={(e) =>
                      setZoneForm({ ...zoneForm, width: parseInt(e.target.value) || 20 })
                    }
                    className="input w-full"
                    min={10}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    높이
                  </label>
                  <input
                    type="number"
                    value={zoneForm.height}
                    onChange={(e) =>
                      setZoneForm({ ...zoneForm, height: parseInt(e.target.value) || 20 })
                    }
                    className="input w-full"
                    min={10}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowZoneForm(false);
                    setIsEditMode(false);
                    setSelectedZone(null);
                  }}
                  className="btn-secondary"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createZoneMutation.isPending || updateZoneMutation.isPending}
                >
                  {createZoneMutation.isPending || updateZoneMutation.isPending
                    ? "저장 중..."
                    : isEditMode
                    ? "저장"
                    : "추가"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rack Form Modal */}
      {showRackForm && selectedZone && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 animate-scale-in">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">
              {isRackEditMode
                ? `Rack ${selectedZone.code}-${selectedRack?.rowNumber} 편집`
                : `Zone ${selectedZone.code}에 Rack 추가`}
            </h2>

            <form onSubmit={handleSubmitRack} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Row 번호 *
                </label>
                <input
                  type="text"
                  value={rackForm.rowNumber}
                  onChange={(e) =>
                    setRackForm({ ...rackForm, rowNumber: e.target.value.padStart(2, "0") })
                  }
                  className="input w-full"
                  placeholder="01"
                  required
                />
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  위치 코드: {selectedZone.code}-{rackForm.rowNumber}-XX
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  선반 수
                </label>
                <input
                  type="number"
                  value={rackForm.shelfCount}
                  onChange={(e) =>
                    setRackForm({
                      ...rackForm,
                      shelfCount: parseInt(e.target.value) || 4,
                    })
                  }
                  className="input w-full"
                  min={1}
                  max={10}
                />
                {isRackEditMode && (
                  <p className="text-xs text-[var(--warning)] mt-1">
                    * 선반 수 변경 시 기존 선반이 유지됩니다
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    위치 X (Zone 내)
                  </label>
                  <input
                    type="number"
                    value={rackForm.posX}
                    onChange={(e) =>
                      setRackForm({ ...rackForm, posX: parseInt(e.target.value) || 0 })
                    }
                    className="input w-full"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    위치 Y (Zone 내)
                  </label>
                  <input
                    type="number"
                    value={rackForm.posY}
                    onChange={(e) =>
                      setRackForm({ ...rackForm, posY: parseInt(e.target.value) || 0 })
                    }
                    className="input w-full"
                    min={0}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowRackForm(false);
                    setIsRackEditMode(false);
                    setSelectedZone(null);
                    setSelectedRack(null);
                  }}
                  className="btn-secondary"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createRackMutation.isPending || updateRackMutation.isPending}
                >
                  {createRackMutation.isPending || updateRackMutation.isPending
                    ? "저장 중..."
                    : isRackEditMode
                    ? "저장"
                    : "추가"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Arrange Modal */}
      {showBulkArrange && selectedZone && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 animate-scale-in">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
              Zone {selectedZone.code} - Rack 일괄 조정
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              {selectedZone.racks?.length || 0}개의 Rack 위치를 일괄 조정합니다.
            </p>

            <form onSubmit={handleSubmitBulkArrange} className="space-y-4">
              {/* 배열 설정 */}
              <div className="p-4 bg-[var(--gray-50)] rounded-lg">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                  배열 설정
                </h3>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      열 수 (가로)
                    </label>
                    <input
                      type="number"
                      value={bulkArrangeForm.columns}
                      onChange={(e) => {
                        const cols = Math.max(1, parseInt(e.target.value) || 1);
                        setBulkArrangeForm({
                          ...bulkArrangeForm,
                          columns: cols,
                          rows: bulkArrangeForm.useRows
                            ? bulkArrangeForm.rows
                            : Math.ceil((selectedZone?.racks?.length || 0) / cols),
                        });
                      }}
                      className="input w-full"
                      min={1}
                      max={500}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="checkbox"
                        id="useRows"
                        checked={bulkArrangeForm.useRows}
                        onChange={(e) =>
                          setBulkArrangeForm({
                            ...bulkArrangeForm,
                            useRows: e.target.checked,
                            rows: e.target.checked
                              ? Math.ceil((selectedZone?.racks?.length || 0) / bulkArrangeForm.columns)
                              : null,
                          })
                        }
                        className="w-3 h-3 rounded border-[var(--gray-300)]"
                      />
                      <label htmlFor="useRows" className="text-xs font-medium text-[var(--text-secondary)]">
                        행 수 지정 (세로)
                      </label>
                    </div>
                    <input
                      type="number"
                      value={bulkArrangeForm.rows || Math.ceil((selectedZone?.racks?.length || 0) / bulkArrangeForm.columns)}
                      onChange={(e) =>
                        setBulkArrangeForm({
                          ...bulkArrangeForm,
                          rows: Math.max(1, parseInt(e.target.value) || 1),
                        })
                      }
                      className="input w-full"
                      min={1}
                      max={500}
                      disabled={!bulkArrangeForm.useRows}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      가로 간격 (X)
                    </label>
                    <input
                      type="number"
                      value={bulkArrangeForm.gapX}
                      onChange={(e) =>
                        setBulkArrangeForm({
                          ...bulkArrangeForm,
                          gapX: parseInt(e.target.value) || 0,
                        })
                      }
                      className="input w-full"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      세로 간격 (Y)
                    </label>
                    <input
                      type="number"
                      value={bulkArrangeForm.gapY}
                      onChange={(e) =>
                        setBulkArrangeForm({
                          ...bulkArrangeForm,
                          gapY: parseInt(e.target.value) || 0,
                        })
                      }
                      className="input w-full"
                      min={0}
                    />
                  </div>
                </div>
                {bulkArrangeForm.useRows && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      배열 방향
                    </label>
                    <select
                      value={bulkArrangeForm.arrangeBy}
                      onChange={(e) =>
                        setBulkArrangeForm({
                          ...bulkArrangeForm,
                          arrangeBy: e.target.value as "columns" | "rows",
                        })
                      }
                      className="input w-full"
                    >
                      <option value="columns">열 우선 (좌→우, 상→하)</option>
                      <option value="rows">행 우선 (상→하, 좌→우)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* 시작 위치 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    시작 위치 X
                  </label>
                  <input
                    type="number"
                    value={bulkArrangeForm.startX}
                    onChange={(e) =>
                      setBulkArrangeForm({
                        ...bulkArrangeForm,
                        startX: parseInt(e.target.value) || 0,
                      })
                    }
                    className="input w-full"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    시작 위치 Y
                  </label>
                  <input
                    type="number"
                    value={bulkArrangeForm.startY}
                    onChange={(e) =>
                      setBulkArrangeForm({
                        ...bulkArrangeForm,
                        startY: parseInt(e.target.value) || 0,
                      })
                    }
                    className="input w-full"
                    min={0}
                  />
                </div>
              </div>

              {/* 정렬 기준 */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  정렬 기준
                </label>
                <select
                  value={bulkArrangeForm.sortBy}
                  onChange={(e) =>
                    setBulkArrangeForm({
                      ...bulkArrangeForm,
                      sortBy: e.target.value as "rowNumber" | "id" | "current",
                    })
                  }
                  className="input w-full"
                >
                  <option value="rowNumber">Row 번호 순 (01, 02, 03...)</option>
                  <option value="id">생성 순서</option>
                  <option value="current">현재 위치 순 (X좌표)</option>
                </select>
              </div>

              {/* 선반 수 일괄 변경 */}
              <div className="p-4 bg-[var(--gray-50)] rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="updateShelfCount"
                    checked={bulkArrangeForm.updateShelfCount}
                    onChange={(e) =>
                      setBulkArrangeForm({
                        ...bulkArrangeForm,
                        updateShelfCount: e.target.checked,
                        shelfCount: e.target.checked ? 4 : null,
                      })
                    }
                    className="w-4 h-4 rounded border-[var(--gray-300)]"
                  />
                  <label
                    htmlFor="updateShelfCount"
                    className="text-sm font-medium text-[var(--text-secondary)]"
                  >
                    선반 수 일괄 변경
                  </label>
                </div>
                {bulkArrangeForm.updateShelfCount && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      선반 수
                    </label>
                    <input
                      type="number"
                      value={bulkArrangeForm.shelfCount || 4}
                      onChange={(e) =>
                        setBulkArrangeForm({
                          ...bulkArrangeForm,
                          shelfCount: parseInt(e.target.value) || 4,
                        })
                      }
                      className="input w-full"
                      min={1}
                      max={10}
                    />
                    <p className="text-xs text-[var(--warning)] mt-1">
                      * 기존 선반 데이터는 유지되고 shelfCount만 변경됩니다.
                    </p>
                  </div>
                )}
              </div>

              {/* 미리보기 정보 */}
              <div className="p-3 bg-[var(--info)]/10 rounded-lg text-sm">
                <strong>배치 미리보기:</strong>{" "}
                {bulkArrangeForm.useRows && bulkArrangeForm.rows
                  ? `${bulkArrangeForm.rows}행 x ${bulkArrangeForm.columns}열`
                  : `${Math.ceil((selectedZone.racks?.length || 0) / bulkArrangeForm.columns)}행 x ${bulkArrangeForm.columns}열`}
                {bulkArrangeForm.useRows && (
                  <span className="ml-2 text-xs text-[var(--text-muted)]">
                    ({bulkArrangeForm.arrangeBy === "rows" ? "행 우선" : "열 우선"})
                  </span>
                )}
                <br />
                <span className="text-xs text-[var(--text-muted)]">
                  총 {selectedZone.racks?.length || 0}개 Rack
                  {bulkArrangeForm.useRows && bulkArrangeForm.rows && bulkArrangeForm.columns &&
                    (selectedZone.racks?.length || 0) > bulkArrangeForm.rows * bulkArrangeForm.columns && (
                      <span className="text-[var(--warning)]">
                        {" "}(설정 범위 초과: {(selectedZone.racks?.length || 0) - bulkArrangeForm.rows * bulkArrangeForm.columns}개)
                      </span>
                    )}
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkArrange(false);
                    setSelectedZone(null);
                  }}
                  className="btn-secondary"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={bulkArrangeMutation.isPending}
                >
                  {bulkArrangeMutation.isPending ? "적용 중..." : "일괄 적용"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Zone Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteZone}
        onClose={() => {
          setShowDeleteZone(false);
          setSelectedZone(null);
        }}
        onConfirm={() => selectedZone && deleteZoneMutation.mutate(selectedZone.id)}
        title="Zone 삭제"
        message={`Zone ${selectedZone?.code}를 삭제하시겠습니까? 포함된 모든 Rack과 Shelf도 함께 삭제됩니다.`}
        confirmText="삭제"
        variant="danger"
        isLoading={deleteZoneMutation.isPending}
      />

      {/* Delete Rack Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteRack}
        onClose={() => {
          setShowDeleteRack(false);
          setSelectedRack(null);
        }}
        onConfirm={() => selectedRack && deleteRackMutation.mutate(selectedRack.id)}
        title="Rack 삭제"
        message={`Rack ${selectedRack?.rowNumber}을 삭제하시겠습니까? 포함된 모든 Shelf도 함께 삭제됩니다.`}
        confirmText="삭제"
        variant="danger"
        isLoading={deleteRackMutation.isPending}
      />
    </div>
  );
}

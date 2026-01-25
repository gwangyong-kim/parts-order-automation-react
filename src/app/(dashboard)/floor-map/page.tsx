"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Map, Search, Package, MapPin, X } from "lucide-react";
import WarehouseMap from "@/components/warehouse/WarehouseMap";
import UsageGuide, {
  FLOOR_MAP_GUIDE_SECTIONS,
  FLOOR_MAP_GUIDE_TIPS,
  FLOOR_MAP_GUIDE_WARNINGS,
} from "@/components/ui/UsageGuide";
import type { WarehouseLayout, LocationLookup } from "@/types/warehouse";

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

export default function FloorMapPage() {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightLocation, setHighlightLocation] = useState<string | undefined>();
  const [locationInfo, setLocationInfo] = useState<LocationLookup | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const { data: warehouses, isLoading: warehousesLoading } = useQuery({
    queryKey: ["warehouses"],
    queryFn: fetchWarehouses,
  });

  // Auto-select first warehouse
  const activeWarehouseId = selectedWarehouseId || warehouses?.[0]?.id;

  const { data: layout, isLoading: layoutLoading } = useQuery({
    queryKey: ["warehouse-layout", activeWarehouseId],
    queryFn: () => fetchWarehouseLayout(activeWarehouseId!),
    enabled: !!activeWarehouseId,
  });

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    setSearchError(null);
    setLocationInfo(null);

    try {
      const info = await lookupLocation(searchTerm.trim().toUpperCase());
      setLocationInfo(info);
      setHighlightLocation(info.locationCode);

      // If location is in a different warehouse, switch to it
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
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">창고 맵</h1>
            <p className="text-[var(--text-secondary)]">창고 레이아웃 및 위치 검색</p>
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Map className="w-8 h-8 text-[var(--primary)]" />
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">창고 맵</h1>
            <p className="text-[var(--text-secondary)]">창고 레이아웃 및 위치 검색</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <UsageGuide
            title="창고 맵 사용 가이드"
            description="창고 레이아웃 조회 및 위치 검색 방법을 안내합니다."
            sections={FLOOR_MAP_GUIDE_SECTIONS}
            tips={FLOOR_MAP_GUIDE_TIPS}
            warnings={FLOOR_MAP_GUIDE_WARNINGS}
          />
          {/* Warehouse Selector */}
          {warehouses.length > 1 && (
            <select
              value={activeWarehouseId || ""}
              onChange={(e) => setSelectedWarehouseId(Number(e.target.value))}
              className="input"
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
      <div className="glass-card p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="위치 코드로 검색 (예: A-01-02)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="input input-with-icon w-full"
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
          <button onClick={handleSearch} className="btn btn-primary">
            <MapPin className="w-4 h-4" />
            위치 찾기
          </button>
        </div>

        {searchError && (
          <p className="mt-2 text-sm text-[var(--danger)]">{searchError}</p>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2 glass-card p-4">
          {layoutLoading ? (
            <div className="flex items-center justify-center h-[500px]">
              <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : layout ? (
            <WarehouseMap
              layout={layout}
              highlightLocation={highlightLocation}
              onLocationClick={handleLocationClick}
              showPartCounts
            />
          ) : (
            <div className="flex items-center justify-center h-[500px] text-[var(--text-muted)]">
              레이아웃을 불러올 수 없습니다
            </div>
          )}
        </div>

        {/* Location Info Panel */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            위치 정보
          </h2>

          {locationInfo ? (
            <div className="space-y-4">
              {/* Location Code */}
              <div className="p-4 bg-[var(--primary)]/10 rounded-lg">
                <p className="text-sm text-[var(--text-muted)]">위치 코드</p>
                <p className="text-2xl font-bold text-[var(--primary)]">
                  {locationInfo.locationCode}
                </p>
              </div>

              {/* Zone Info */}
              <div>
                <p className="text-sm text-[var(--text-muted)]">Zone</p>
                <p className="font-medium">
                  {locationInfo.zone.name} (Zone {locationInfo.zone.code})
                </p>
              </div>

              {/* Rack Info */}
              <div>
                <p className="text-sm text-[var(--text-muted)]">랙 / 선반</p>
                <p className="font-medium">
                  Row {locationInfo.rack.rowNumber} / Shelf {locationInfo.shelf.shelfNumber}
                </p>
              </div>

              {/* Parts at Location */}
              <div className="pt-4 border-t border-[var(--glass-border)]">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-[var(--text-secondary)]">
                    보관 중인 파츠
                  </p>
                  <span className="badge badge-info">{locationInfo.partCount}개</span>
                </div>

                {locationInfo.parts.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {locationInfo.parts.map((part) => (
                      <div
                        key={part.id}
                        className="p-3 bg-white rounded-lg border border-[var(--gray-200)]"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <a
                              href={`/parts/${part.id}`}
                              className="font-medium text-[var(--primary)] hover:underline"
                            >
                              {part.partCode}
                            </a>
                            <p className="text-sm text-[var(--text-secondary)]">
                              {part.partName}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{part.currentQty}</p>
                            <p className="text-xs text-[var(--text-muted)]">{part.unit}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-[var(--text-muted)]">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">이 위치에 보관된 파츠가 없습니다</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>위치 코드를 검색하거나</p>
              <p>맵에서 위치를 클릭하세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

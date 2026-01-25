"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Map, ChevronDown, ExternalLink, Search, X, MapPin, Package, Boxes, Loader2 } from "lucide-react";
import Link from "next/link";
import WarehouseMap from "@/components/warehouse/WarehouseMap";
import type { WarehouseLayout } from "@/types/warehouse";

interface Warehouse {
  id: number;
  code: string;
  name: string;
}

interface LocationPart {
  id: number;
  partCode: string;
  partName: string;
  unit: string;
  currentQty: number;
  category: string | null;
}

interface LocationDetails {
  locationCode: string;
  shelf: { id: number; shelfNumber: string; capacity: number };
  rack: { id: number; rowNumber: string; posX: number; posY: number };
  zone: { id: number; code: string; name: string; color: string };
  warehouse: { id: number; code: string; name: string };
  parts: LocationPart[];
  partCount: number;
}

async function fetchWarehouses(): Promise<Warehouse[]> {
  const res = await fetch("/api/warehouse");
  if (!res.ok) throw new Error("Failed to fetch warehouses");
  return res.json();
}

async function fetchWarehouseLayout(id: number): Promise<WarehouseLayout> {
  const res = await fetch(`/api/warehouse/${id}/layout`);
  if (!res.ok) throw new Error("Failed to fetch layout");
  return res.json();
}

async function fetchLocationDetails(code: string): Promise<LocationDetails> {
  const res = await fetch(`/api/locations?code=${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error("Failed to fetch location details");
  return res.json();
}

export default function DashboardWarehouseMap() {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [highlightLocation, setHighlightLocation] = useState<string | null>(null);

  const { data: warehouses, isLoading: isLoadingWarehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: fetchWarehouses,
  });

  // 첫 번째 창고를 기본 선택
  const currentWarehouseId = selectedWarehouseId || warehouses?.[0]?.id;

  const { data: layout, isLoading: isLoadingLayout } = useQuery({
    queryKey: ["warehouse-layout", currentWarehouseId],
    queryFn: () => fetchWarehouseLayout(currentWarehouseId!),
    enabled: !!currentWarehouseId,
  });

  // 위치 상세 정보 (파츠 목록 포함) - API에서 조회
  const { data: locationDetails, isLoading: isLoadingLocation } = useQuery({
    queryKey: ["location-details", highlightLocation],
    queryFn: () => fetchLocationDetails(highlightLocation!),
    enabled: !!highlightLocation,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = searchInput.trim().toUpperCase();
    if (normalized) {
      setHighlightLocation(normalized);
    }
  };

  const clearSearch = () => {
    setSearchInput("");
    setHighlightLocation(null);
  };

  const handleLocationClick = (locationCode: string) => {
    setSearchInput(locationCode);
    setHighlightLocation(locationCode);
  };

  if (isLoadingWarehouses) {
    return (
      <div className="glass-card p-6 animate-slide-up">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-1.5 h-5 bg-gradient-to-b from-[var(--info-500)] to-[var(--info-600)] rounded-full" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">창고 맵</h2>
        </div>
        <div className="h-[400px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]" />
        </div>
      </div>
    );
  }

  if (!warehouses || warehouses.length === 0) {
    return (
      <div className="glass-card p-6 animate-slide-up">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-1.5 h-5 bg-gradient-to-b from-[var(--info-500)] to-[var(--info-600)] rounded-full" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">창고 맵</h2>
        </div>
        <div className="h-[300px] flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--gray-100)] flex items-center justify-center mb-4">
            <Map className="w-8 h-8 text-[var(--gray-400)]" />
          </div>
          <p className="text-[var(--text-muted)] mb-4">등록된 창고가 없습니다.</p>
          <Link
            href="/warehouse"
            className="text-[var(--primary)] hover:underline flex items-center gap-1"
          >
            창고 등록하기
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const currentWarehouse = warehouses.find((w) => w.id === currentWarehouseId);

  return (
    <div className="glass-card p-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-5 bg-gradient-to-b from-[var(--info-500)] to-[var(--info-600)] rounded-full" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">창고 맵</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Location Search */}
          <form onSubmit={handleSearch} className="relative flex items-center">
            <Search className="absolute left-2.5 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="위치검색 (A-01-02)"
              className="pl-8 pr-8 py-1.5 w-40 text-sm bg-[var(--gray-50)] border border-[var(--gray-200)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
            />
            {searchInput && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>
          {/* Warehouse Selector */}
          {warehouses.length > 1 && (
            <div className="relative">
              <select
                value={currentWarehouseId || ""}
                onChange={(e) => setSelectedWarehouseId(parseInt(e.target.value))}
                className="appearance-none bg-[var(--gray-50)] border border-[var(--gray-200)] rounded-lg px-3 py-1.5 pr-8 text-sm font-medium text-[var(--text-primary)] cursor-pointer hover:bg-[var(--gray-100)] transition-colors"
              >
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name} ({wh.code})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
            </div>
          )}
          <Link
            href={currentWarehouseId ? `/warehouse/${currentWarehouseId}` : "/warehouse"}
            className="text-sm text-[var(--primary)] hover:underline flex items-center gap-1"
          >
            편집
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Map */}
      {isLoadingLayout ? (
        <div className="h-[400px] flex items-center justify-center bg-[var(--gray-50)] rounded-xl">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]" />
        </div>
      ) : layout ? (
        <div className="rounded-xl overflow-hidden border border-[var(--gray-200)]">
          <WarehouseMap
            layout={layout}
            showPartCounts={true}
            highlightLocation={highlightLocation || undefined}
            onLocationClick={handleLocationClick}
            className="h-[400px]"
          />
        </div>
      ) : (
        <div className="h-[300px] flex flex-col items-center justify-center bg-[var(--gray-50)] rounded-xl">
          <Map className="w-12 h-12 text-[var(--gray-300)] mb-3" />
          <p className="text-[var(--text-muted)]">레이아웃을 불러올 수 없습니다.</p>
        </div>
      )}

      {/* Location Info */}
      {highlightLocation && (
        <div className="mt-4 p-4 bg-[var(--primary-50)] rounded-xl border border-[var(--primary-200)]">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--primary)] flex items-center justify-center">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">선택된 위치</p>
                <p className="font-bold text-[var(--text-primary)] text-lg">{highlightLocation}</p>
              </div>
            </div>
            {isLoadingLocation ? (
              <Loader2 className="w-5 h-5 text-[var(--primary)] animate-spin" />
            ) : locationDetails ? (
              <div className="flex items-center gap-4 text-sm">
                <div className="text-center">
                  <p className="text-[var(--text-muted)]">Zone</p>
                  <p className="font-semibold text-[var(--text-primary)]">{locationDetails.zone.code}</p>
                </div>
                <div className="text-center">
                  <p className="text-[var(--text-muted)]">Rack</p>
                  <p className="font-semibold text-[var(--text-primary)]">{locationDetails.rack.rowNumber}</p>
                </div>
                <div className="text-center">
                  <p className="text-[var(--text-muted)]">Shelf</p>
                  <p className="font-semibold text-[var(--text-primary)]">{locationDetails.shelf.shelfNumber}</p>
                </div>
                <div className="flex items-center gap-1 px-3 py-1.5 bg-white rounded-lg">
                  <Package className="w-4 h-4 text-[var(--primary)]" />
                  <span className="font-semibold text-[var(--text-primary)]">{locationDetails.partCount}</span>
                  <span className="text-[var(--text-muted)] text-xs">품목</span>
                </div>
              </div>
            ) : (
              <span className="text-sm text-[var(--warning-600)] bg-[var(--warning-50)] px-3 py-1.5 rounded-lg">
                위치를 찾을 수 없습니다
              </span>
            )}
          </div>

          {/* Parts List */}
          {locationDetails && locationDetails.parts.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--primary-200)]">
              <div className="flex items-center gap-2 mb-2">
                <Boxes className="w-4 h-4 text-[var(--primary)]" />
                <span className="text-sm font-medium text-[var(--text-primary)]">보관 파츠</span>
              </div>
              <div className="space-y-2 max-h-[150px] overflow-y-auto">
                {locationDetails.parts.map((part) => (
                  <Link
                    key={part.id}
                    href={`/parts/${part.id}`}
                    className="flex items-center justify-between p-2 bg-white rounded-lg hover:bg-[var(--gray-50)] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--text-primary)] text-sm truncate">
                        {part.partName}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {part.partCode} {part.category && `· ${part.category}`}
                      </p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="font-bold text-[var(--primary)] tabular-nums">
                        {part.currentQty.toLocaleString()}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">{part.unit}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Empty state for no parts */}
          {locationDetails && locationDetails.parts.length === 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--primary-200)] text-center py-3">
              <p className="text-sm text-[var(--text-muted)]">이 위치에 보관된 파츠가 없습니다.</p>
            </div>
          )}
        </div>
      )}

      {/* Quick Stats */}
      {layout && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="bg-[var(--gray-50)] rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {layout.zones?.length || 0}
            </p>
            <p className="text-xs text-[var(--text-muted)]">Zone</p>
          </div>
          <div className="bg-[var(--gray-50)] rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {layout.zones?.reduce((acc, z) => acc + (z.racks?.length || 0), 0) || 0}
            </p>
            <p className="text-xs text-[var(--text-muted)]">Rack</p>
          </div>
          <div className="bg-[var(--gray-50)] rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {layout.zones?.reduce(
                (acc, z) =>
                  acc + (z.racks?.reduce((a, r) => a + (r.shelves?.length || 0), 0) || 0),
                0
              ) || 0}
            </p>
            <p className="text-xs text-[var(--text-muted)]">Shelf</p>
          </div>
        </div>
      )}
    </div>
  );
}

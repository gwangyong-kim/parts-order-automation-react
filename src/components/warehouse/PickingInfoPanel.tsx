"use client";

import { X, Check, ExternalLink, Package, MapPin } from "lucide-react";
import Link from "next/link";
import type { PickingLocationInfo, LocationLookup } from "@/types/warehouse";

interface PickingInfoPanelProps {
  locationCode: string;
  pickingInfo: PickingLocationInfo | null;
  locationInfo?: LocationLookup | null;
  onClose: () => void;
  onQuickPick?: (itemId: number, qty: number) => void;
  isLoading?: boolean;
}

const statusConfig = {
  PENDING: { label: "대기", color: "badge-secondary" },
  IN_PROGRESS: { label: "진행중", color: "badge-info" },
  PICKED: { label: "완료", color: "badge-success" },
  SKIPPED: { label: "스킵", color: "badge-warning" },
};

export default function PickingInfoPanel({
  locationCode,
  pickingInfo,
  locationInfo,
  onClose,
  onQuickPick,
  isLoading = false,
}: PickingInfoPanelProps) {
  const progress = pickingInfo
    ? Math.round((pickingInfo.totalPicked / pickingInfo.totalRequired) * 100)
    : 0;

  return (
    <div className="glass-card p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-[var(--primary)]" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            {locationCode}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-[var(--gray-100)] rounded"
        >
          <X className="w-5 h-5 text-[var(--text-muted)]" />
        </button>
      </div>

      {/* Location Info */}
      {locationInfo && (
        <div className="mb-4 p-3 bg-[var(--gray-50)] rounded-lg">
          <p className="text-sm text-[var(--text-secondary)]">
            <span className="font-medium">Zone:</span> {locationInfo.zone.code} - {locationInfo.zone.name}
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            <span className="font-medium">Rack:</span> {locationInfo.rack.rowNumber}
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            <span className="font-medium">Shelf:</span> {locationInfo.shelf.shelfNumber}
          </p>
        </div>
      )}

      {/* No Picking Info */}
      {!pickingInfo && (
        <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
          <div className="text-center">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>이 위치에 피킹 작업이 없습니다.</p>
          </div>
        </div>
      )}

      {/* Picking Info */}
      {pickingInfo && (
        <>
          {/* Task Info */}
          <div className="mb-4 p-3 bg-[var(--primary)]/5 rounded-lg border border-[var(--primary)]/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[var(--primary)]">
                {pickingInfo.taskCode}
              </span>
              <span className={`badge ${
                pickingInfo.status === "in_progress"
                  ? "badge-info"
                  : pickingInfo.status === "completed"
                  ? "badge-success"
                  : "badge-warning"
              }`}>
                {pickingInfo.status === "in_progress"
                  ? "진행중"
                  : pickingInfo.status === "completed"
                  ? "완료"
                  : "대기"}
              </span>
            </div>
            <Link
              href={`/picking/${pickingInfo.taskId}`}
              className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1"
            >
              작업 상세 보기 <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          {/* Progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-[var(--text-secondary)]">진행률</span>
              <span className="text-sm font-bold text-[var(--primary)]">
                {pickingInfo.totalPicked}/{pickingInfo.totalRequired} ({progress}%)
              </span>
            </div>
            <div className="h-2 bg-[var(--gray-200)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--primary)] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-auto">
            <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">
              피킹 항목 ({pickingInfo.items.length})
            </p>
            <div className="space-y-2">
              {pickingInfo.items.map((item) => {
                const status = statusConfig[item.status as keyof typeof statusConfig] || statusConfig.PENDING;
                const canQuickPick = item.status === "PENDING" || item.status === "IN_PROGRESS";

                return (
                  <div
                    key={item.id}
                    className="p-3 bg-white rounded-lg border border-[var(--gray-200)]"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm">{item.partName}</p>
                        <p className="text-xs text-[var(--text-muted)]">{item.partCode}</p>
                      </div>
                      <span className={`badge ${status.color} text-xs`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm">
                        <span className="text-[var(--text-muted)]">수량:</span>{" "}
                        <span className="font-bold">{item.pickedQty}</span>
                        <span className="text-[var(--text-muted)]">/{item.requiredQty} {item.unit}</span>
                      </p>
                      {/* Phase 3: 빠른 피킹 버튼 */}
                      {canQuickPick && onQuickPick && (
                        <button
                          onClick={() => onQuickPick(item.id, item.requiredQty)}
                          disabled={isLoading}
                          className="btn btn-primary btn-sm text-xs"
                        >
                          <Check className="w-3 h-3" />
                          피킹
                        </button>
                      )}
                    </div>
                    {item.notes && (
                      <p className="text-xs text-[var(--text-muted)] mt-1 italic">
                        메모: {item.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import type { Zone, Rack, Shelf, PickingLocationInfo } from "@/types/warehouse";

interface ZoneWithRacks extends Zone {
  racks: (Rack & {
    shelves: (Shelf & {
      locationCode: string;
      partCount: number;
    })[];
  })[];
}

interface ZoneGridProps {
  zone: ZoneWithRacks;
  offsetX: number;
  offsetY: number;
  highlightLocation?: string;
  isHighlighted?: boolean;
  onLocationClick?: (locationCode: string) => void;
  showPartCounts?: boolean;
  // Phase 2: 피킹 모드 props
  pickingMode?: boolean;
  activePickingLocations?: Record<string, PickingLocationInfo>;
}

export default function ZoneGrid({
  zone,
  offsetX,
  offsetY,
  highlightLocation,
  isHighlighted,
  onLocationClick,
  showPartCounts,
  pickingMode = false,
  activePickingLocations,
}: ZoneGridProps) {
  const x = offsetX + zone.posX;
  const y = offsetY + zone.posY;

  // Calculate rack positions within zone
  const rackWidth = 15;
  const rackHeight = 8;
  const rackGap = 3;

  return (
    <g>
      {/* Zone Background */}
      <rect
        x={x}
        y={y}
        width={zone.width}
        height={zone.height}
        fill={isHighlighted ? `${zone.color}20` : `${zone.color}10`}
        stroke={zone.color}
        strokeWidth={isHighlighted ? 2 : 1}
        rx="4"
        className={isHighlighted ? "animate-pulse" : ""}
      />

      {/* Zone Label */}
      <text
        x={x + 5}
        y={y + 12}
        className="text-[10px] font-bold"
        fill={zone.color}
      >
        ZONE {zone.code}
      </text>
      <text
        x={x + 5}
        y={y + 22}
        className="text-[8px]"
        fill="var(--text-secondary)"
      >
        {zone.name}
      </text>

      {/* Racks */}
      {zone.racks.map((rack, rackIndex) => {
        const rackX = x + 5 + rack.posX;
        const rackY = y + 30 + rack.posY;

        // Check if any shelf in this rack is highlighted
        const hasHighlightedShelf = rack.shelves.some(
          (shelf) => shelf.locationCode === highlightLocation
        );

        return (
          <g key={rack.id}>
            {/* Rack Container */}
            <rect
              x={rackX}
              y={rackY}
              width={rackWidth}
              height={rackHeight * rack.shelves.length + (rack.shelves.length - 1) * 1}
              fill="var(--gray-100)"
              stroke={hasHighlightedShelf ? "var(--primary)" : "var(--gray-300)"}
              strokeWidth={hasHighlightedShelf ? 2 : 1}
              rx="2"
            />

            {/* Rack Label */}
            <text
              x={rackX + rackWidth / 2}
              y={rackY - 2}
              textAnchor="middle"
              className="text-[6px]"
              fill="var(--text-muted)"
            >
              {zone.code}-{rack.rowNumber}
            </text>

            {/* Shelves */}
            {rack.shelves.map((shelf, shelfIndex) => {
              const shelfY = rackY + shelfIndex * (rackHeight + 1);
              const isShelfHighlighted = shelf.locationCode === highlightLocation;
              const hasItems = (shelf.partCount ?? 0) > 0;

              // Phase 2: 피킹 상태 확인
              const pickingInfo = pickingMode && shelf.locationCode
                ? activePickingLocations?.[shelf.locationCode]
                : null;
              const hasPicking = !!pickingInfo;
              const pickingStatus = pickingInfo?.status;

              // 피킹 상태에 따른 색상 결정
              const getShelfFill = () => {
                if (isShelfHighlighted) return "var(--primary)";
                if (pickingMode && hasPicking) {
                  switch (pickingStatus) {
                    case "in_progress": return "#3b82f6"; // blue-500
                    case "completed": return "#22c55e"; // green-500
                    case "pending": return "#facc15"; // yellow-400
                    default: return "white";
                  }
                }
                if (hasItems) return "var(--success-light, #dcfce7)";
                return "white";
              };

              const getShelfStroke = () => {
                if (isShelfHighlighted) return "var(--primary)";
                if (pickingMode && hasPicking) {
                  switch (pickingStatus) {
                    case "in_progress": return "#2563eb"; // blue-600
                    case "completed": return "#16a34a"; // green-600
                    case "pending": return "#eab308"; // yellow-500
                    default: return "transparent";
                  }
                }
                return "transparent";
              };

              return (
                <g
                  key={shelf.id}
                  onClick={() => shelf.locationCode && onLocationClick?.(shelf.locationCode)}
                  className="cursor-pointer"
                >
                  <rect
                    x={rackX + 1}
                    y={shelfY + 1}
                    width={rackWidth - 2}
                    height={rackHeight - 2}
                    fill={getShelfFill()}
                    stroke={getShelfStroke()}
                    strokeWidth={isShelfHighlighted || (pickingMode && hasPicking) ? 1.5 : 0}
                    rx="1"
                    className={
                      isShelfHighlighted
                        ? "animate-pulse"
                        : pickingStatus === "in_progress"
                        ? "animate-pulse"
                        : "hover:fill-[var(--gray-200)]"
                    }
                  />

                  {/* Part count indicator */}
                  {showPartCounts && hasItems && !isShelfHighlighted && !hasPicking && (
                    <circle
                      cx={rackX + rackWidth - 3}
                      cy={shelfY + 3}
                      r="2"
                      fill="var(--success)"
                    />
                  )}

                  {/* Phase 2: 피킹 수량 배지 */}
                  {pickingMode && hasPicking && pickingInfo && (
                    <text
                      x={rackX + rackWidth / 2}
                      y={shelfY + rackHeight / 2 + 2}
                      textAnchor="middle"
                      className="text-[5px] font-bold"
                      fill={pickingStatus === "pending" ? "#000" : "#fff"}
                    >
                      {pickingInfo.totalPicked}/{pickingInfo.totalRequired}
                    </text>
                  )}

                  {/* Highlighted shelf marker */}
                  {isShelfHighlighted && !hasPicking && (
                    <text
                      x={rackX + rackWidth / 2}
                      y={shelfY + rackHeight / 2 + 2}
                      textAnchor="middle"
                      className="text-[5px] font-bold"
                      fill="white"
                    >
                      ▲
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

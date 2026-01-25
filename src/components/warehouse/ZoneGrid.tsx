"use client";

import type { Zone, Rack, Shelf } from "@/types/warehouse";

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
}

export default function ZoneGrid({
  zone,
  offsetX,
  offsetY,
  highlightLocation,
  isHighlighted,
  onLocationClick,
  showPartCounts,
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
                    fill={
                      isShelfHighlighted
                        ? "var(--primary)"
                        : hasItems
                        ? "var(--success-light, #dcfce7)"
                        : "white"
                    }
                    stroke={isShelfHighlighted ? "var(--primary)" : "transparent"}
                    strokeWidth={isShelfHighlighted ? 1 : 0}
                    rx="1"
                    className={isShelfHighlighted ? "animate-pulse" : "hover:fill-[var(--gray-200)]"}
                  />

                  {/* Part count indicator */}
                  {showPartCounts && hasItems && !isShelfHighlighted && (
                    <circle
                      cx={rackX + rackWidth - 3}
                      cy={shelfY + 3}
                      r="2"
                      fill="var(--success)"
                    />
                  )}

                  {/* Highlighted shelf marker */}
                  {isShelfHighlighted && (
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

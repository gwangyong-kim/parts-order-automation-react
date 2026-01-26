"use client";

import { useState, useRef, useMemo } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import type { WarehouseLayout } from "@/types/warehouse";
import ZoneGrid from "./ZoneGrid";

interface WarehouseMapProps {
  layout: WarehouseLayout;
  highlightLocation?: string;
  onLocationClick?: (locationCode: string) => void;
  showPartCounts?: boolean;
  className?: string;
  fullHeight?: boolean;
}

export default function WarehouseMap({
  layout,
  highlightLocation,
  onLocationClick,
  showPartCounts = true,
  className = "",
  fullHeight = false,
}: WarehouseMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Calculate actual content bounds based on zones and racks
  const contentBounds = useMemo(() => {
    const rackWidth = 15;
    const rackHeight = 8;

    let maxX = layout.width;
    let maxY = layout.height;

    layout.zones.forEach((zone) => {
      // Zone's right and bottom edges
      const zoneRight = zone.posX + zone.width;
      const zoneBottom = zone.posY + zone.height;
      maxX = Math.max(maxX, zoneRight);
      maxY = Math.max(maxY, zoneBottom);

      // Check each rack within the zone
      zone.racks?.forEach((rack) => {
        const shelfCount = rack.shelves?.length || rack.shelfCount || 4;
        const rackRight = zone.posX + 5 + rack.posX + rackWidth;
        const rackBottom = zone.posY + 30 + rack.posY + (rackHeight * shelfCount) + shelfCount;
        maxX = Math.max(maxX, rackRight);
        maxY = Math.max(maxY, rackBottom);
      });
    });

    return { width: maxX, height: maxY };
  }, [layout]);

  // Calculate SVG viewBox dimensions using actual content bounds
  const padding = 20;
  const viewBoxWidth = Math.max(layout.width, contentBounds.width) + padding * 2;
  const viewBoxHeight = Math.max(layout.height, contentBounds.height) + padding * 2;

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.2, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.2, 0.5));
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((s) => Math.max(0.5, Math.min(3, s + delta)));
  };

  // Parse highlight location to get zone code
  const highlightZone = highlightLocation?.split("-")[0];

  return (
    <div className={`relative bg-[var(--glass-bg)] rounded-xl overflow-hidden ${className}`}>
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors"
          title="확대"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors"
          title="축소"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleReset}
          className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors"
          title="초기화"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Legend */}
      <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-sm">
        <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2">MAP LEGEND</p>
        <div className="flex flex-col gap-1.5">
          {highlightLocation && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[var(--primary)] animate-pulse" />
              <span className="text-xs">현재 위치</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-[var(--gray-200)]" />
            <span className="text-xs">랙</span>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div
        ref={containerRef}
        className={`w-full cursor-grab active:cursor-grabbing ${fullHeight ? "h-full" : "h-[500px]"}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            transformOrigin: "center center",
          }}
        >
          {/* Background Grid */}
          <defs>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path
                d="M 10 0 L 0 0 0 10"
                fill="none"
                stroke="var(--gray-200)"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect
            x={padding}
            y={padding}
            width={Math.max(layout.width, contentBounds.width)}
            height={Math.max(layout.height, contentBounds.height)}
            fill="url(#grid)"
            stroke="var(--gray-300)"
            strokeWidth="1"
            rx="4"
          />

          {/* Warehouse Name */}
          <text
            x={padding + 10}
            y={padding - 5}
            className="text-xs font-medium"
            fill="var(--text-secondary)"
          >
            {layout.name}
          </text>

          {/* Zones */}
          {layout.zones.map((zone) => (
            <ZoneGrid
              key={zone.id}
              zone={zone}
              offsetX={padding}
              offsetY={padding}
              highlightLocation={highlightLocation}
              isHighlighted={highlightZone === zone.code}
              onLocationClick={onLocationClick}
              showPartCounts={showPartCounts}
            />
          ))}

          {/* Loading Dock (example static element) */}
          <g transform={`translate(${padding + Math.max(layout.width, contentBounds.width) / 2 - 40}, ${padding + Math.max(layout.height, contentBounds.height) - 15})`}>
            <rect
              width="80"
              height="10"
              fill="var(--gray-400)"
              rx="2"
            />
            <text
              x="40"
              y="7"
              textAnchor="middle"
              className="text-[8px]"
              fill="white"
            >
              LOADING DOCK
            </text>
          </g>
        </svg>
      </div>

      {/* Current Location Info */}
      {highlightLocation && (
        <div className="absolute bottom-4 left-4 bg-[var(--primary)] text-white px-3 py-2 rounded-lg shadow-lg">
          <p className="text-xs opacity-80">현재 위치</p>
          <p className="font-bold">{highlightLocation}</p>
        </div>
      )}
    </div>
  );
}

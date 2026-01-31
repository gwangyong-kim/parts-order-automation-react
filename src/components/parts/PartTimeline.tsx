"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter, Calendar, ChevronDown, Loader2 } from "lucide-react";
import { TimelineEventComponent } from "./TimelineEvent";
import type { PartTimelineResponse, TimelineEventType, TimelineFilters } from "@/types/timeline";

interface PartTimelineProps {
  partId: string;
}

type PeriodFilter = "7d" | "30d" | "90d" | "all" | "custom";

const periodOptions: { value: PeriodFilter; label: string }[] = [
  { value: "7d", label: "최근 7일" },
  { value: "30d", label: "최근 30일" },
  { value: "90d", label: "최근 90일" },
  { value: "all", label: "전체" },
  { value: "custom", label: "기간 선택" },
];

const eventTypeOptions: { value: TimelineEventType; label: string; group: string }[] = [
  { value: "INBOUND", label: "입고", group: "입출고" },
  { value: "OUTBOUND", label: "출고", group: "입출고" },
  { value: "ADJUSTMENT", label: "조정", group: "입출고" },
  { value: "TRANSFER", label: "이동", group: "입출고" },
  { value: "ORDER", label: "발주", group: "발주/수주" },
  { value: "SALES_ORDER", label: "수주", group: "발주/수주" },
  { value: "PICKING", label: "피킹", group: "작업" },
  { value: "AUDIT", label: "실사", group: "작업" },
];

async function fetchTimeline(
  partId: string,
  filters: TimelineFilters,
  limit: number,
  offset: number
): Promise<PartTimelineResponse> {
  const params = new URLSearchParams();
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.eventTypes && filters.eventTypes.length > 0) {
    params.set("eventTypes", filters.eventTypes.join(","));
  }
  params.set("limit", limit.toString());
  params.set("offset", offset.toString());

  const res = await fetch(`/api/parts/${partId}/timeline?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch timeline");
  return res.json();
}

export function PartTimeline({ partId }: PartTimelineProps) {
  const [period, setPeriod] = useState<PeriodFilter>("30d");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedEventTypes, setSelectedEventTypes] = useState<TimelineEventType[]>([]);
  const [showEventFilter, setShowEventFilter] = useState(false);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  const filters = useMemo<TimelineFilters>(() => {
    const now = new Date();
    let startDate: string | undefined;
    let endDate: string | undefined;

    switch (period) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case "custom":
        if (customStartDate) startDate = new Date(customStartDate).toISOString();
        if (customEndDate) endDate = new Date(customEndDate).toISOString();
        break;
    }

    return {
      startDate,
      endDate,
      eventTypes: selectedEventTypes.length > 0 ? selectedEventTypes : undefined,
    };
  }, [period, customStartDate, customEndDate, selectedEventTypes]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["part-timeline", partId, filters, limit, offset],
    queryFn: () => fetchTimeline(partId, filters, limit, offset),
  });

  const handleEventTypeToggle = (eventType: TimelineEventType) => {
    setSelectedEventTypes((prev) =>
      prev.includes(eventType)
        ? prev.filter((t) => t !== eventType)
        : [...prev, eventType]
    );
    setOffset(0);
  };

  const handleClearEventTypes = () => {
    setSelectedEventTypes([]);
    setOffset(0);
  };

  const handlePeriodChange = (newPeriod: PeriodFilter) => {
    setPeriod(newPeriod);
    setOffset(0);
  };

  const handleLoadMore = () => {
    if (data && offset + limit < data.pagination.total) {
      setOffset((prev) => prev + limit);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Period Filter */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
          <select
            value={period}
            onChange={(e) => handlePeriodChange(e.target.value as PeriodFilter)}
            className="input py-1.5 text-sm min-w-[120px]"
          >
            {periodOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Custom Date Range */}
        {period === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => {
                setCustomStartDate(e.target.value);
                setOffset(0);
              }}
              className="input py-1.5 text-sm"
            />
            <span className="text-[var(--text-muted)]">~</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => {
                setCustomEndDate(e.target.value);
                setOffset(0);
              }}
              className="input py-1.5 text-sm"
            />
          </div>
        )}

        {/* Event Type Filter */}
        <div className="relative">
          <button
            onClick={() => setShowEventFilter(!showEventFilter)}
            className={`btn btn-secondary text-sm py-1.5 flex items-center gap-2 ${
              selectedEventTypes.length > 0 ? "ring-2 ring-[var(--primary)]" : ""
            }`}
          >
            <Filter className="w-4 h-4" />
            이벤트 유형
            {selectedEventTypes.length > 0 && (
              <span className="bg-[var(--primary)] text-white text-xs px-1.5 rounded-full">
                {selectedEventTypes.length}
              </span>
            )}
            <ChevronDown className="w-4 h-4" />
          </button>

          {showEventFilter && (
            <div className="absolute top-full left-0 mt-1 z-20 glass-card p-3 min-w-[200px] shadow-lg">
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-[var(--glass-border)]">
                <span className="text-sm font-medium">이벤트 유형</span>
                <button
                  onClick={handleClearEventTypes}
                  className="text-xs text-[var(--primary)] hover:underline"
                >
                  초기화
                </button>
              </div>
              <div className="space-y-1">
                {eventTypeOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--glass-bg)] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEventTypes.includes(opt.value)}
                      onChange={() => handleEventTypeToggle(opt.value)}
                      className="rounded border-[var(--glass-border)]"
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
              <button
                onClick={() => setShowEventFilter(false)}
                className="mt-2 w-full btn btn-primary text-sm py-1.5"
              >
                적용
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Timeline Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" />
        </div>
      ) : error ? (
        <div className="glass-card p-6 text-center">
          <p className="text-[var(--danger)]">타임라인을 불러오는 중 오류가 발생했습니다.</p>
        </div>
      ) : !data || data.events.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--glass-bg)] flex items-center justify-center">
            <Calendar className="w-8 h-8 text-[var(--text-muted)]" />
          </div>
          <p className="text-[var(--text-muted)]">표시할 이벤트가 없습니다.</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            기간이나 이벤트 유형 필터를 조정해 보세요.
          </p>
        </div>
      ) : (
        <>
          {/* Event Count */}
          <div className="text-sm text-[var(--text-muted)]">
            총 {data.pagination.total.toLocaleString()}개의 이벤트
          </div>

          {/* Timeline Events */}
          <div className="glass-card p-6">
            {data.events.map((event, index) => (
              <TimelineEventComponent
                key={event.id}
                event={event}
                isLast={index === data.events.length - 1}
              />
            ))}
          </div>

          {/* Load More */}
          {offset + limit < data.pagination.total && (
            <div className="text-center">
              <button onClick={handleLoadMore} className="btn btn-secondary">
                더 보기 ({data.pagination.total - offset - limit}개 더)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

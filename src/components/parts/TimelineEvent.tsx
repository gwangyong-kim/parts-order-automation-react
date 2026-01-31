"use client";

import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw,
  ArrowLeftRight,
  ShoppingCart,
  FileText,
  Package,
  ClipboardCheck,
} from "lucide-react";
import type { TimelineEvent as TimelineEventType, TimelineEventType as EventType } from "@/types/timeline";

interface TimelineEventProps {
  event: TimelineEventType;
  isLast?: boolean;
}

const eventConfig: Record<
  EventType,
  {
    icon: React.ElementType;
    color: string;
    bgColor: string;
    label: string;
  }
> = {
  INBOUND: {
    icon: ArrowDownRight,
    color: "text-[var(--success)]",
    bgColor: "bg-[var(--success)]/10",
    label: "입고",
  },
  OUTBOUND: {
    icon: ArrowUpRight,
    color: "text-[var(--danger)]",
    bgColor: "bg-[var(--danger)]/10",
    label: "출고",
  },
  ADJUSTMENT: {
    icon: RotateCcw,
    color: "text-[var(--warning)]",
    bgColor: "bg-[var(--warning)]/10",
    label: "조정",
  },
  TRANSFER: {
    icon: ArrowLeftRight,
    color: "text-[var(--info)]",
    bgColor: "bg-[var(--info)]/10",
    label: "이동",
  },
  ORDER: {
    icon: ShoppingCart,
    color: "text-[var(--primary)]",
    bgColor: "bg-[var(--primary)]/10",
    label: "발주",
  },
  SALES_ORDER: {
    icon: FileText,
    color: "text-[var(--primary)]",
    bgColor: "bg-[var(--primary)]/10",
    label: "수주",
  },
  PICKING: {
    icon: Package,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    label: "피킹",
  },
  AUDIT: {
    icon: ClipboardCheck,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    label: "실사",
  },
};

function getEventLink(event: TimelineEventType): string | null {
  if (!event.reference) return null;

  switch (event.reference.type) {
    case "ORDER":
      return `/orders?id=${event.reference.id}`;
    case "SALES_ORDER":
      return `/sales-orders?id=${event.reference.id}`;
    case "PICKING":
      return `/picking?id=${event.reference.id}`;
    case "AUDIT":
      return `/audit?id=${event.reference.id}`;
    default:
      return null;
  }
}

function formatQuantityChange(event: TimelineEventType): string {
  const sign = event.type === "INBOUND" ? "+" : event.type === "OUTBOUND" ? "-" : "";
  return `${sign}${event.quantity.toLocaleString()}`;
}

export function TimelineEventComponent({ event, isLast = false }: TimelineEventProps) {
  const config = eventConfig[event.type];
  const Icon = config.icon;
  const link = getEventLink(event);

  const formattedDate = new Date(event.date).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="relative flex gap-4 pb-6">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-[19px] top-10 bottom-0 w-[2px] bg-[var(--glass-border)]" />
      )}

      {/* Icon */}
      <div
        className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center`}
      >
        <Icon className={`w-5 h-5 ${config.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-[var(--text-muted)]">{formattedDate}</span>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded ${config.bgColor} ${config.color}`}
            >
              {config.label}
            </span>
            {event.type === "INBOUND" || event.type === "OUTBOUND" || event.type === "ADJUSTMENT" ? (
              <span
                className={`font-bold ${
                  event.type === "INBOUND"
                    ? "text-[var(--success)]"
                    : event.type === "OUTBOUND"
                    ? "text-[var(--danger)]"
                    : "text-[var(--warning)]"
                }`}
              >
                {formatQuantityChange(event)}
              </span>
            ) : event.type === "ORDER" || event.type === "SALES_ORDER" ? (
              <span className="text-[var(--text-primary)] font-medium">
                {event.quantity.toLocaleString()}개
              </span>
            ) : null}
          </div>

          {event.status && (
            <span
              className={`px-2 py-0.5 text-xs rounded ${
                event.status === "COMPLETED" || event.status === "RECEIVED" || event.status === "PICKED"
                  ? "bg-[var(--success)]/10 text-[var(--success)]"
                  : event.status === "PENDING"
                  ? "bg-[var(--warning)]/10 text-[var(--warning)]"
                  : event.status === "CANCELLED"
                  ? "bg-[var(--danger)]/10 text-[var(--danger)]"
                  : "bg-[var(--glass-bg)] text-[var(--text-muted)]"
              }`}
            >
              {event.status === "COMPLETED" || event.status === "APPROVED"
                ? "완료"
                : event.status === "RECEIVED"
                ? "입고완료"
                : event.status === "PENDING"
                ? "대기"
                : event.status === "IN_PROGRESS"
                ? "진행중"
                : event.status === "PICKED"
                ? "피킹완료"
                : event.status === "CANCELLED"
                ? "취소"
                : event.status}
            </span>
          )}
        </div>

        {/* Details */}
        <div className="mt-1 glass-card p-3 space-y-1">
          {/* Reference */}
          {event.reference && (
            <div className="flex items-center gap-2 text-sm">
              {link ? (
                <Link
                  href={link}
                  className="text-[var(--primary)] hover:underline font-mono"
                >
                  {event.reference.code}
                </Link>
              ) : (
                <span className="text-[var(--text-primary)] font-mono">
                  {event.reference.code}
                </span>
              )}
            </div>
          )}

          {/* Before/After qty for transactions */}
          {(event.beforeQty !== undefined && event.afterQty !== undefined) && (
            <div className="text-sm text-[var(--text-secondary)]">
              <span className="tabular-nums">{event.beforeQty.toLocaleString()}</span>
              <span className="mx-2">→</span>
              <span className="tabular-nums font-medium text-[var(--text-primary)]">
                {event.afterQty.toLocaleString()}
              </span>
            </div>
          )}

          {/* Audit specific: system vs counted */}
          {event.type === "AUDIT" && event.systemQty !== undefined && (
            <div className="text-sm">
              <span className="text-[var(--text-muted)]">시스템: </span>
              <span className="tabular-nums">{event.systemQty.toLocaleString()}</span>
              {event.countedQty !== undefined && (
                <>
                  <span className="mx-2 text-[var(--text-muted)]">/ 실제: </span>
                  <span className="tabular-nums font-medium">{event.countedQty.toLocaleString()}</span>
                </>
              )}
            </div>
          )}

          {/* Picking specific: required vs picked */}
          {event.type === "PICKING" && event.requiredQty !== undefined && (
            <div className="text-sm">
              <span className="text-[var(--text-muted)]">요청: </span>
              <span className="tabular-nums">{event.requiredQty.toLocaleString()}</span>
              {event.pickedQty !== undefined && (
                <>
                  <span className="mx-2 text-[var(--text-muted)]">/ 피킹: </span>
                  <span
                    className={`tabular-nums font-medium ${
                      event.pickedQty >= event.requiredQty
                        ? "text-[var(--success)]"
                        : "text-[var(--warning)]"
                    }`}
                  >
                    {event.pickedQty.toLocaleString()}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Performer */}
          {event.performedBy && (
            <div className="text-sm text-[var(--text-muted)]">
              담당: {event.performedBy}
            </div>
          )}

          {/* Notes */}
          {event.notes && (
            <div className="text-sm text-[var(--text-secondary)]">{event.notes}</div>
          )}
        </div>
      </div>
    </div>
  );
}

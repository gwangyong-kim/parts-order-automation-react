"use client";

import { Package, AlertTriangle, TrendingUp, DollarSign, LucideIcon } from "lucide-react";

export interface StatCard {
  label: string;
  value: string | number;
  subValue?: string;
  color: "primary" | "success" | "warning" | "danger" | "info";
  icon?: LucideIcon;
}

interface ReportStatsProps {
  stats: StatCard[];
}

const colorMap = {
  primary: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/30",
  },
  success: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
  },
  warning: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/30",
  },
  danger: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/30",
  },
  info: {
    bg: "bg-cyan-500/10",
    text: "text-cyan-400",
    border: "border-cyan-500/30",
  },
};

const defaultIcons: Record<string, LucideIcon> = {
  primary: Package,
  success: TrendingUp,
  warning: AlertTriangle,
  danger: AlertTriangle,
  info: DollarSign,
};

export default function ReportStats({ stats }: ReportStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, index) => {
        const colors = colorMap[stat.color];
        const Icon = stat.icon || defaultIcons[stat.color];

        return (
          <div
            key={index}
            className={`glass-card p-4 border-l-4 ${colors.border}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs text-[var(--text-muted)] mb-1">
                  {stat.label}
                </p>
                <p className={`text-2xl font-bold ${colors.text}`}>
                  {typeof stat.value === "number"
                    ? stat.value.toLocaleString()
                    : stat.value}
                </p>
                {stat.subValue && (
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {stat.subValue}
                  </p>
                )}
              </div>
              <div className={`p-2 rounded-lg ${colors.bg}`}>
                <Icon className={`w-5 h-5 ${colors.text}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { BarChart2, Table, FileText } from "lucide-react";

export type TabType = "chart" | "table" | "detail";

interface ReportTabsProps {
  activeTab: TabType;
  onChange: (tab: TabType) => void;
  showDetail?: boolean;
}

const tabs: { id: TabType; label: string; icon: typeof BarChart2 }[] = [
  { id: "chart", label: "차트", icon: BarChart2 },
  { id: "table", label: "테이블", icon: Table },
  { id: "detail", label: "상세 데이터", icon: FileText },
];

export default function ReportTabs({
  activeTab,
  onChange,
  showDetail = true,
}: ReportTabsProps) {
  const visibleTabs = showDetail ? tabs : tabs.slice(0, 2);

  return (
    <div className="flex gap-1 p-1 bg-[var(--glass-bg)] rounded-lg border border-[var(--glass-border)]">
      {visibleTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium
              transition-all duration-200
              ${
                isActive
                  ? "bg-[var(--primary)] text-white shadow-lg"
                  : "text-[var(--text-secondary)] hover:bg-[var(--glass-bg)] hover:text-[var(--text-primary)]"
              }
            `}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

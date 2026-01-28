"use client";

import { useState } from "react";
import { Layout, Map } from "lucide-react";
import WarehouseManagement from "@/components/warehouse/WarehouseManagement";
import WarehouseMapContent from "@/components/warehouse/WarehouseMapContent";

type TabType = "map" | "management";

export default function WarehousePage() {
  const [activeTab, setActiveTab] = useState<TabType>("map");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Layout className="w-8 h-8 text-[var(--primary)]" />
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">창고</h1>
          <p className="text-[var(--text-secondary)]">
            창고 맵과 구역/랙/선반을 관리합니다.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-[var(--glass-border)]">
        <nav className="-mb-px flex gap-4">
          <button
            onClick={() => setActiveTab("map")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "map"
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--gray-300)]"
            }`}
          >
            <Map className="w-4 h-4" />
            창고 맵
          </button>
          <button
            onClick={() => setActiveTab("management")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "management"
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--gray-300)]"
            }`}
          >
            <Layout className="w-4 h-4" />
            창고 관리
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "map" && <WarehouseMapContent />}
      {activeTab === "management" && <WarehouseManagement />}
    </div>
  );
}

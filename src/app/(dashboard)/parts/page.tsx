"use client";

import { useState } from "react";
import { Package, FolderTree } from "lucide-react";
import PartsListContent from "@/components/parts/PartsListContent";
import CategoryManagement from "@/components/parts/CategoryManagement";

type TabType = "parts" | "categories";

export default function PartsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("parts");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">파츠 관리</h1>
        <p className="text-[var(--text-secondary)]">
          파츠 및 카테고리를 등록하고 관리합니다.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-[var(--glass-border)]">
        <nav className="-mb-px flex gap-4">
          <button
            onClick={() => setActiveTab("parts")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "parts"
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--gray-300)]"
            }`}
          >
            <Package className="w-4 h-4" />
            파츠 목록
          </button>
          <button
            onClick={() => setActiveTab("categories")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "categories"
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--gray-300)]"
            }`}
          >
            <FolderTree className="w-4 h-4" />
            카테고리
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "parts" && <PartsListContent />}
      {activeTab === "categories" && <CategoryManagement />}
    </div>
  );
}

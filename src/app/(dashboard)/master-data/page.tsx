"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Package, Box, Truck, FolderTree, Database } from "lucide-react";
import PartsListContent from "@/components/parts/PartsListContent";
import CategoryManagement from "@/components/parts/CategoryManagement";
import ProductsContent from "@/components/master-data/ProductsContent";
import SuppliersContent from "@/components/master-data/SuppliersContent";

type TabType = "parts" | "categories" | "products" | "suppliers";

export default function MasterDataPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("parts");

  // URL 파라미터에서 탭 읽기
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["parts", "categories", "products", "suppliers"].includes(tab)) {
      setActiveTab(tab as TabType);
    }
  }, [searchParams]);

  // 탭 변경 시 URL 파라미터 제거
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    // URL에서 edit 파라미터 제거 (탭 변경 시)
    router.replace("/master-data", { scroll: false });
  };

  const tabs = [
    { id: "parts" as const, label: "파츠", icon: Package },
    { id: "products" as const, label: "제품", icon: Box },
    { id: "suppliers" as const, label: "공급업체", icon: Truck },
    { id: "categories" as const, label: "카테고리", icon: FolderTree },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Database className="w-8 h-8 text-[var(--primary)]" />
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">기준정보</h1>
          <p className="text-[var(--text-secondary)]">
            파츠, 제품, 공급업체 등 기준 정보를 관리합니다.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-[var(--glass-border)]">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--gray-300)]"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "parts" && <PartsListContent />}
      {activeTab === "categories" && <CategoryManagement />}
      {activeTab === "products" && <ProductsContent />}
      {activeTab === "suppliers" && <SuppliersContent />}
    </div>
  );
}

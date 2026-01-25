"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Package, Building2, ShoppingCart, Loader2 } from "lucide-react";

interface SearchResult {
  id: number;
  type: "part" | "order" | "supplier";
  title: string;
  subtitle?: string;
  link: string;
}

const typeConfig = {
  part: { icon: Package, label: "파츠", color: "text-blue-500" },
  order: { icon: ShoppingCart, label: "발주", color: "text-emerald-500" },
  supplier: { icon: Building2, label: "공급업체", color: "text-purple-500" },
};

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Debounced search
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setIsOpen(true);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    setSelectedIndex(-1);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  const handleSelect = (result: SearchResult) => {
    router.push(result.link);
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // 외부 클릭 감지
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 그룹별로 결과 분류
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  // 전체 인덱스 매핑
  let flatIndex = 0;
  const getResultIndex = (type: string, idx: number) => {
    let index = 0;
    for (const t of ["part", "supplier", "order"]) {
      if (t === type) {
        return index + idx;
      }
      index += groupedResults[t]?.length || 0;
    }
    return index;
  };

  return (
    <div className="relative hidden sm:block">
      <div className="header-search relative flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-[var(--gray-400)]" />
        <input
          ref={inputRef}
          type="text"
          placeholder="파츠, 발주, 공급업체 검색..."
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query && results.length > 0 && setIsOpen(true)}
          className="w-72 pl-10 pr-4 py-2 bg-transparent border-none text-sm text-[var(--gray-900)] placeholder:text-[var(--gray-400)] focus:outline-none"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 w-4 h-4 text-[var(--gray-400)] animate-spin" />
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 mt-2 w-80 bg-white rounded-xl border border-[var(--gray-200)] shadow-lg z-50 animate-scale-in overflow-hidden"
        >
          {results.length === 0 ? (
            <div className="p-4 text-center text-[var(--gray-500)] text-sm">
              검색 결과가 없습니다
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {(["part", "supplier", "order"] as const).map((type) => {
                const items = groupedResults[type];
                if (!items || items.length === 0) return null;

                const config = typeConfig[type];
                const Icon = config.icon;

                return (
                  <div key={type}>
                    <div className="px-3 py-2 bg-[var(--gray-50)] border-b border-[var(--gray-100)]">
                      <span className={`text-xs font-medium ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                    {items.map((result, idx) => {
                      const resultIndex = getResultIndex(type, idx);
                      return (
                        <button
                          key={`${result.type}-${result.id}`}
                          onClick={() => handleSelect(result)}
                          className={`w-full px-3 py-2.5 flex items-center gap-3 hover:bg-[var(--gray-50)] transition-colors text-left ${
                            selectedIndex === resultIndex ? "bg-[var(--gray-100)]" : ""
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${config.color}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--gray-900)] truncate">
                              {result.title}
                            </p>
                            {result.subtitle && (
                              <p className="text-xs text-[var(--gray-500)] truncate">
                                {result.subtitle}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

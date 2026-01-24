/**
 * useSearch Hook
 *
 * 검색 및 필터링을 위한 재사용 가능한 훅
 */

import { useState, useMemo, useCallback } from "react";

interface UseSearchConfig<T> {
  /** 검색 대상 데이터 */
  data: T[] | undefined;
  /** 검색할 필드들 (점 표기법 지원: "part.partName") */
  searchFields: (keyof T | string)[];
  /** 초기 검색어 */
  initialSearchTerm?: string;
}

interface UseSearchResult<T> {
  /** 현재 검색어 */
  searchTerm: string;
  /** 검색어 설정 함수 */
  setSearchTerm: (term: string) => void;
  /** 필터링된 데이터 */
  filteredData: T[];
  /** 검색어 초기화 */
  clearSearch: () => void;
  /** 검색어가 있는지 여부 */
  hasSearch: boolean;
}

/**
 * 중첩된 객체에서 값을 가져오는 헬퍼 함수
 */
function getNestedValue(obj: unknown, path: string): unknown {
  return path.split(".").reduce((current: unknown, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function useSearch<T extends object>({
  data,
  searchFields,
  initialSearchTerm = "",
}: UseSearchConfig<T>): UseSearchResult<T> {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);

  const clearSearch = useCallback(() => {
    setSearchTerm("");
  }, []);

  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!searchTerm.trim()) return data;

    const lowerSearchTerm = searchTerm.toLowerCase().trim();

    return data.filter((item) => {
      return searchFields.some((field) => {
        const value = getNestedValue(item, field as string);
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(lowerSearchTerm);
      });
    });
  }, [data, searchTerm, searchFields]);

  return {
    searchTerm,
    setSearchTerm,
    filteredData,
    clearSearch,
    hasSearch: searchTerm.trim().length > 0,
  };
}

// ==================== useFilter Hook ====================

interface FilterConfig<T, K extends keyof T = keyof T> {
  /** 필터 키 */
  key: K;
  /** 필터 값 (null이면 필터 비활성화) */
  value: T[K] | null;
}

interface UseFilterConfig<T> {
  /** 필터링 대상 데이터 */
  data: T[] | undefined;
  /** 초기 필터 설정 */
  initialFilters?: Partial<Record<keyof T, T[keyof T] | null>>;
}

interface UseFilterResult<T> {
  /** 현재 필터 상태 */
  filters: Partial<Record<keyof T, T[keyof T] | null>>;
  /** 필터 설정 */
  setFilter: <K extends keyof T>(key: K, value: T[K] | null) => void;
  /** 특정 필터 토글 (같은 값이면 해제) */
  toggleFilter: <K extends keyof T>(key: K, value: T[K]) => void;
  /** 모든 필터 초기화 */
  clearFilters: () => void;
  /** 필터링된 데이터 */
  filteredData: T[];
  /** 활성화된 필터 개수 */
  activeFilterCount: number;
}

export function useFilter<T extends object>({
  data,
  initialFilters = {},
}: UseFilterConfig<T>): UseFilterResult<T> {
  const [filters, setFilters] = useState<Partial<Record<keyof T, T[keyof T] | null>>>(
    initialFilters
  );

  const setFilter = useCallback(<K extends keyof T>(key: K, value: T[K] | null) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleFilter = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key] === value ? null : value,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const filteredData = useMemo(() => {
    if (!data) return [];

    return data.filter((item) => {
      return Object.entries(filters).every(([key, value]) => {
        if (value === null || value === undefined) return true;
        return item[key as keyof T] === value;
      });
    });
  }, [data, filters]);

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter((v) => v !== null && v !== undefined).length;
  }, [filters]);

  return {
    filters,
    setFilter,
    toggleFilter,
    clearFilters,
    filteredData,
    activeFilterCount,
  };
}

// ==================== useSearchAndFilter Hook ====================

interface UseSearchAndFilterConfig<T> {
  data: T[] | undefined;
  searchFields: (keyof T | string)[];
  initialSearchTerm?: string;
  initialFilters?: Partial<Record<keyof T, T[keyof T] | null>>;
}

export function useSearchAndFilter<T extends object>({
  data,
  searchFields,
  initialSearchTerm = "",
  initialFilters = {},
}: UseSearchAndFilterConfig<T>) {
  const search = useSearch({ data, searchFields, initialSearchTerm });
  const filter = useFilter({ data: search.filteredData, initialFilters });

  const clearAll = useCallback(() => {
    search.clearSearch();
    filter.clearFilters();
  }, [search, filter]);

  return {
    // Search
    searchTerm: search.searchTerm,
    setSearchTerm: search.setSearchTerm,
    clearSearch: search.clearSearch,
    hasSearch: search.hasSearch,
    // Filter
    filters: filter.filters,
    setFilter: filter.setFilter,
    toggleFilter: filter.toggleFilter,
    clearFilters: filter.clearFilters,
    activeFilterCount: filter.activeFilterCount,
    // Combined
    filteredData: filter.filteredData,
    clearAll,
    hasActiveFilters: search.hasSearch || filter.activeFilterCount > 0,
  };
}

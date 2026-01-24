/**
 * usePagination Hook
 *
 * 페이지네이션을 위한 재사용 가능한 훅
 */

import { useState, useMemo, useCallback } from "react";
import { DEFAULTS } from "@/constants/options";

interface UsePaginationConfig {
  /** 전체 아이템 수 */
  totalItems: number;
  /** 페이지당 아이템 수 (기본값: 20) */
  pageSize?: number;
  /** 초기 페이지 (기본값: 1) */
  initialPage?: number;
}

interface UsePaginationResult {
  /** 현재 페이지 (1부터 시작) */
  currentPage: number;
  /** 페이지당 아이템 수 */
  pageSize: number;
  /** 전체 페이지 수 */
  totalPages: number;
  /** 전체 아이템 수 */
  totalItems: number;
  /** 시작 인덱스 (0부터 시작) */
  startIndex: number;
  /** 종료 인덱스 (exclusive) */
  endIndex: number;
  /** 현재 페이지에 표시되는 아이템 수 */
  currentPageSize: number;
  /** 페이지 변경 */
  setPage: (page: number) => void;
  /** 다음 페이지로 이동 */
  nextPage: () => void;
  /** 이전 페이지로 이동 */
  prevPage: () => void;
  /** 첫 페이지로 이동 */
  firstPage: () => void;
  /** 마지막 페이지로 이동 */
  lastPage: () => void;
  /** 페이지 크기 변경 */
  setPageSize: (size: number) => void;
  /** 다음 페이지가 있는지 여부 */
  hasNextPage: boolean;
  /** 이전 페이지가 있는지 여부 */
  hasPrevPage: boolean;
  /** 페이지 번호 배열 (표시용) */
  pageNumbers: number[];
}

export function usePagination({
  totalItems,
  pageSize: initialPageSize = DEFAULTS.PAGE_SIZE,
  initialPage = 1,
}: UsePaginationConfig): UsePaginationResult {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalItems / pageSize)),
    [totalItems, pageSize]
  );

  // 페이지가 범위를 벗어나면 조정
  const validPage = useMemo(
    () => Math.min(Math.max(1, currentPage), totalPages),
    [currentPage, totalPages]
  );

  const startIndex = useMemo(
    () => (validPage - 1) * pageSize,
    [validPage, pageSize]
  );

  const endIndex = useMemo(
    () => Math.min(startIndex + pageSize, totalItems),
    [startIndex, pageSize, totalItems]
  );

  const currentPageSize = useMemo(
    () => endIndex - startIndex,
    [endIndex, startIndex]
  );

  const hasNextPage = validPage < totalPages;
  const hasPrevPage = validPage > 1;

  const setPage = useCallback(
    (page: number) => {
      const newPage = Math.min(Math.max(1, page), totalPages);
      setCurrentPage(newPage);
    },
    [totalPages]
  );

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [hasNextPage]);

  const prevPage = useCallback(() => {
    if (hasPrevPage) {
      setCurrentPage((prev) => prev - 1);
    }
  }, [hasPrevPage]);

  const firstPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const lastPage = useCallback(() => {
    setCurrentPage(totalPages);
  }, [totalPages]);

  const setPageSize = useCallback(
    (size: number) => {
      setPageSizeState(size);
      // 페이지 크기 변경 시 현재 표시 중인 첫 번째 아이템이 보이는 페이지로 이동
      const newPage = Math.floor(startIndex / size) + 1;
      setCurrentPage(Math.max(1, newPage));
    },
    [startIndex]
  );

  // 표시할 페이지 번호 배열 생성 (최대 5개)
  const pageNumbers = useMemo(() => {
    const maxVisible = 5;
    const pages: number[] = [];

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const half = Math.floor(maxVisible / 2);
      let start = validPage - half;
      let end = validPage + half;

      if (start < 1) {
        start = 1;
        end = maxVisible;
      } else if (end > totalPages) {
        end = totalPages;
        start = totalPages - maxVisible + 1;
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }

    return pages;
  }, [totalPages, validPage]);

  return {
    currentPage: validPage,
    pageSize,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    currentPageSize,
    setPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    setPageSize,
    hasNextPage,
    hasPrevPage,
    pageNumbers,
  };
}

// ==================== useClientPagination Hook ====================

interface UseClientPaginationConfig<T> {
  /** 전체 데이터 */
  data: T[] | undefined;
  /** 페이지당 아이템 수 */
  pageSize?: number;
  /** 초기 페이지 */
  initialPage?: number;
}

interface UseClientPaginationResult<T> extends UsePaginationResult {
  /** 현재 페이지의 데이터 */
  paginatedData: T[];
}

export function useClientPagination<T>({
  data,
  pageSize = DEFAULTS.PAGE_SIZE,
  initialPage = 1,
}: UseClientPaginationConfig<T>): UseClientPaginationResult<T> {
  const pagination = usePagination({
    totalItems: data?.length ?? 0,
    pageSize,
    initialPage,
  });

  const paginatedData = useMemo(() => {
    if (!data) return [];
    return data.slice(pagination.startIndex, pagination.endIndex);
  }, [data, pagination.startIndex, pagination.endIndex]);

  return {
    ...pagination,
    paginatedData,
  };
}

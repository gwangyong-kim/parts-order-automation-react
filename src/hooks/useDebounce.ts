/**
 * useDebounce Hook
 *
 * 디바운싱을 위한 재사용 가능한 훅
 */

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * 값 디바운싱 훅
 * @param value 디바운싱할 값
 * @param delay 지연 시간 (ms)
 * @returns 디바운싱된 값
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 콜백 디바운싱 훅
 * @param callback 디바운싱할 콜백 함수
 * @param delay 지연 시간 (ms)
 * @returns 디바운싱된 콜백 함수
 */
export function useDebouncedCallback<T extends (...args: Parameters<T>) => void>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  // 콜백 참조 업데이트
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // 클린업
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );

  return debouncedCallback;
}

/**
 * 디바운싱된 검색 훅
 * @param initialValue 초기 검색어
 * @param delay 지연 시간 (ms)
 */
export function useDebouncedSearch(initialValue: string = "", delay: number = 300) {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  const debouncedSearchTerm = useDebounce(searchTerm, delay);

  const clearSearch = useCallback(() => {
    setSearchTerm("");
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm,
    clearSearch,
    isSearching: searchTerm !== debouncedSearchTerm,
  };
}

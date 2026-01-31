"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type Theme = "light" | "dark" | "system";

const THEME_KEY = "partsync-theme";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  // stale closure 방지를 위한 ref
  const themeRef = useRef(theme);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  // 시스템 테마 감지
  const getSystemTheme = useCallback((): "light" | "dark" => {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }, []);

  // 테마 적용
  const applyTheme = useCallback((newTheme: Theme) => {
    const root = document.documentElement;
    const effectiveTheme = newTheme === "system" ? getSystemTheme() : newTheme;

    if (newTheme === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", newTheme);
    }

    setResolvedTheme(effectiveTheme);
  }, [getSystemTheme]);

  // 테마 변경
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_KEY, newTheme);
    } catch (error) {
      console.warn("[useTheme] Failed to save theme preference:", error);
      // 저장 실패해도 테마는 적용됨 (새로고침 시 초기화)
    }
    applyTheme(newTheme);
  }, [applyTheme]);

  // 테마 토글 (light -> dark -> system -> light ...)
  const toggleTheme = useCallback(() => {
    const nextTheme: Record<Theme, Theme> = {
      light: "dark",
      dark: "system",
      system: "light",
    };
    setTheme(nextTheme[theme]);
  }, [theme, setTheme]);

  // 초기화 및 시스템 테마 변경 감지
  useEffect(() => {
    // 저장된 테마 불러오기
    let savedTheme: Theme | null = null;
    try {
      savedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
    } catch (error) {
      console.warn("[useTheme] Failed to read theme preference:", error);
    }
    const initialTheme = savedTheme || "system";
    setThemeState(initialTheme);
    applyTheme(initialTheme);

    // 시스템 테마 변경 감지 (themeRef 사용으로 stale closure 방지)
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (themeRef.current === "system") {
        setResolvedTheme(getSystemTheme());
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [applyTheme, getSystemTheme]);

  return {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    isDark: resolvedTheme === "dark",
    isLight: resolvedTheme === "light",
    isSystem: theme === "system",
  };
}

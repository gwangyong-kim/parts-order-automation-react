"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

interface ThemeToggleProps {
  variant?: "button" | "dropdown";
  size?: "sm" | "md";
}

export default function ThemeToggle({ variant = "button", size = "md" }: ThemeToggleProps) {
  const { theme, toggleTheme, setTheme, isDark } = useTheme();

  const iconSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const buttonSize = size === "sm" ? "w-8 h-8" : "w-10 h-10";

  const getIcon = () => {
    switch (theme) {
      case "light":
        return <Sun className={iconSize} aria-hidden="true" />;
      case "dark":
        return <Moon className={iconSize} aria-hidden="true" />;
      case "system":
        return <Monitor className={iconSize} aria-hidden="true" />;
    }
  };

  const getLabel = () => {
    switch (theme) {
      case "light":
        return "라이트 모드";
      case "dark":
        return "다크 모드";
      case "system":
        return "시스템 설정";
    }
  };

  if (variant === "button") {
    return (
      <button
        onClick={toggleTheme}
        className={`${buttonSize} flex items-center justify-center rounded-lg transition-colors
          ${isDark
            ? "bg-[var(--gray-100)] text-[var(--text-primary)] hover:bg-[var(--gray-200)]"
            : "bg-[var(--gray-100)] text-[var(--text-secondary)] hover:bg-[var(--gray-200)]"
          }`}
        aria-label={`현재: ${getLabel()}. 클릭하여 테마 변경`}
        title={getLabel()}
      >
        {getIcon()}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 p-1 bg-[var(--gray-100)] rounded-lg">
      <button
        onClick={() => setTheme("light")}
        className={`p-2 rounded-md transition-colors ${
          theme === "light"
            ? "bg-[var(--card-bg)] shadow-sm text-[var(--primary)]"
            : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        }`}
        aria-label="라이트 모드"
        aria-pressed={theme === "light"}
      >
        <Sun className={iconSize} aria-hidden="true" />
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={`p-2 rounded-md transition-colors ${
          theme === "dark"
            ? "bg-[var(--card-bg)] shadow-sm text-[var(--primary)]"
            : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        }`}
        aria-label="다크 모드"
        aria-pressed={theme === "dark"}
      >
        <Moon className={iconSize} aria-hidden="true" />
      </button>
      <button
        onClick={() => setTheme("system")}
        className={`p-2 rounded-md transition-colors ${
          theme === "system"
            ? "bg-[var(--card-bg)] shadow-sm text-[var(--primary)]"
            : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        }`}
        aria-label="시스템 설정 따르기"
        aria-pressed={theme === "system"}
      >
        <Monitor className={iconSize} aria-hidden="true" />
      </button>
    </div>
  );
}

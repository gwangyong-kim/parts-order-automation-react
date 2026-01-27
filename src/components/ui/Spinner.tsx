"use client";

import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-4 h-4 border-2",
  md: "w-8 h-8 border-4",
  lg: "w-12 h-12 border-4",
};

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <div
      className={cn(
        sizeClasses[size],
        "border-[var(--primary)] border-t-transparent rounded-full animate-spin",
        className
      )}
      role="status"
      aria-label="로딩 중"
    />
  );
}

interface PageLoaderProps {
  className?: string;
}

export function PageLoader({ className }: PageLoaderProps) {
  return (
    <div className={cn("flex items-center justify-center h-64", className)}>
      <Spinner size="md" />
    </div>
  );
}

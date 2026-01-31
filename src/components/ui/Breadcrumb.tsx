"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
}

export default function Breadcrumb({ items, showHome = true }: BreadcrumbProps) {
  const allItems: BreadcrumbItem[] = showHome
    ? [{ label: "홈", href: "/" }, ...items]
    : items;

  return (
    <nav aria-label="현재 위치" className="mb-4">
      <ol className="flex items-center gap-1 text-sm text-[var(--text-muted)]">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;
          const isHome = showHome && index === 0;

          return (
            <li key={index} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              )}
              {isLast ? (
                <span
                  className="font-medium text-[var(--text-primary)]"
                  aria-current="page"
                >
                  {item.label}
                </span>
              ) : item.href ? (
                <Link
                  href={item.href}
                  className="flex items-center gap-1 hover:text-[var(--primary)] transition-colors"
                >
                  {isHome && <Home className="w-4 h-4" aria-hidden="true" />}
                  <span className={isHome ? "sr-only sm:not-sr-only" : ""}>
                    {item.label}
                  </span>
                </Link>
              ) : (
                <span className="flex items-center gap-1">
                  {isHome && <Home className="w-4 h-4" aria-hidden="true" />}
                  <span className={isHome ? "sr-only sm:not-sr-only" : ""}>
                    {item.label}
                  </span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Box,
  Truck,
  ShoppingCart,
  ClipboardList,
  Warehouse,
  ArrowLeftRight,
  Calculator,
  ClipboardCheck,
  BarChart3,
  Users,
  Settings,
  Layout,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  children?: { label: string; href: string; icon?: React.ElementType }[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navigationGroups: NavGroup[] = [
  {
    title: "",
    items: [
      { label: "대시보드", href: "/", icon: LayoutDashboard },
    ],
  },
  {
    title: "마스터 데이터",
    items: [
      { label: "파츠 관리", href: "/parts", icon: Package },
      { label: "제품 관리", href: "/products", icon: Box },
      { label: "공급업체", href: "/suppliers", icon: Truck },
    ],
  },
  {
    title: "주문 관리",
    items: [
      { label: "수주 관리", href: "/sales-orders", icon: ShoppingCart },
      { label: "발주 관리", href: "/orders", icon: ClipboardList },
      { label: "피킹 작업", href: "/picking", icon: ListChecks },
    ],
  },
  {
    title: "재고/창고",
    items: [
      { label: "현재고 현황", href: "/inventory", icon: Warehouse },
      { label: "입출고 내역", href: "/transactions", icon: ArrowLeftRight },
      { label: "창고", href: "/warehouse", icon: Layout },
      { label: "실사 관리", href: "/audit", icon: ClipboardCheck },
    ],
  },
  {
    title: "분석/시스템",
    items: [
      { label: "MRP", href: "/mrp", icon: Calculator },
      { label: "리포트", href: "/reports", icon: BarChart3 },
      { label: "사용자 관리", href: "/users", icon: Users },
      { label: "시스템 설정", href: "/settings", icon: Settings },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside className="glass-sidebar fixed left-0 top-0 z-40 h-screen w-64 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.svg"
          alt="glluga"
          className="h-8 w-auto"
        />
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">PartSync</h1>
          <p className="text-xs text-white/50">MRP System</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {navigationGroups.map((group, groupIndex) => (
          <div key={group.title || `group-${groupIndex}`} className="mb-2">
            {group.title && (
              <div className="px-6 py-2">
                <span className="sidebar-nav-group-title">
                  {group.title}
                </span>
              </div>
            )}
            <ul className="space-y-0.5 px-3">
              {group.items.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href!}
                    className={cn(
                      "nav-item",
                      isActive(item.href!) && "active"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <div className="text-xs text-white/40 text-center">
          <p className="font-medium">PartSync v2.0</p>
          <p>React + Next.js Edition</p>
        </div>
      </div>
    </aside>
  );
}

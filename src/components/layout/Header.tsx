"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSession, signOut } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import {
  User,
  LogOut,
  Settings,
  ChevronDown,
  Menu,
} from "lucide-react";
import GlobalSearch from "./GlobalSearch";
import NotificationDropdown from "./NotificationDropdown";
import ThemeToggle from "@/components/ui/ThemeToggle";

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { data: session } = useSession();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuItemsRef = useRef<(HTMLAnchorElement | HTMLButtonElement | null)[]>([]);

  // 사용자 프로필 조회 (프로필 이미지 포함)
  const { data: userProfile } = useQuery({
    queryKey: ["userProfile", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const res = await fetch(`/api/users/${session.user.id}`);
      if (!res.ok) {
        console.error(`[Header] Failed to fetch user profile: ${res.status} ${res.statusText}`, {
          userId: session.user.id,
          status: res.status,
        });
        return null;
      }
      return res.json();
    },
    enabled: !!session?.user?.id,
    staleTime: 1000 * 60 * 5, // 5분간 캐시
  });

  const handleSignOut = useCallback(async () => {
    try {
      await signOut({ callbackUrl: "/login" });
    } catch (error) {
      console.error("[Header] Sign out failed:", error);
      // 사용자에게 알림 표시 가능 (toast 등)
    }
  }, []);

  const menuItems = useMemo(() => [
    { id: "settings", label: "설정", href: "/settings" },
    { id: "logout", label: "로그아웃", action: handleSignOut },
  ], [handleSignOut]);

  const closeMenu = useCallback(() => {
    setShowUserMenu(false);
    setHighlightedIndex(-1);
    buttonRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!showUserMenu) {
        if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setShowUserMenu(true);
          setHighlightedIndex(0);
        }
        return;
      }

      switch (event.key) {
        case "Escape":
          event.preventDefault();
          closeMenu();
          break;
        case "ArrowDown":
          event.preventDefault();
          setHighlightedIndex((prev) =>
            prev < menuItems.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          event.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : menuItems.length - 1
          );
          break;
        case "Home":
          event.preventDefault();
          setHighlightedIndex(0);
          break;
        case "End":
          event.preventDefault();
          setHighlightedIndex(menuItems.length - 1);
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          if (highlightedIndex >= 0) {
            const item = menuItems[highlightedIndex];
            if (item.action) {
              item.action();
            } else if (item.href) {
              window.location.href = item.href;
            }
            closeMenu();
          }
          break;
        case "Tab":
          closeMenu();
          break;
      }
    },
    [showUserMenu, highlightedIndex, menuItems, closeMenu]
  );

  // 하이라이트된 항목으로 포커스 이동
  useEffect(() => {
    if (showUserMenu && highlightedIndex >= 0) {
      menuItemsRef.current[highlightedIndex]?.focus();
    }
  }, [showUserMenu, highlightedIndex]);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    };

    if (showUserMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showUserMenu, closeMenu]);

  return (
    <header className="glass-header sticky top-0 z-30 h-16 px-6 flex items-center justify-between">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          aria-label="메뉴 열기"
          className="p-2 rounded-lg text-[var(--gray-600)] hover:bg-[var(--gray-100)] transition-colors lg:hidden"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>

        {/* Search */}
        <GlobalSearch />
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <ThemeToggle size="sm" />

        {/* Notifications */}
        <NotificationDropdown />

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            ref={buttonRef}
            onClick={() => setShowUserMenu(!showUserMenu)}
            onKeyDown={handleKeyDown}
            aria-haspopup="menu"
            aria-expanded={showUserMenu}
            aria-label="사용자 메뉴"
            className="flex items-center gap-2.5 p-2 pl-2 pr-3 rounded-xl hover:bg-[var(--gray-100)] transition-all"
          >
            <div className="header-user-avatar w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ring-2 ring-[var(--gray-200)] ring-offset-1">
              {userProfile?.profileImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={userProfile.profileImage}
                  alt="프로필"
                  className="w-full h-full object-cover"
                  style={{ imageRendering: 'auto' }}
                />
              ) : (
                <User className="w-5 h-5 text-white" aria-hidden="true" />
              )}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-[var(--gray-900)]">
                {session?.user?.name || "사용자"}
              </p>
              <p className="text-xs text-[var(--gray-500)]">
                {session?.user?.role || "USER"}
              </p>
            </div>
            <ChevronDown className="w-4 h-4 text-[var(--gray-400)] hidden md:block" aria-hidden="true" />
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <div
              role="menu"
              aria-label="사용자 메뉴"
              onKeyDown={handleKeyDown}
              className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-[var(--gray-200)] shadow-lg py-2 z-50 animate-scale-in"
            >
              <div className="px-4 py-3 border-b border-[var(--gray-100)]">
                <p className="text-sm font-semibold text-[var(--gray-900)]">
                  {session?.user?.name}
                </p>
                <p className="text-xs text-[var(--gray-500)] mt-0.5">
                  {session?.user?.email}
                </p>
              </div>
              <div className="py-1">
                <a
                  ref={(el) => { menuItemsRef.current[0] = el; }}
                  href="/settings"
                  role="menuitem"
                  tabIndex={highlightedIndex === 0 ? 0 : -1}
                  onMouseEnter={() => setHighlightedIndex(0)}
                  onClick={closeMenu}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--gray-700)] transition-colors ${
                    highlightedIndex === 0 ? "bg-[var(--gray-100)]" : "hover:bg-[var(--gray-50)]"
                  }`}
                >
                  <Settings className="w-4 h-4 text-[var(--gray-400)]" aria-hidden="true" />
                  설정
                </a>
                <div className="border-t border-[var(--gray-100)] mt-1 pt-1">
                  <button
                    ref={(el) => { menuItemsRef.current[1] = el; }}
                    role="menuitem"
                    tabIndex={highlightedIndex === 1 ? 0 : -1}
                    onMouseEnter={() => setHighlightedIndex(1)}
                    onClick={() => {
                      handleSignOut();
                      closeMenu();
                    }}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--danger-600)] transition-colors w-full text-left ${
                      highlightedIndex === 1 ? "bg-[var(--danger-50)]" : "hover:bg-[var(--danger-50)]"
                    }`}
                  >
                    <LogOut className="w-4 h-4" aria-hidden="true" />
                    로그아웃
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

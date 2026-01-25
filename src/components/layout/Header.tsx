"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  User,
  LogOut,
  Settings,
  ChevronDown,
  Menu,
} from "lucide-react";
import GlobalSearch from "./GlobalSearch";
import NotificationDropdown from "./NotificationDropdown";

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { data: session } = useSession();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <header className="glass-header sticky top-0 z-30 h-16 px-6 flex items-center justify-between">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg text-[var(--gray-600)] hover:bg-[var(--gray-100)] transition-colors lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search */}
        <GlobalSearch />
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <NotificationDropdown />

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 p-2 pl-2 pr-3 rounded-xl hover:bg-[var(--gray-100)] transition-all"
          >
            <div className="header-user-avatar w-8 h-8 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-[var(--gray-900)]">
                {session?.user?.name || "사용자"}
              </p>
              <p className="text-xs text-[var(--gray-500)]">
                {session?.user?.role || "USER"}
              </p>
            </div>
            <ChevronDown className="w-4 h-4 text-[var(--gray-400)] hidden md:block" />
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-[var(--gray-200)] shadow-lg py-2 z-50 animate-scale-in">
                <div className="px-4 py-3 border-b border-[var(--gray-100)]">
                  <p className="text-sm font-semibold text-[var(--gray-900)]">
                    {session?.user?.name}
                  </p>
                  <p className="text-xs text-[var(--gray-500)] mt-0.5">
                    {session?.user?.email}
                  </p>
                </div>
                <ul className="py-1">
                  <li>
                    <a
                      href="/settings/profile"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--gray-700)] hover:bg-[var(--gray-50)] transition-colors"
                    >
                      <User className="w-4 h-4 text-[var(--gray-400)]" />
                      프로필 설정
                    </a>
                  </li>
                  <li>
                    <a
                      href="/settings"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--gray-700)] hover:bg-[var(--gray-50)] transition-colors"
                    >
                      <Settings className="w-4 h-4 text-[var(--gray-400)]" />
                      시스템 설정
                    </a>
                  </li>
                  <li className="border-t border-[var(--gray-100)] mt-1 pt-1">
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--danger-600)] hover:bg-[var(--danger-50)] transition-colors w-full text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      로그아웃
                    </button>
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Check,
  Trash2,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

interface Notification {
  id: number;
  title: string;
  message: string;
  type: "INFO" | "WARNING" | "ERROR" | "SUCCESS";
  category: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

const typeConfig = {
  INFO: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/20" },
  WARNING: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/20" },
  ERROR: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/20" },
  SUCCESS: { icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/20" },
};

async function fetchNotifications(): Promise<NotificationsResponse> {
  const res = await fetch("/api/notifications?limit=10");
  if (!res.ok) throw new Error("Failed to fetch notifications");
  return res.json();
}

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 30000, // 30초마다 갱신
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/notifications/${id}`, { method: "PUT" });
      if (!res.ok) throw new Error("Failed to mark as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/read-all", { method: "POST" });
      if (!res.ok) throw new Error("Failed to mark all as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // 외부 클릭 감지
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = data?.unreadCount || 0;
  const notifications = data?.notifications || [];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl text-[var(--gray-500)] hover:bg-[var(--gray-100)] hover:text-[var(--gray-700)] transition-all"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-[var(--gray-200)] shadow-lg z-50 animate-scale-in overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--gray-100)]">
            <h3 className="font-semibold text-[var(--gray-900)]">알림</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsReadMutation.mutate()}
                className="text-xs text-[var(--primary)] hover:underline"
              >
                모두 읽음
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-[var(--gray-500)]">
                불러오는 중...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-[var(--gray-500)]">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>알림이 없습니다</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const config = typeConfig[notification.type] || typeConfig.INFO;
                const Icon = config.icon;
                return (
                  <div
                    key={notification.id}
                    className={`px-4 py-3 border-b border-[var(--gray-50)] last:border-b-0 hover:bg-[var(--gray-50)] transition-colors ${
                      !notification.isRead ? "bg-blue-50/30" : ""
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className={`p-2 rounded-lg ${config.bg}`}>
                        <Icon className={`w-4 h-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--gray-900)] truncate">
                          {notification.title}
                        </p>
                        <p className="text-xs text-[var(--gray-600)] mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-[10px] text-[var(--gray-400)] mt-1">
                          {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                            locale: ko,
                          })}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1">
                        {!notification.isRead && (
                          <button
                            onClick={() => markAsReadMutation.mutate(notification.id)}
                            className="p-1 rounded hover:bg-[var(--gray-200)] text-[var(--gray-400)] hover:text-[var(--gray-600)]"
                            title="읽음 표시"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteMutation.mutate(notification.id)}
                          className="p-1 rounded hover:bg-red-100 text-[var(--gray-400)] hover:text-red-500"
                          title="삭제"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-[var(--gray-100)] bg-[var(--gray-50)]">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full text-center text-xs text-[var(--primary)] hover:underline"
              >
                닫기
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

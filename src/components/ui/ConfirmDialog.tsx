"use client";

import Modal, { ModalFooter } from "./Modal";
import { AlertTriangle, Trash2, Info } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
}

const variantConfig = {
  danger: {
    icon: Trash2,
    iconBg: "bg-[var(--danger)]/10",
    iconColor: "text-[var(--danger)]",
    buttonClass: "bg-[var(--danger)] hover:bg-[var(--danger)]/90 text-white",
  },
  warning: {
    icon: AlertTriangle,
    iconBg: "bg-[var(--warning)]/10",
    iconColor: "text-[var(--warning)]",
    buttonClass: "bg-[var(--warning)] hover:bg-[var(--warning)]/90 text-white",
  },
  info: {
    icon: Info,
    iconBg: "bg-[var(--info)]/10",
    iconColor: "text-[var(--info)]",
    buttonClass: "bg-[var(--info)] hover:bg-[var(--info)]/90 text-white",
  },
};

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "확인",
  cancelText = "취소",
  variant = "danger",
  isLoading = false,
}: ConfirmDialogProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col items-center text-center py-4">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${config.iconBg}`}
        >
          <Icon className={`w-8 h-8 ${config.iconColor}`} />
        </div>
        <p className="text-[var(--text-secondary)]">{message}</p>
      </div>

      <ModalFooter>
        <button
          type="button"
          onClick={onClose}
          className="btn-secondary"
          disabled={isLoading}
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${config.buttonClass}`}
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              처리 중...
            </span>
          ) : (
            confirmText
          )}
        </button>
      </ModalFooter>
    </Modal>
  );
}

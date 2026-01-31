"use client";

import { useEffect, useCallback, useRef } from "react";

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  handler: () => void;
  description?: string;
  preventDefault?: boolean;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  enableInInputs?: boolean;
}

/**
 * 키보드 단축키를 등록하는 훅
 *
 * @example
 * useKeyboardShortcuts([
 *   { key: 's', ctrl: true, handler: handleSave, description: '저장' },
 *   { key: 'Escape', handler: handleClose, description: '닫기' },
 *   { key: 'k', ctrl: true, handler: openSearch, description: '검색' },
 * ]);
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true, enableInInputs = false } = options;
  const shortcutsRef = useRef(shortcuts);

  // shortcuts가 변경될 때 ref 업데이트
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // input, textarea, contenteditable에서는 기본적으로 비활성화
      if (!enableInInputs) {
        const target = event.target as HTMLElement;
        const tagName = target.tagName.toLowerCase();
        if (
          tagName === "input" ||
          tagName === "textarea" ||
          target.isContentEditable
        ) {
          // Escape 키는 항상 허용
          if (event.key !== "Escape") {
            return;
          }
        }
      }

      for (const shortcut of shortcutsRef.current) {
        const ctrlMatch = shortcut.ctrl
          ? event.ctrlKey || event.metaKey
          : !event.ctrlKey && !event.metaKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const keyMatch =
          event.key.toLowerCase() === shortcut.key.toLowerCase() ||
          event.code === shortcut.key;

        if (ctrlMatch && altMatch && shiftMatch && keyMatch) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          try {
            shortcut.handler();
          } catch (error) {
            console.error(
              `[useKeyboardShortcuts] Handler failed for shortcut: ${shortcut.key}`,
              { shortcut: { key: shortcut.key, description: shortcut.description }, error }
            );
          }
          return;
        }
      }
    },
    [enabled, enableInInputs]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * 단일 키보드 단축키를 등록하는 간편 훅
 */
export function useKeyboardShortcut(
  key: string,
  handler: () => void,
  options: Omit<KeyboardShortcut, "key" | "handler"> &
    UseKeyboardShortcutsOptions = {}
) {
  const { enabled, enableInInputs, ...shortcutOptions } = options;

  useKeyboardShortcuts(
    [{ key, handler, ...shortcutOptions }],
    { enabled, enableInInputs }
  );
}

/**
 * Escape 키 단축키 전용 훅
 */
export function useEscapeKey(handler: () => void, enabled = true) {
  useKeyboardShortcut("Escape", handler, { enabled, enableInInputs: true });
}

/**
 * 저장 단축키 (Ctrl+S / Cmd+S) 전용 훅
 */
export function useSaveShortcut(handler: () => void, enabled = true) {
  useKeyboardShortcut("s", handler, { ctrl: true, enabled });
}

/**
 * 검색 단축키 (Ctrl+K / Cmd+K) 전용 훅
 */
export function useSearchShortcut(handler: () => void, enabled = true) {
  useKeyboardShortcut("k", handler, { ctrl: true, enabled });
}

/**
 * 새로 만들기 단축키 (Ctrl+N / Cmd+N) 전용 훅
 */
export function useNewShortcut(handler: () => void, enabled = true) {
  useKeyboardShortcut("n", handler, { ctrl: true, enabled });
}

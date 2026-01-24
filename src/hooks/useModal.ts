/**
 * useModal Hook
 *
 * 모달 상태 관리를 위한 재사용 가능한 훅
 */

import { useState, useCallback } from "react";

interface UseModalResult<T = unknown> {
  /** 모달 열림 상태 */
  isOpen: boolean;
  /** 모달에 전달할 데이터 */
  data: T | null;
  /** 모달 열기 (데이터 전달 가능) */
  open: (data?: T) => void;
  /** 모달 닫기 */
  close: () => void;
  /** 모달 토글 */
  toggle: () => void;
}

export function useModal<T = unknown>(initialOpen = false): UseModalResult<T> {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [data, setData] = useState<T | null>(null);

  const open = useCallback((modalData?: T) => {
    setData(modalData ?? null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    // 닫을 때 데이터 초기화 (애니메이션 후)
    setTimeout(() => setData(null), 300);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return {
    isOpen,
    data,
    open,
    close,
    toggle,
  };
}

// ==================== useConfirmDialog Hook ====================

interface UseConfirmDialogResult<T = unknown> {
  /** 다이얼로그 열림 상태 */
  isOpen: boolean;
  /** 다이얼로그에 전달할 데이터 */
  data: T | null;
  /** 확인 대기 중인 액션 */
  pendingAction: (() => void) | null;
  /** 확인 다이얼로그 열기 */
  confirm: (data: T, action: () => void) => void;
  /** 확인 다이얼로그 닫기 */
  cancel: () => void;
  /** 확인 후 액션 실행 */
  proceed: () => void;
}

export function useConfirmDialog<T = unknown>(): UseConfirmDialogResult<T> {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const confirm = useCallback((confirmData: T, action: () => void) => {
    setData(confirmData);
    setPendingAction(() => action);
    setIsOpen(true);
  }, []);

  const cancel = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => {
      setData(null);
      setPendingAction(null);
    }, 300);
  }, []);

  const proceed = useCallback(() => {
    if (pendingAction) {
      pendingAction();
    }
    cancel();
  }, [pendingAction, cancel]);

  return {
    isOpen,
    data,
    pendingAction,
    confirm,
    cancel,
    proceed,
  };
}

// ==================== useMultiModal Hook ====================

type ModalKey = string;

interface UseMultiModalResult<T extends Record<ModalKey, unknown>> {
  /** 현재 열린 모달 키 */
  activeModal: keyof T | null;
  /** 특정 모달이 열려있는지 확인 */
  isModalOpen: (key: keyof T) => boolean;
  /** 모달에 전달된 데이터 */
  modalData: Partial<T>;
  /** 특정 모달 열기 */
  openModal: <K extends keyof T>(key: K, data?: T[K]) => void;
  /** 모달 닫기 */
  closeModal: () => void;
  /** 특정 모달의 데이터 가져오기 */
  getModalData: <K extends keyof T>(key: K) => T[K] | undefined;
}

export function useMultiModal<T extends Record<string, unknown>>(): UseMultiModalResult<T> {
  const [activeModal, setActiveModal] = useState<keyof T | null>(null);
  const [modalData, setModalData] = useState<Partial<T>>({});

  const isModalOpen = useCallback(
    (key: keyof T) => activeModal === key,
    [activeModal]
  );

  const openModal = useCallback(<K extends keyof T>(key: K, data?: T[K]) => {
    if (data !== undefined) {
      setModalData((prev) => ({ ...prev, [key]: data }));
    }
    setActiveModal(key);
  }, []);

  const closeModal = useCallback(() => {
    const previousModal = activeModal;
    setActiveModal(null);
    // 닫을 때 데이터 정리 (애니메이션 후)
    setTimeout(() => {
      if (previousModal) {
        setModalData((prev) => {
          const next = { ...prev };
          delete next[previousModal as string];
          return next;
        });
      }
    }, 300);
  }, [activeModal]);

  const getModalData = useCallback(
    <K extends keyof T>(key: K): T[K] | undefined => {
      return modalData[key] as T[K] | undefined;
    },
    [modalData]
  );

  return {
    activeModal,
    isModalOpen,
    modalData,
    openModal,
    closeModal,
    getModalData,
  };
}

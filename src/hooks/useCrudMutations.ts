/**
 * useCrudMutations Hook
 *
 * CRUD 뮤테이션을 위한 재사용 가능한 훅
 */

import { useMutation, useQueryClient, type InvalidateQueryFilters } from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";

interface CrudMessages {
  createSuccess?: string;
  createError?: string;
  updateSuccess?: string;
  updateError?: string;
  deleteSuccess?: string;
  deleteError?: string;
}

interface CrudMutationsConfig<TCreate, TUpdate, TEntity> {
  /** React Query 캐시 키 */
  resourceKey: string | string[];
  /** 생성 함수 */
  createFn?: (data: TCreate) => Promise<TEntity>;
  /** 수정 함수 */
  updateFn?: (id: number, data: TUpdate) => Promise<TEntity>;
  /** 삭제 함수 */
  deleteFn?: (id: number) => Promise<void>;
  /** 추가로 무효화할 쿼리 키들 */
  invalidateKeys?: (string | string[])[];
  /** 성공/에러 메시지 */
  messages?: CrudMessages;
  /** 성공 콜백 */
  onSuccess?: {
    create?: (data: TEntity) => void;
    update?: (data: TEntity) => void;
    delete?: () => void;
  };
  /** 에러 콜백 */
  onError?: {
    create?: (error: Error) => void;
    update?: (error: Error) => void;
    delete?: (error: Error) => void;
  };
}

const defaultMessages: CrudMessages = {
  createSuccess: "생성되었습니다.",
  createError: "생성에 실패했습니다.",
  updateSuccess: "수정되었습니다.",
  updateError: "수정에 실패했습니다.",
  deleteSuccess: "삭제되었습니다.",
  deleteError: "삭제에 실패했습니다.",
};

export function useCrudMutations<
  TCreate = Record<string, unknown>,
  TUpdate = Partial<TCreate>,
  TEntity = TCreate & { id: number }
>(config: CrudMutationsConfig<TCreate, TUpdate, TEntity>) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const messages = { ...defaultMessages, ...config.messages };

  const getQueryKey = (key: string | string[]): string[] =>
    Array.isArray(key) ? key : [key];

  const invalidateQueries = () => {
    // 기본 리소스 키 무효화
    queryClient.invalidateQueries({
      queryKey: getQueryKey(config.resourceKey),
    } as InvalidateQueryFilters);

    // 추가 무효화 키들
    config.invalidateKeys?.forEach((key) => {
      queryClient.invalidateQueries({
        queryKey: getQueryKey(key),
      } as InvalidateQueryFilters);
    });
  };

  const createMutation = useMutation({
    mutationFn: config.createFn || (() => Promise.reject(new Error("Create function not provided"))),
    onSuccess: (data) => {
      invalidateQueries();
      toast.success(messages.createSuccess!);
      config.onSuccess?.create?.(data);
    },
    onError: (error: Error) => {
      toast.error(messages.createError!);
      config.onError?.create?.(error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TUpdate }) =>
      config.updateFn
        ? config.updateFn(id, data)
        : Promise.reject(new Error("Update function not provided")),
    onSuccess: (data) => {
      invalidateQueries();
      toast.success(messages.updateSuccess!);
      config.onSuccess?.update?.(data);
    },
    onError: (error: Error) => {
      toast.error(messages.updateError!);
      config.onError?.update?.(error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: config.deleteFn || (() => Promise.reject(new Error("Delete function not provided"))),
    onSuccess: () => {
      invalidateQueries();
      toast.success(messages.deleteSuccess!);
      config.onSuccess?.delete?.();
    },
    onError: (error: Error) => {
      toast.error(messages.deleteError!);
      config.onError?.delete?.(error);
    },
  });

  return {
    createMutation,
    updateMutation,
    deleteMutation,
    /** 모든 뮤테이션이 진행 중인지 여부 */
    isLoading:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending,
  };
}

// 타입 export
export type { CrudMutationsConfig, CrudMessages };

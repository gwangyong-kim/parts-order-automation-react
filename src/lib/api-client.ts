/**
 * API 클라이언트 추상화
 */

export interface ApiError {
  error: string;
  message?: string;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "요청에 실패했습니다." }));
    throw new Error(error.error || error.message || "요청에 실패했습니다.");
  }
  return response.json();
}

export interface ApiService<T, CreateDTO = Partial<T>, UpdateDTO = Partial<T>> {
  getAll: () => Promise<T[]>;
  getById: (id: number | string) => Promise<T>;
  create: (data: CreateDTO) => Promise<T>;
  update: (id: number | string, data: UpdateDTO) => Promise<T>;
  delete: (id: number | string) => Promise<void>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function createApiService<T, CreateDTO = Partial<T>, UpdateDTO = Partial<T>>(
  basePath: string,
  options?: {
    paginated?: boolean;
  }
): ApiService<T, CreateDTO, UpdateDTO> {
  const { paginated = false } = options || {};

  return {
    async getAll(): Promise<T[]> {
      const url = paginated ? `${basePath}?pageSize=1000` : basePath;
      const response = await fetch(url);
      const result = await handleResponse<T[] | PaginatedResponse<T>>(response);
      return paginated ? (result as PaginatedResponse<T>).data : (result as T[]);
    },

    async getById(id: number | string): Promise<T> {
      const response = await fetch(`${basePath}/${id}`);
      return handleResponse<T>(response);
    },

    async create(data: CreateDTO): Promise<T> {
      const response = await fetch(basePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return handleResponse<T>(response);
    },

    async update(id: number | string, data: UpdateDTO): Promise<T> {
      const response = await fetch(`${basePath}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return handleResponse<T>(response);
    },

    async delete(id: number | string): Promise<void> {
      const response = await fetch(`${basePath}/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "삭제에 실패했습니다." }));
        throw new Error(error.error || error.message || "삭제에 실패했습니다.");
      }
    },
  };
}

// 사전 정의된 API 서비스들
export const categoriesApi = createApiService<{
  id: number;
  code: string;
  name: string;
  description: string | null;
  parentId: number | null;
  _count?: { parts: number };
}>("/api/categories");

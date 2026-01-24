/**
 * API Error Handling
 *
 * 표준화된 API 에러 처리 유틸리티
 */

import { NextResponse } from "next/server";
import type { ZodError } from "zod";

// ==================== 에러 코드 ====================

export const ErrorCode = {
  // 4xx Client Errors
  BAD_REQUEST: "BAD_REQUEST",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  UNPROCESSABLE_ENTITY: "UNPROCESSABLE_ENTITY",

  // 5xx Server Errors
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// ==================== API 에러 클래스 ====================

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCodeType;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: ErrorCodeType = ErrorCode.INTERNAL_SERVER_ERROR,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    // Error 클래스 상속 시 프로토타입 체인 유지
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// ==================== 에러 팩토리 함수 ====================

/**
 * 400 Bad Request
 */
export function badRequest(message: string = "잘못된 요청입니다.", details?: Record<string, unknown>) {
  return new ApiError(message, 400, ErrorCode.BAD_REQUEST, details);
}

/**
 * 400 Validation Error (Zod 에러용)
 */
export function validationError(zodError: ZodError) {
  const fieldErrors: Record<string, string[]> = {};

  // Zod 4 uses 'issues' instead of 'errors'
  const issues = zodError.issues || [];
  for (const issue of issues) {
    const path = issue.path.map(String).join(".");
    if (!fieldErrors[path]) {
      fieldErrors[path] = [];
    }
    fieldErrors[path].push(issue.message);
  }

  return new ApiError(
    "입력값 검증에 실패했습니다.",
    400,
    ErrorCode.VALIDATION_ERROR,
    { fields: fieldErrors }
  );
}

/**
 * 401 Unauthorized
 */
export function unauthorized(message: string = "인증이 필요합니다.") {
  return new ApiError(message, 401, ErrorCode.UNAUTHORIZED);
}

/**
 * 403 Forbidden
 */
export function forbidden(message: string = "접근 권한이 없습니다.") {
  return new ApiError(message, 403, ErrorCode.FORBIDDEN);
}

/**
 * 404 Not Found
 */
export function notFound(resource: string = "리소스") {
  return new ApiError(`${resource}를 찾을 수 없습니다.`, 404, ErrorCode.NOT_FOUND);
}

/**
 * 409 Conflict
 */
export function conflict(message: string = "리소스 충돌이 발생했습니다.") {
  return new ApiError(message, 409, ErrorCode.CONFLICT);
}

/**
 * 422 Unprocessable Entity
 */
export function unprocessableEntity(message: string, details?: Record<string, unknown>) {
  return new ApiError(message, 422, ErrorCode.UNPROCESSABLE_ENTITY, details);
}

/**
 * 500 Internal Server Error
 */
export function serverError(message: string = "서버 오류가 발생했습니다.") {
  return new ApiError(message, 500, ErrorCode.INTERNAL_SERVER_ERROR);
}

/**
 * 500 Database Error
 */
export function databaseError(message: string = "데이터베이스 오류가 발생했습니다.") {
  return new ApiError(message, 500, ErrorCode.DATABASE_ERROR);
}

// ==================== 에러 응답 핸들러 ====================

export interface ApiErrorResponse {
  error: string;
  code: ErrorCodeType;
  details?: Record<string, unknown>;
}

/**
 * 에러를 NextResponse로 변환
 */
export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
  console.error("[API Error]", error);

  // ApiError 인스턴스인 경우
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        ...(error.details && { details: error.details }),
      },
      { status: error.statusCode }
    );
  }

  // Prisma 에러 처리
  if (isPrismaError(error)) {
    return handlePrismaError(error);
  }

  // Zod 에러 처리
  if (isZodError(error)) {
    const apiError = validationError(error);
    return NextResponse.json(
      {
        error: apiError.message,
        code: apiError.code,
        details: apiError.details,
      },
      { status: apiError.statusCode }
    );
  }

  // 일반 Error
  if (error instanceof Error) {
    return NextResponse.json(
      {
        error: error.message || "서버 오류가 발생했습니다.",
        code: ErrorCode.INTERNAL_SERVER_ERROR,
      },
      { status: 500 }
    );
  }

  // 알 수 없는 에러
  return NextResponse.json(
    {
      error: "알 수 없는 오류가 발생했습니다.",
      code: ErrorCode.INTERNAL_SERVER_ERROR,
    },
    { status: 500 }
  );
}

// ==================== Prisma 에러 처리 ====================

interface PrismaError extends Error {
  code?: string;
  meta?: {
    target?: string[];
    field_name?: string;
    model_name?: string;
  };
}

function isPrismaError(error: unknown): error is PrismaError {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof (error as PrismaError).code === "string" &&
    Boolean((error as PrismaError).code?.startsWith("P"))
  );
}

function handlePrismaError(error: PrismaError): NextResponse<ApiErrorResponse> {
  switch (error.code) {
    case "P2002": // Unique constraint violation
      const field = error.meta?.target?.[0] || "필드";
      return NextResponse.json(
        {
          error: `이미 존재하는 ${field}입니다.`,
          code: ErrorCode.CONFLICT,
          details: { field },
        },
        { status: 409 }
      );

    case "P2025": // Record not found
      return NextResponse.json(
        {
          error: "요청한 데이터를 찾을 수 없습니다.",
          code: ErrorCode.NOT_FOUND,
        },
        { status: 404 }
      );

    case "P2003": // Foreign key constraint violation
      return NextResponse.json(
        {
          error: "참조하는 데이터가 존재하지 않습니다.",
          code: ErrorCode.BAD_REQUEST,
        },
        { status: 400 }
      );

    case "P2014": // Required relation violation
      return NextResponse.json(
        {
          error: "필수 관계 데이터가 누락되었습니다.",
          code: ErrorCode.BAD_REQUEST,
        },
        { status: 400 }
      );

    default:
      return NextResponse.json(
        {
          error: "데이터베이스 오류가 발생했습니다.",
          code: ErrorCode.DATABASE_ERROR,
        },
        { status: 500 }
      );
  }
}

// ==================== Zod 에러 처리 ====================

interface ZodErrorLike extends Error {
  errors?: Array<{ path: (string | number)[]; message: string }>;
}

function isZodError(error: unknown): error is ZodError {
  return (
    error instanceof Error &&
    error.name === "ZodError" &&
    "errors" in error &&
    Array.isArray((error as ZodErrorLike).errors)
  );
}

// ==================== API 래퍼 유틸리티 ====================

type ApiHandler<T = unknown> = () => Promise<T>;

/**
 * API 핸들러 래퍼 - 에러 처리 자동화
 */
export async function withErrorHandler<T>(
  handler: ApiHandler<T>
): Promise<NextResponse<T | ApiErrorResponse>> {
  try {
    const result = await handler();
    return NextResponse.json(result as T);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * 성공 응답 생성
 */
export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

/**
 * 생성 성공 응답 (201)
 */
export function createdResponse<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

/**
 * 삭제 성공 응답 (204 또는 200)
 */
export function deletedResponse(message: string = "삭제되었습니다.") {
  return NextResponse.json({ message }, { status: 200 });
}

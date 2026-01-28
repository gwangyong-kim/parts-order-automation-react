# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

PartSync MRP는 부품 주문 자동화 및 재고 관리를 위한 자재 소요량 계획(MRP) 시스템입니다. Next.js 16, React 19, SQLite(Prisma ORM)로 구축되었으며, 한국어 UI를 사용합니다.

## 명령어

```bash
# 개발
npm run dev              # 개발 서버 실행 (포트 3000)
npm run build            # 프로덕션 빌드
npm run lint             # ESLint 검사

# 데이터베이스
npm run db:generate      # Prisma 클라이언트 생성
npm run db:push          # 스키마 변경사항 DB에 적용
npm run db:seed          # 개발용 시드 데이터 입력
npm run db:studio        # Prisma Studio GUI 실행

# Docker
docker-compose up -d                                      # 프로덕션 컨테이너 시작
docker-compose down && docker-compose up --build -d       # 리빌드
docker-compose logs -f                                    # 로그 확인
docker-compose down -v                                    # 데이터 초기화 (볼륨 삭제)
```

## 아키텍처

### 데이터 흐름
1. **페이지** (`src/app/(dashboard)/*/page.tsx`) - TanStack Query로 데이터 페칭하는 클라이언트 컴포넌트
2. **API 라우트** (`src/app/api/*/route.ts`) - Prisma를 사용하는 REST 엔드포인트
3. **서비스** (`src/services/*.ts`) - 비즈니스 로직 (MRP 계산, 재고 관리)
4. **Prisma** (`prisma/schema.prisma`) - 데이터베이스 모델 및 관계

### 주요 패턴

**상태 관리:**
- TanStack Query: 서버 상태 (mutation 시 쿼리 무효화)
- Zustand: 클라이언트 상태 (최소 사용)

**폼 검증:**
- React Hook Form + Zod 스키마
- 스키마 위치: `src/schemas/*.ts` (예: `part.schema.ts`)

**API 패턴:**
```typescript
// route.ts 파일의 표준 CRUD 패턴
export async function GET(req: NextRequest) { ... }
export async function POST(req: NextRequest) { ... }
// [id]/route.ts에서 단일 리소스 작업
export async function PUT(req: NextRequest, { params }) { ... }
export async function DELETE(req: NextRequest, { params }) { ... }
```

**대량 업로드:**
- Excel 업로드: `src/components/ui/ExcelUpload.tsx`
- API 엔드포인트: `/api/*/bulk/route.ts`
- 업로드 로그: `BulkUploadLog` 모델에서 추적

### 데이터베이스 스키마 (주요 모델)

- **마스터 데이터:** Part, Product, Category, Supplier, BomItem
- **운영:** SalesOrder, Order, Transaction, Inventory, PickingTask
- **창고:** Warehouse → Zone → Rack → Shelf (계층 구조)
- **분석:** MrpResult, AuditRecord, DiscrepancyLog

위치 코드 형식: `{Zone}-{Rack}-{Shelf}` (예: "A-01-02")

### 인증
NextAuth.js credentials provider 사용. 대시보드 라우트는 `src/app/(dashboard)/layout.tsx`에서 보호됨.

기본 계정: `admin` / `admin123`

### UI 컴포넌트
- CSS 변수 기반 커스텀 glassmorphism 테마
- 재사용 컴포넌트: `src/components/ui/`
- Toast 알림: `useToast()` 훅 사용
- 아이콘: `lucide-react`

## 파일 명명 규칙

- 페이지: `page.tsx` (Next.js App Router)
- API: `route.ts`, 동적 세그먼트는 `[param]/`
- 컴포넌트: PascalCase (예: `PartForm.tsx`)
- 타입: `src/types/entities.ts` (도메인 모델용)
- 스키마: `src/schemas/*.schema.ts` (Zod 검증용)

## Docker 배포

SQLite 데이터베이스는 Docker 볼륨의 `/app/data/partsync.db`에 저장됩니다. 백업은 호스트의 `./backups/` 디렉토리에 저장됩니다. Cloudflare R2 클라우드 백업을 지원합니다.

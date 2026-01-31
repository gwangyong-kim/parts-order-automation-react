# PartSync MRP

부품 주문 자동화 및 재고 관리 시스템 (MRP - Material Requirements Planning)

## 주요 기능

- **대시보드**: 실시간 재고 현황, 주문 상태, 알림 확인
- **파츠 관리**: 부품 등록/수정/삭제, 카테고리 분류, 공급업체 연동, 이력 타임라인
- **제품 관리**: 완제품 BOM(Bill of Materials) 관리
- **재고 관리**: 실시간 재고 수량 추적, 안전재고 알림
- **주문 관리**: 발주 생성/승인/완료 프로세스
- **판매 주문**: 수주 관리 및 출하 처리
- **피킹 작업**: 창고 출고 작업 관리
- **창고 관리**: 창고/존/랙/선반 위치 관리
- **MRP 계산**: 자재 소요량 자동 계산
- **리포트**: 재고현황, 주문이력, 비용분석 등 다양한 보고서
- **감사 로그**: 모든 데이터 변경 이력 추적
- **다크 모드**: 시스템 설정 연동 및 수동 테마 전환 지원
- **접근성(A11y)**: 키보드 네비게이션, 스크린 리더 지원, WCAG 준수

## 기술 스택

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: SQLite (Prisma ORM)
- **Authentication**: NextAuth.js
- **State Management**: Zustand, TanStack Query
- **Charts**: Recharts
- **Form**: React Hook Form, Zod

## 시작하기

### 로컬 개발 환경

```bash
# 의존성 설치
npm install

# Prisma 클라이언트 생성
npm run db:generate

# 데이터베이스 스키마 적용
npm run db:push

# 시드 데이터 입력 (선택)
npm run db:seed

# 개발 서버 실행
npm run dev
```

http://localhost:4000에서 확인

### Docker 배포

```bash
# 이미지 빌드 및 컨테이너 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 컨테이너 중지
docker-compose down
```

http://localhost:3000 에서 확인

### Docker 볼륨 초기화 (데이터 리셋)

```bash
docker-compose down -v
docker-compose up -d
```

## 프로젝트 구조

```
src/
├── app/
│   ├── (dashboard)/      # 대시보드 페이지들
│   │   ├── parts/        # 파츠 관리
│   │   ├── products/     # 제품 관리
│   │   ├── orders/       # 발주 관리
│   │   ├── sales-orders/ # 판매 주문
│   │   ├── inventory/    # 재고 관리
│   │   ├── warehouse/    # 창고 관리
│   │   ├── picking/      # 피킹 작업
│   │   ├── mrp/          # MRP 계산
│   │   ├── reports/      # 리포트
│   │   └── ...
│   ├── api/              # API 라우트
│   └── login/            # 로그인 페이지
├── components/           # 재사용 컴포넌트
│   ├── ui/               # 기본 UI 컴포넌트
│   ├── forms/            # 폼 컴포넌트
│   ├── charts/           # 차트 컴포넌트
│   ├── layout/           # 레이아웃 컴포넌트
│   └── ...
├── lib/                  # 유틸리티 함수
├── services/             # 비즈니스 로직
├── schemas/              # Zod 스키마
└── types/                # TypeScript 타입 정의

prisma/
├── schema.prisma         # 데이터베이스 스키마
├── seed.ts               # 로컬 시드 스크립트
└── seed-docker.ts        # Docker용 시드 스크립트
```

## 환경 변수

```env
# 데이터베이스
DATABASE_URL=file:./dev.db

# 인증
AUTH_SECRET=your-secret-key
AUTH_URL=http://localhost:3000
```

## 기본 계정

| 사용자명 | 비밀번호 | 역할 |
|---------|---------|------|
| admin | admin123 | 관리자 |

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 프로덕션 서버 실행 |
| `npm run lint` | ESLint 검사 |
| `npm run db:push` | DB 스키마 적용 |
| `npm run db:generate` | Prisma 클라이언트 생성 |
| `npm run db:seed` | 시드 데이터 입력 |
| `npm run db:studio` | Prisma Studio 실행 |

## 라이선스

Private

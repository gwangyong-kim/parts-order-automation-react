"use client";

import { useState } from "react";
import { HelpCircle, X, ChevronRight, Lightbulb, AlertTriangle, CheckCircle2 } from "lucide-react";
import Modal from "./Modal";

interface GuideSection {
  title: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
}

interface UsageGuideProps {
  title: string;
  description?: string;
  sections: GuideSection[];
  tips?: string[];
  warnings?: string[];
}

export default function UsageGuide({
  title,
  description,
  sections,
  tips,
  warnings,
}: UsageGuideProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(0);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn btn-secondary"
        title="사용 가이드"
      >
        <HelpCircle className="w-5 h-5" />
        사용 가이드
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={title}
        size="xl"
      >
        <div className="space-y-6">
          {description && (
            <p className="text-[var(--text-secondary)]">{description}</p>
          )}

          {/* Section Navigation */}
          <div className="flex flex-wrap gap-2 border-b border-[var(--glass-border)] pb-4">
            {sections.map((section, index) => (
              <button
                key={index}
                onClick={() => setActiveSection(index)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeSection === index
                    ? "bg-[var(--primary)] text-white"
                    : "bg-[var(--gray-100)] text-[var(--text-secondary)] hover:bg-[var(--gray-200)]"
                }`}
              >
                {section.title}
              </button>
            ))}
          </div>

          {/* Active Section Content */}
          <div className="min-h-[300px]">
            <div className="flex items-center gap-2 mb-4">
              {sections[activeSection].icon}
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                {sections[activeSection].title}
              </h3>
            </div>
            <div className="prose prose-sm max-w-none text-[var(--text-secondary)]">
              {sections[activeSection].content}
            </div>
          </div>

          {/* Tips */}
          {tips && tips.length > 0 && (
            <div className="bg-[var(--success)]/10 border border-[var(--success)]/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-5 h-5 text-[var(--success)]" />
                <h4 className="font-semibold text-[var(--success)]">유용한 팁</h4>
              </div>
              <ul className="space-y-2">
                {tips.map((tip, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-[var(--success)] mt-0.5 flex-shrink-0" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {warnings && warnings.length > 0 && (
            <div className="bg-[var(--warning)]/10 border border-[var(--warning)]/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-[var(--warning)]" />
                <h4 className="font-semibold text-[var(--warning)]">주의사항</h4>
              </div>
              <ul className="space-y-2">
                {warnings.map((warning, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <ChevronRight className="w-4 h-4 text-[var(--warning)] mt-0.5 flex-shrink-0" />
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

// Pre-defined guide content for warehouse pages
export const WAREHOUSE_GUIDE_SECTIONS: GuideSection[] = [
  {
    title: "개요",
    content: (
      <div className="space-y-4">
        <p>
          <strong>창고 관리</strong>는 물리적 창고의 레이아웃을 디지털로 구성하고 관리하는 기능입니다.
        </p>
        <div className="bg-[var(--gray-50)] rounded-lg p-4">
          <h4 className="font-semibold mb-2">창고 구조 계층</h4>
          <div className="flex items-center gap-2 text-sm">
            <span className="px-3 py-1 bg-[var(--primary)] text-white rounded">창고 (Warehouse)</span>
            <ChevronRight className="w-4 h-4" />
            <span className="px-3 py-1 bg-[#10B981] text-white rounded">Zone</span>
            <ChevronRight className="w-4 h-4" />
            <span className="px-3 py-1 bg-[#F59E0B] text-white rounded">Rack</span>
            <ChevronRight className="w-4 h-4" />
            <span className="px-3 py-1 bg-[#8B5CF6] text-white rounded">Shelf</span>
          </div>
        </div>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>창고:</strong> 물리적 건물 또는 공간 단위</li>
          <li><strong>Zone:</strong> 창고 내 구역 (예: A구역, B구역)</li>
          <li><strong>Rack:</strong> Zone 내 선반대/랙</li>
          <li><strong>Shelf:</strong> Rack의 개별 선반 (자동 생성)</li>
        </ul>
      </div>
    ),
  },
  {
    title: "창고 등록",
    content: (
      <div className="space-y-4">
        <h4 className="font-semibold">단일 창고 등록</h4>
        <ol className="list-decimal list-inside space-y-2">
          <li>"창고 등록" 버튼 클릭</li>
          <li>창고 정보 입력:
            <ul className="list-disc list-inside ml-6 mt-1 text-sm">
              <li><strong>창고 코드:</strong> 고유 식별자 (예: WH01, MAIN)</li>
              <li><strong>창고명:</strong> 표시 이름</li>
              <li><strong>맵 너비/높이:</strong> 레이아웃 편집 시 캔버스 크기</li>
            </ul>
          </li>
          <li>"등록" 클릭하여 저장</li>
        </ol>

        <div className="border-t border-[var(--glass-border)] pt-4 mt-4">
          <h4 className="font-semibold">대량 등록 (Excel/CSV)</h4>
          <ol className="list-decimal list-inside space-y-2">
            <li>"대량 등록" 버튼 클릭</li>
            <li>템플릿 다운로드 및 데이터 입력</li>
            <li>파일 업로드 및 미리보기 확인</li>
            <li>"업로드 실행"으로 등록 완료</li>
          </ol>
          <div className="bg-[var(--info)]/10 rounded-lg p-3 mt-3 text-sm">
            <strong>대량 등록 시:</strong> 창고, Zone, Rack을 한 번에 등록 가능합니다.
            동일 창고코드가 있으면 기존 데이터를 업데이트합니다.
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "레이아웃 편집",
    content: (
      <div className="space-y-4">
        <p>창고 카드의 "레이아웃 편집" 버튼으로 상세 편집 페이지로 이동합니다.</p>

        <h4 className="font-semibold">Zone 추가</h4>
        <ol className="list-decimal list-inside space-y-1">
          <li>"Zone 추가" 버튼 클릭</li>
          <li>Zone 코드 (A, B, C 등) 및 이름 입력</li>
          <li>색상 선택 (맵에서 구분용)</li>
          <li>위치(X, Y) 및 크기(너비, 높이) 설정</li>
        </ol>

        <h4 className="font-semibold mt-4">Rack 추가</h4>
        <ol className="list-decimal list-inside space-y-1">
          <li>Zone 카드에서 "+ 추가" 클릭</li>
          <li>Row 번호 입력 (01, 02 등)</li>
          <li>선반 수 설정 (기본 4개)</li>
          <li>Shelf는 Rack 생성 시 자동 생성됨</li>
        </ol>

        <div className="bg-[var(--gray-50)] rounded-lg p-4 mt-4">
          <h4 className="font-semibold mb-2">위치 코드 형식</h4>
          <code className="text-lg font-mono bg-white px-3 py-1 rounded border">
            Zone코드-Rack번호-Shelf번호
          </code>
          <p className="text-sm mt-2">예: <code>A-01-02</code> = Zone A, Rack 01, Shelf 02</p>
        </div>
      </div>
    ),
  },
  {
    title: "위치 코드 체계",
    content: (
      <div className="space-y-4">
        <p>파츠의 <strong>저장위치(storageLocation)</strong>는 아래 형식을 따릅니다:</p>

        <div className="bg-[var(--gray-50)] rounded-lg p-4">
          <div className="font-mono text-center text-xl mb-4">
            <span className="px-2 py-1 bg-[#3B82F6] text-white rounded">A</span>
            <span className="mx-1">-</span>
            <span className="px-2 py-1 bg-[#10B981] text-white rounded">01</span>
            <span className="mx-1">-</span>
            <span className="px-2 py-1 bg-[#F59E0B] text-white rounded">02</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm text-center">
            <div>
              <div className="font-semibold text-[#3B82F6]">Zone 코드</div>
              <div>A, B, C...</div>
            </div>
            <div>
              <div className="font-semibold text-[#10B981]">Rack 번호</div>
              <div>01, 02, 03...</div>
            </div>
            <div>
              <div className="font-semibold text-[#F59E0B]">Shelf 번호</div>
              <div>01, 02, 03...</div>
            </div>
          </div>
        </div>

        <h4 className="font-semibold">파츠 위치 연동</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>파츠 등록/수정 시 "저장위치" 필드에 위치 코드 입력</li>
          <li>창고 맵에서 해당 위치 클릭 시 저장된 파츠 목록 표시</li>
          <li>피킹 작업 시 위치 코드로 네비게이션 안내</li>
        </ul>
      </div>
    ),
  },
];

export const FLOOR_MAP_GUIDE_SECTIONS: GuideSection[] = [
  {
    title: "개요",
    content: (
      <div className="space-y-4">
        <p>
          <strong>창고 맵</strong>은 창고의 전체 레이아웃을 시각화하고,
          특정 위치를 검색하여 해당 위치의 파츠 정보를 확인할 수 있는 기능입니다.
        </p>
        <div className="bg-[var(--gray-50)] rounded-lg p-4">
          <h4 className="font-semibold mb-2">주요 기능</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>창고 레이아웃 시각화 (Zone/Rack 배치)</li>
            <li>위치 코드 검색 및 하이라이트</li>
            <li>위치별 보관 파츠 조회</li>
            <li>다중 창고 전환</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: "위치 검색",
    content: (
      <div className="space-y-4">
        <h4 className="font-semibold">검색 방법</h4>
        <ol className="list-decimal list-inside space-y-2">
          <li>상단 검색창에 위치 코드 입력 (예: A-01-02)</li>
          <li>"위치 찾기" 버튼 클릭 또는 Enter</li>
          <li>맵에서 해당 위치가 하이라이트됨</li>
          <li>우측 패널에서 상세 정보 확인</li>
        </ol>

        <div className="bg-[var(--info)]/10 rounded-lg p-3 text-sm">
          <strong>팁:</strong> 맵에서 직접 Rack을 클릭해도 위치 정보를 조회할 수 있습니다.
        </div>

        <h4 className="font-semibold mt-4">표시되는 정보</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>위치 코드 (Zone-Rack-Shelf)</li>
          <li>해당 Zone 및 Rack 정보</li>
          <li>보관 중인 파츠 목록</li>
          <li>각 파츠의 현재 재고량</li>
        </ul>
      </div>
    ),
  },
  {
    title: "맵 사용법",
    content: (
      <div className="space-y-4">
        <h4 className="font-semibold">맵 구성 요소</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 border rounded-lg">
            <div className="w-full h-8 bg-[#3B82F6]/20 border-2 border-[#3B82F6] rounded mb-2" />
            <p className="text-sm font-medium">Zone 영역</p>
            <p className="text-xs text-[var(--text-muted)]">색상으로 구분</p>
          </div>
          <div className="p-3 border rounded-lg">
            <div className="w-8 h-8 bg-[var(--gray-200)] border border-[var(--gray-400)] rounded mx-auto mb-2" />
            <p className="text-sm font-medium">Rack</p>
            <p className="text-xs text-[var(--text-muted)]">클릭하여 조회</p>
          </div>
        </div>

        <h4 className="font-semibold mt-4">다중 창고 전환</h4>
        <p className="text-sm">
          등록된 창고가 여러 개인 경우, 우측 상단 드롭다운에서 창고를 선택할 수 있습니다.
          위치 검색 시 다른 창고의 위치를 검색하면 자동으로 해당 창고로 전환됩니다.
        </p>
      </div>
    ),
  },
  {
    title: "파츠 정보",
    content: (
      <div className="space-y-4">
        <p>위치를 선택하면 우측 패널에서 해당 위치에 보관된 파츠 정보를 확인할 수 있습니다.</p>

        <h4 className="font-semibold">표시 정보</h4>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>파츠 코드:</strong> 클릭 시 파츠 상세 페이지로 이동</li>
          <li><strong>파츠명:</strong> 품목 이름</li>
          <li><strong>현재 재고:</strong> 실시간 재고 수량</li>
          <li><strong>단위:</strong> EA, SET, BOX 등</li>
        </ul>

        <div className="bg-[var(--warning)]/10 rounded-lg p-3 text-sm mt-4">
          <strong>참고:</strong> 파츠 정보는 파츠 등록 시 입력한 "저장위치" 필드를 기준으로 표시됩니다.
          파츠의 저장위치가 없거나 창고 구조와 맞지 않으면 표시되지 않습니다.
        </div>
      </div>
    ),
  },
];

export const WAREHOUSE_GUIDE_TIPS = [
  "Zone 코드는 A, B, C처럼 간단하게 지정하면 관리가 편합니다.",
  "맵 크기(너비/높이)는 실제 창고 비율에 맞게 설정하세요.",
  "대량 등록 템플릿을 활용하면 초기 설정이 빠릅니다.",
  "파츠 저장위치와 창고 구조를 일치시켜야 맵에서 정확히 표시됩니다.",
];

export const WAREHOUSE_GUIDE_WARNINGS = [
  "Zone 삭제 시 하위 Rack과 Shelf가 모두 삭제됩니다.",
  "창고 삭제 시 해당 창고의 모든 데이터가 삭제됩니다.",
  "위치 코드 형식이 맞지 않으면 맵에서 파츠가 표시되지 않습니다.",
];

export const FLOOR_MAP_GUIDE_TIPS = [
  "위치 코드는 대소문자 구분 없이 검색됩니다.",
  "맵에서 직접 Rack을 클릭하면 빠르게 조회할 수 있습니다.",
  "X 버튼으로 검색을 초기화할 수 있습니다.",
];

export const FLOOR_MAP_GUIDE_WARNINGS = [
  "등록된 창고가 없으면 맵이 표시되지 않습니다.",
  "파츠의 저장위치가 창고 구조와 맞지 않으면 위치 조회가 안 됩니다.",
];

// Layout Edit Page Guide
export const LAYOUT_EDIT_GUIDE_SECTIONS: GuideSection[] = [
  {
    title: "개요",
    content: (
      <div className="space-y-4">
        <p>
          <strong>레이아웃 편집</strong>에서는 창고 내 Zone과 Rack을 시각적으로 배치하고 관리합니다.
        </p>
        <div className="bg-[var(--gray-50)] rounded-lg p-4">
          <h4 className="font-semibold mb-2">화면 구성</h4>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>좌측:</strong> Zone/Rack 목록 및 관리 패널</li>
            <li><strong>우측:</strong> 창고 맵 미리보기</li>
            <li><strong>미리보기 모드:</strong> 전체 화면으로 맵 확인</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: "Zone 관리",
    content: (
      <div className="space-y-4">
        <h4 className="font-semibold">Zone 추가</h4>
        <ol className="list-decimal list-inside space-y-2">
          <li>"Zone 추가" 버튼 클릭</li>
          <li>정보 입력:
            <ul className="list-disc list-inside ml-6 mt-1 text-sm">
              <li><strong>Zone 코드:</strong> A, B, C 등 (1~2자)</li>
              <li><strong>Zone 이름:</strong> Fast Moving, 보관구역 등</li>
              <li><strong>색상:</strong> 맵에서 구분용</li>
              <li><strong>위치/크기:</strong> X, Y, 너비, 높이</li>
            </ul>
          </li>
          <li>"추가" 클릭</li>
        </ol>

        <h4 className="font-semibold mt-4">Zone 삭제</h4>
        <p className="text-sm">
          Zone 카드 우측 휴지통 아이콘 클릭 → 확인 후 삭제
        </p>
        <div className="bg-[var(--warning)]/10 rounded-lg p-3 text-sm">
          <strong>주의:</strong> Zone 삭제 시 포함된 모든 Rack과 Shelf가 함께 삭제됩니다.
        </div>
      </div>
    ),
  },
  {
    title: "Rack 관리",
    content: (
      <div className="space-y-4">
        <h4 className="font-semibold">Rack 추가</h4>
        <ol className="list-decimal list-inside space-y-2">
          <li>Zone 카드에서 "+ 추가" 클릭</li>
          <li>정보 입력:
            <ul className="list-disc list-inside ml-6 mt-1 text-sm">
              <li><strong>Row 번호:</strong> 01, 02, 03 등</li>
              <li><strong>선반 수:</strong> 해당 Rack의 선반 개수</li>
              <li><strong>위치 X, Y:</strong> Zone 내 상대 위치</li>
            </ul>
          </li>
          <li>"추가" 클릭</li>
        </ol>

        <div className="bg-[var(--info)]/10 rounded-lg p-3 text-sm mt-4">
          <strong>참고:</strong> Shelf는 Rack 생성 시 선반 수에 따라 자동 생성됩니다 (01, 02, 03...)
        </div>

        <h4 className="font-semibold mt-4">Rack 삭제</h4>
        <p className="text-sm">
          Rack 태그에 마우스를 올리면 삭제 버튼이 나타납니다.
        </p>
      </div>
    ),
  },
  {
    title: "위치 좌표 이해",
    content: (
      <div className="space-y-4">
        <p>Zone과 Rack의 위치는 좌표계를 사용합니다.</p>

        <div className="bg-[var(--gray-50)] rounded-lg p-4">
          <h4 className="font-semibold mb-2">좌표계</h4>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><strong>원점 (0, 0):</strong> 맵 좌측 상단</li>
            <li><strong>X축:</strong> 오른쪽으로 증가</li>
            <li><strong>Y축:</strong> 아래쪽으로 증가</li>
          </ul>
        </div>

        <h4 className="font-semibold mt-4">Zone 위치</h4>
        <p className="text-sm">창고 맵 전체 기준 절대 좌표</p>

        <h4 className="font-semibold mt-4">Rack 위치</h4>
        <p className="text-sm">해당 Zone 내 상대 좌표 (Zone 좌측 상단 기준)</p>

        <div className="bg-[var(--info)]/10 rounded-lg p-3 text-sm mt-4">
          <strong>팁:</strong> 처음에는 기본값으로 생성 후, 맵 미리보기를 보면서 좌표를 조정하세요.
        </div>
      </div>
    ),
  },
  {
    title: "미리보기 모드",
    content: (
      <div className="space-y-4">
        <p>"미리보기" 버튼을 클릭하면 편집 패널이 숨겨지고 맵이 전체 화면으로 표시됩니다.</p>

        <h4 className="font-semibold">미리보기에서 확인할 것</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>Zone 배치가 겹치지 않는지</li>
          <li>Rack이 Zone 영역 안에 있는지</li>
          <li>전체적인 레이아웃이 실제 창고와 유사한지</li>
        </ul>

        <p className="text-sm mt-4">
          다시 "편집 모드" 버튼을 클릭하면 좌측 편집 패널이 나타납니다.
        </p>
      </div>
    ),
  },
];

export const LAYOUT_EDIT_GUIDE_TIPS = [
  "Zone을 먼저 배치한 후 Rack을 추가하면 구조가 명확해집니다.",
  "미리보기 모드로 전체 레이아웃을 확인하며 조정하세요.",
  "비슷한 Zone은 같은 색상 계열로 지정하면 구분이 쉽습니다.",
  "실제 창고 도면을 참고하여 비율을 맞추면 직관적입니다.",
];

export const LAYOUT_EDIT_GUIDE_WARNINGS = [
  "Zone 삭제 시 포함된 모든 Rack과 Shelf가 함께 삭제됩니다.",
  "Rack 삭제 시 해당 위치에 연결된 파츠 정보는 유지되지만 맵에서 표시되지 않습니다.",
  "좌표가 맵 크기를 벗어나면 화면에 표시되지 않을 수 있습니다.",
];

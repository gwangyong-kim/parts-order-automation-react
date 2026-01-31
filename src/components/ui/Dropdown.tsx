"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useId,
  createContext,
  useContext,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropdownOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface DropdownContextValue {
  isOpen: boolean;
  highlightedIndex: number;
  selectedValue: string | number | null;
  options: DropdownOption[];
  onSelect: (value: string | number) => void;
  setHighlightedIndex: (index: number) => void;
  listId: string;
  buttonId: string;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdownContext() {
  const context = useContext(DropdownContext);
  if (!context) {
    throw new Error("Dropdown compound components must be used within Dropdown");
  }
  return context;
}

interface DropdownProps {
  value: string | number | null;
  onChange: (value: string | number) => void;
  options: DropdownOption[];
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export default function Dropdown({
  value,
  onChange,
  options,
  placeholder = "선택하세요",
  label,
  error,
  disabled = false,
  className,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const buttonId = useId();
  const listId = useId();
  const errorId = useId();

  // 선택된 옵션 찾기
  const selectedOption = options.find((opt) => opt.value === value);

  // 드롭다운 열기/닫기
  const toggleOpen = useCallback(() => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
  }, [disabled]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, []);

  // 옵션 선택
  const handleSelect = useCallback(
    (optionValue: string | number) => {
      const option = options.find((opt) => opt.value === optionValue);
      if (option?.disabled) return;

      onChange(optionValue);
      closeDropdown();
      buttonRef.current?.focus();
    },
    [onChange, options, closeDropdown]
  );

  // 키보드 내비게이션
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (disabled) return;

      const enabledOptions = options.filter((opt) => !opt.disabled);
      const enabledIndices = options
        .map((opt, idx) => (!opt.disabled ? idx : -1))
        .filter((idx) => idx !== -1);

      switch (event.key) {
        case "Enter":
        case " ":
          event.preventDefault();
          if (isOpen && highlightedIndex >= 0) {
            handleSelect(options[highlightedIndex].value);
          } else {
            setIsOpen(true);
            // 열릴 때 현재 선택된 값 또는 첫 번째 옵션 하이라이트
            const currentIndex = options.findIndex((opt) => opt.value === value);
            setHighlightedIndex(
              currentIndex >= 0 ? currentIndex : enabledIndices[0] ?? 0
            );
          }
          break;

        case "Escape":
          event.preventDefault();
          closeDropdown();
          buttonRef.current?.focus();
          break;

        case "ArrowDown":
          event.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            const currentIndex = options.findIndex((opt) => opt.value === value);
            setHighlightedIndex(
              currentIndex >= 0 ? currentIndex : enabledIndices[0] ?? 0
            );
          } else {
            // 다음 활성화된 옵션으로 이동
            const currentPos = enabledIndices.indexOf(highlightedIndex);
            const nextPos = Math.min(currentPos + 1, enabledIndices.length - 1);
            setHighlightedIndex(enabledIndices[nextPos]);
          }
          break;

        case "ArrowUp":
          event.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            const currentIndex = options.findIndex((opt) => opt.value === value);
            setHighlightedIndex(
              currentIndex >= 0
                ? currentIndex
                : enabledIndices[enabledIndices.length - 1] ?? 0
            );
          } else {
            // 이전 활성화된 옵션으로 이동
            const currentPos = enabledIndices.indexOf(highlightedIndex);
            const prevPos = Math.max(currentPos - 1, 0);
            setHighlightedIndex(enabledIndices[prevPos]);
          }
          break;

        case "Home":
          event.preventDefault();
          if (isOpen && enabledIndices.length > 0) {
            setHighlightedIndex(enabledIndices[0]);
          }
          break;

        case "End":
          event.preventDefault();
          if (isOpen && enabledIndices.length > 0) {
            setHighlightedIndex(enabledIndices[enabledIndices.length - 1]);
          }
          break;

        case "Tab":
          if (isOpen) {
            closeDropdown();
          }
          break;
      }
    },
    [
      disabled,
      isOpen,
      highlightedIndex,
      options,
      value,
      handleSelect,
      closeDropdown,
    ]
  );

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        closeDropdown();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, closeDropdown]);

  // 하이라이트된 옵션 스크롤로 보이게
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[
        highlightedIndex
      ] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [isOpen, highlightedIndex]);

  return (
    <DropdownContext.Provider
      value={{
        isOpen,
        highlightedIndex,
        selectedValue: value,
        options,
        onSelect: handleSelect,
        setHighlightedIndex,
        listId,
        buttonId,
      }}
    >
      <div ref={containerRef} className={cn("space-y-1.5", className)}>
        {label && (
          <label
            id={`${buttonId}-label`}
            className="block text-sm font-medium text-[var(--text-secondary)]"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <button
            ref={buttonRef}
            id={buttonId}
            type="button"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-controls={listId}
            aria-labelledby={label ? `${buttonId}-label` : undefined}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? errorId : undefined}
            aria-activedescendant={
              isOpen && highlightedIndex >= 0
                ? `${listId}-option-${highlightedIndex}`
                : undefined
            }
            disabled={disabled}
            onClick={toggleOpen}
            onKeyDown={handleKeyDown}
            className={cn(
              "input w-full text-left flex items-center justify-between gap-2 pr-10",
              error && "border-[var(--danger)] focus:ring-[var(--danger)]",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <span
              className={cn(
                "truncate",
                !selectedOption && "text-[var(--text-muted)]"
              )}
            >
              {selectedOption?.label || placeholder}
            </span>
            <ChevronDown
              className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] transition-transform",
                isOpen && "rotate-180"
              )}
              aria-hidden="true"
            />
          </button>

          {isOpen && (
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-labelledby={label ? `${buttonId}-label` : buttonId}
              tabIndex={-1}
              className="absolute z-50 w-full mt-1 py-1 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-lg max-h-60 overflow-auto animate-slide-down"
            >
              {options.map((option, index) => (
                <li
                  key={option.value}
                  id={`${listId}-option-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled}
                  onClick={() => !option.disabled && handleSelect(option.value)}
                  onMouseEnter={() =>
                    !option.disabled && setHighlightedIndex(index)
                  }
                  className={cn(
                    "px-3 py-2 text-sm cursor-pointer transition-colors",
                    option.value === value &&
                      "bg-[var(--primary-50)] text-[var(--primary-600)]",
                    highlightedIndex === index &&
                      option.value !== value &&
                      "bg-[var(--gray-100)]",
                    option.disabled &&
                      "opacity-50 cursor-not-allowed text-[var(--text-muted)]"
                  )}
                >
                  {option.label}
                </li>
              ))}
            </ul>
          )}
        </div>
        {error && (
          <p id={errorId} role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        )}
      </div>
    </DropdownContext.Provider>
  );
}

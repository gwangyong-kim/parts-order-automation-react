/**
 * Hooks Index
 *
 * 모든 커스텀 훅 통합 export
 */

// CRUD Mutations
export {
  useCrudMutations,
  type CrudMutationsConfig,
  type CrudMessages,
} from "./useCrudMutations";

// Search and Filter
export {
  useSearch,
  useFilter,
  useSearchAndFilter,
} from "./useSearch";

// Pagination
export {
  usePagination,
  useClientPagination,
} from "./usePagination";

// Modal
export {
  useModal,
  useConfirmDialog,
  useMultiModal,
} from "./useModal";

// Debounce
export {
  useDebounce,
  useDebouncedCallback,
  useDebouncedSearch,
} from "./useDebounce";

// Theme
export { useTheme } from "./useTheme";

// Keyboard Shortcuts
export {
  useKeyboardShortcuts,
  useKeyboardShortcut,
  useEscapeKey,
  useSaveShortcut,
  useSearchShortcut,
  useNewShortcut,
} from "./useKeyboardShortcuts";

/**
 * API Request/Response Types
 *
 * API 요청 및 응답 타입 정의
 */

import type {
  Part,
  Product,
  Supplier,
  Category,
  Order,
  SalesOrder,
  User,
  AuditRecord,
  Inventory,
  Transaction,
  MrpResult,
  BomItem,
  OrderItem,
  SalesOrderItem,
  AuditItem,
} from "./entities";

// ==================== Common Types ====================

export interface ApiError {
  error: string;
  code?: string;
  details?: Record<string, string[]>;
}

export interface ApiSuccess<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ==================== Part API ====================

export interface PartCreateInput {
  partNumber: string;
  partName: string;
  description?: string | null;
  categoryId?: number | null;
  supplierId?: number | null;
  unit: string;
  unitPrice: number;
  safetyStock: number;
  reorderPoint?: number;
  minOrderQty: number;
  leadTime: number;
  storageLocation?: string | null;
  notes?: string | null;
}

export interface PartUpdateInput extends Partial<PartCreateInput> {
  isActive?: boolean;
}

export type PartResponse = Part;
export type PartListResponse = Part[];

// ==================== Product API ====================

export interface ProductCreateInput {
  productCode: string;
  productName: string;
  description?: string | null;
  category?: string | null;
  unit: string;
  notes?: string | null;
}

export interface ProductUpdateInput extends Partial<ProductCreateInput> {
  isActive?: boolean;
}

export interface BomItemInput {
  partId: number;
  quantityPerUnit: number;
  lossRate?: number;
  notes?: string | null;
}

export interface ProductWithBomInput extends ProductCreateInput {
  bomItems?: BomItemInput[];
}

export type ProductResponse = Product & { bomItems?: (BomItem & { part?: Part })[] };
export type ProductListResponse = Product[];

// ==================== Supplier API ====================

export interface SupplierCreateInput {
  code: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  leadTimeDays?: number;
  paymentTerms?: string | null;
  notes?: string | null;
}

export interface SupplierUpdateInput extends Partial<SupplierCreateInput> {
  isActive?: boolean;
}

export type SupplierResponse = Supplier;
export type SupplierListResponse = Supplier[];

// ==================== Category API ====================

export interface CategoryCreateInput {
  code: string;
  name: string;
  parentId?: number | null;
  description?: string | null;
}

export interface CategoryUpdateInput extends Partial<CategoryCreateInput> {}

export type CategoryResponse = Category;
export type CategoryListResponse = Category[];

// ==================== Order (Purchase) API ====================

export interface OrderItemInput {
  partId: number;
  orderQty: number;
  unitPrice?: number | null;
  expectedDate?: string | null;
  notes?: string | null;
}

export interface OrderCreateInput {
  supplierId: number;
  project?: string | null;
  orderDate: string;
  expectedDate?: string | null;
  notes?: string | null;
  items: OrderItemInput[];
}

export interface OrderUpdateInput {
  project?: string | null;
  expectedDate?: string | null;
  notes?: string | null;
  items?: OrderItemInput[];
}

export interface OrderStatusUpdateInput {
  status: string;
  approvedBy?: string | null;
}

export interface OrderReceiveInput {
  itemId: number;
  receivedQty: number;
  notes?: string | null;
}

export type OrderResponse = Order & {
  supplier?: Supplier;
  items?: (OrderItem & { part?: Part })[];
};
export type OrderListResponse = Order[];

// ==================== Sales Order API ====================

export interface SalesOrderItemInput {
  productId: number;
  orderQty: number;
  notes?: string | null;
}

export interface SalesOrderCreateInput {
  orderDate: string;
  division?: string | null;
  manager?: string | null;
  project?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  items: SalesOrderItemInput[];
}

export interface SalesOrderUpdateInput extends Partial<Omit<SalesOrderCreateInput, "items">> {
  status?: string;
  items?: SalesOrderItemInput[];
}

export type SalesOrderResponse = SalesOrder & {
  items?: (SalesOrderItem & { product?: Product })[];
};
export type SalesOrderListResponse = SalesOrder[];

// ==================== Inventory API ====================

export interface InventoryWithPart extends Inventory {
  part: Part & {
    safetyStock: number;
  };
}

export type InventoryResponse = InventoryWithPart;
export type InventoryListResponse = InventoryWithPart[];

// ==================== Transaction API ====================

export interface TransactionCreateInput {
  partId: number;
  transactionType: string;
  quantity: number;
  reason?: string | null;
  notes?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
}

export type TransactionResponse = Transaction;
export type TransactionListResponse = Transaction[];

// ==================== MRP API ====================

export interface MrpCalculateResponse {
  message: string;
  resultsCount: number;
}

export interface MrpResultWithPart extends MrpResult {
  part: Part;
}

export type MrpResultResponse = MrpResultWithPart;
export type MrpResultListResponse = MrpResultWithPart[];

// ==================== Audit API ====================

export interface AuditCreateInput {
  auditDate: string;
  auditType: string;
  notes?: string | null;
  partIds?: number[]; // specific parts to audit, or all if empty
}

export interface AuditItemUpdateInput {
  countedQty: number;
  notes?: string | null;
}

export interface AuditCompleteInput {
  notes?: string | null;
}

export type AuditResponse = AuditRecord & {
  items?: (AuditItem & { part?: Part })[];
};
export type AuditListResponse = AuditRecord[];

// ==================== User API ====================

export interface UserCreateInput {
  username: string;
  email?: string | null;
  password: string;
  name: string;
  role: string;
  department?: string | null;
}

export interface UserUpdateInput {
  email?: string | null;
  name?: string;
  role?: string;
  department?: string | null;
  isActive?: boolean;
}

export interface UserPasswordChangeInput {
  currentPassword?: string;
  newPassword: string;
}

export type UserResponse = Omit<User, "passwordHash">;
export type UserListResponse = Omit<User, "passwordHash">[];

// ==================== Reports API ====================

export interface ReportDateRangeParams {
  startDate?: string;
  endDate?: string;
}

export interface DashboardStats {
  totalParts: number;
  lowStockParts: number;
  totalInventoryValue: number;
  pendingOrders: number;
  criticalMrpItems: number;
  pendingAudits: number;
  recentTransactions: Transaction[];
  topMovingParts: {
    part: Part;
    totalQty: number;
  }[];
}

export interface InventoryReport {
  parts: (Part & {
    inventory: Inventory;
    transactions: Transaction[];
  })[];
  totalValue: number;
  lowStockCount: number;
  categoryBreakdown: {
    category: string;
    count: number;
    value: number;
  }[];
}

export interface OrderReport {
  orders: Order[];
  totalOrders: number;
  totalAmount: number;
  statusBreakdown: {
    status: string;
    count: number;
    amount: number;
  }[];
  supplierBreakdown: {
    supplier: Supplier;
    orderCount: number;
    totalAmount: number;
  }[];
}

// ==================== Auth API ====================

export interface LoginInput {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: UserResponse;
  token?: string;
}

export interface SessionUser {
  id: number;
  username: string;
  name: string;
  role: string;
  email?: string | null;
}

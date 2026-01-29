/**
 * Domain Entity Types
 *
 * Prisma 스키마와 매핑되는 도메인 엔티티 타입 정의
 * Note: 프론트엔드에서는 partNumber/partName 사용, DB에서는 partCode/partName
 */

// ==================== User & Auth ====================

export type UserRole = "ADMIN" | "MANAGER" | "OPERATOR" | "VIEWER";

export interface User {
  id: number;
  username: string;
  email: string | null;
  name: string;
  role: UserRole;
  department: string | null;
  theme: string;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: number;
  role: string;
  resource: string;
  action: string;
}

export interface UserActivityLog {
  id: number;
  userId: number;
  action: string;
  resource: string | null;
  resourceId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
  user?: User;
}

// ==================== Master Data ====================

export interface Supplier {
  id: number;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  leadTimeDays: number;
  paymentTerms: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: number;
  code: string;
  name: string;
  parentId: number | null;
  description: string | null;
  createdAt: string;
  parent?: Category | null;
  children?: Category[];
}

export interface Part {
  id: number;
  partNumber: string; // maps to partCode in DB
  partName: string;
  description: string | null;
  categoryId: number | null;
  supplierId: number | null;
  unit: string;
  unitPrice: number;
  safetyStock: number;
  reorderPoint: number;
  minOrderQty: number;
  leadTime: number; // maps to leadTimeDays in DB
  storageLocation: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  category?: Category | null;
  supplier?: Supplier | null;
}

export interface Product {
  id: number;
  productCode: string;
  productName: string;
  description: string | null;
  category: string | null;
  unit: string;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  bomItems?: BomItem[];
}

export interface BomItem {
  id: number;
  productId: number;
  partId: number;
  quantityPerUnit: number;
  lossRate: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  product?: Product;
  part?: Part;
}

// ==================== Operations ====================

export type SalesOrderStatus = "RECEIVED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface SalesOrder {
  id: number;
  orderCode: string;
  orderDate: string;
  division: string | null;
  manager: string | null;
  project: string | null;
  dueDate: string | null;
  status: SalesOrderStatus;
  totalQty: number;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  items?: SalesOrderItem[];
}

export type SalesOrderItemStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";

export interface SalesOrderItem {
  id: number;
  salesOrderId: number;
  productId: number;
  orderQty: number;
  producedQty: number;
  status: SalesOrderItemStatus;
  notes: string | null;
  salesOrder?: SalesOrder;
  product?: Product;
}

export type OrderStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "ORDERED" | "PARTIAL" | "RECEIVED" | "CANCELLED";

export interface Order {
  id: number;
  orderCode: string;
  supplierId: number;
  project: string | null;
  orderDate: string;
  expectedDate: string | null;
  actualDate: string | null;
  status: OrderStatus;
  totalAmount: number;
  notes: string | null;
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  supplier?: Supplier;
  items?: OrderItem[];
}

export type OrderItemStatus = "PENDING" | "PARTIAL" | "RECEIVED" | "CANCELLED";

export interface OrderItem {
  id: number;
  orderId: number;
  partId: number;
  salesOrderId: number | null;
  orderQty: number;
  receivedQty: number;
  unitPrice: number | null;
  totalPrice: number | null;
  expectedDate: string | null;
  status: OrderItemStatus;
  notes: string | null;
  order?: Order;
  part?: Part;
  salesOrder?: SalesOrder;
}

export interface Inventory {
  id: number;
  partId: number;
  currentQty: number;
  reservedQty: number;
  incomingQty: number;
  availableQty: number; // computed: currentQty - reservedQty
  lastInboundDate: string | null;
  lastOutboundDate: string | null;
  lastAuditDate: string | null;
  lastAuditQty: number | null;
  updatedAt: string;
  part?: Part;
}

export type TransactionType = "INBOUND" | "OUTBOUND" | "ADJUSTMENT" | "TRANSFER";

export interface Transaction {
  id: number;
  transactionCode: string;
  partId: number;
  transactionType: TransactionType;
  quantity: number;
  beforeQty: number;
  afterQty: number;
  referenceType: string | null;
  referenceId: string | null;
  unitPrice: number | null;
  totalAmount: number | null;
  reason: string | null;
  performedBy: string | null;
  notes: string | null;
  transactionDate: string;
  createdAt: string;
  part?: Part;
  createdBy?: { id: number; name: string } | null;
}

// ==================== Analysis & Reporting ====================

export type MrpUrgency = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type MrpStatus = "PENDING" | "ORDERED" | "COMPLETED";

export interface MrpResult {
  id: number;
  calculationDate: string;
  salesOrderId: number | null;
  partId: number;
  grossRequirement: number;
  currentStock: number;
  reservedQty: number;
  incomingQty: number;
  netRequirement: number;
  suggestedOrderQty: number;
  suggestedOrderDate: string | null;
  status: MrpStatus;
  urgency: MrpUrgency;
  createdAt: string;
  salesOrder?: SalesOrder | null;
  part?: Part;
}

export type AuditType = "MONTHLY" | "QUARTERLY" | "YEARLY" | "SPOT";
export type AuditStatus = "IN_PROGRESS" | "COMPLETED" | "APPROVED";

export interface AuditRecord {
  id: number;
  auditCode: string;
  auditDate: string;
  auditType: AuditType;
  status: AuditStatus;
  totalItems: number;
  matchedItems: number;
  discrepancyItems: number;
  performedBy: string | null;
  approvedBy: string | null;
  notes: string | null;
  createdAt: string;
  completedAt: string | null;
  items?: AuditItem[];
}

export interface AuditItem {
  id: number;
  auditId: number;
  partId: number;
  systemQty: number;
  countedQty: number | null;
  discrepancy: number | null;
  notes: string | null;
  countedAt: string | null;
  audit?: AuditRecord;
  part?: Part;
}

export type DiscrepancyStatus = "OPEN" | "INVESTIGATING" | "RESOLVED";

export interface DiscrepancyLog {
  id: number;
  partId: number;
  detectedDate: string;
  systemQty: number;
  actualQty: number;
  discrepancy: number;
  discrepancyType: string | null;
  causeCategory: string | null;
  causeDetail: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  status: DiscrepancyStatus;
  notes: string | null;
  createdAt: string;
  part?: Part;
}

// ==================== External Integration ====================

export type SyncType = "SALES_ORDER" | "PARTS" | "INVENTORY";

export interface GoogleSheetsSyncConfig {
  id: number;
  name: string;
  syncType: SyncType;
  spreadsheetId: string;
  sheetName: string;
  dataRange: string;
  keyColumn: string | null;
  columnMapping: string | null;
  isActive: boolean;
  lastSyncAt: string | null;
  lastSyncChecksum: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SyncHistoryStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export interface GoogleSheetsSyncHistory {
  id: number;
  configId: number;
  syncType: string;
  startedAt: string;
  completedAt: string | null;
  status: SyncHistoryStatus;
  totalRows: number;
  insertedRows: number;
  updatedRows: number;
  skippedRows: number;
  errorRows: number;
  errorDetails: string | null;
  config?: GoogleSheetsSyncConfig;
}

export interface GoogleSheetsRowTracking {
  id: number;
  configId: number;
  rowKey: string;
  rowChecksum: string;
  localId: number | null;
  lastSeenAt: string | null;
  config?: GoogleSheetsSyncConfig;
}

/**
 * Schemas Index
 *
 * 모든 Zod 스키마 통합 export
 */

// Part schemas
export {
  partSchema,
  partUpdateSchema,
  partApiSchema,
  type PartFormData,
  type PartUpdateData,
  type PartApiData,
} from "./part.schema";

// Product schemas
export {
  bomItemSchema,
  productSchema,
  productUpdateSchema,
  type BomItemFormData,
  type ProductFormData,
  type ProductUpdateData,
} from "./product.schema";

// Supplier schemas
export {
  supplierSchema,
  supplierUpdateSchema,
  type SupplierFormData,
  type SupplierUpdateData,
} from "./supplier.schema";

// Order schemas
export {
  orderItemSchema,
  orderSchema,
  orderUpdateSchema,
  orderStatusSchema,
  orderReceiveSchema,
  type OrderItemFormData,
  type OrderFormData,
  type OrderUpdateData,
  type OrderStatusData,
  type OrderReceiveData,
} from "./order.schema";

// Sales Order schemas
export {
  salesOrderStatusSchema,
  salesOrderItemSchema,
  salesOrderSchema,
  salesOrderUpdateSchema,
  type SalesOrderStatus,
  type SalesOrderItemFormData,
  type SalesOrderFormData,
  type SalesOrderUpdateData,
} from "./sales-order.schema";

// User schemas
export {
  userRoleSchema,
  userSchema,
  userUpdateSchema,
  passwordChangeSchema,
  loginSchema,
  type UserRole,
  type UserFormData,
  type UserUpdateData,
  type PasswordChangeData,
  type LoginData,
} from "./user.schema";

// Transaction schemas
export {
  transactionTypeSchema,
  transactionSchema,
  adjustmentSchema,
  type TransactionType,
  type TransactionFormData,
  type AdjustmentFormData,
} from "./transaction.schema";

// Audit schemas
export {
  auditTypeSchema,
  auditStatusSchema,
  auditSchema,
  auditItemSchema,
  auditCompleteSchema,
  discrepancyResolveSchema,
  type AuditType,
  type AuditStatus,
  type AuditFormData,
  type AuditItemFormData,
  type AuditCompleteData,
  type DiscrepancyResolveData,
} from "./audit.schema";

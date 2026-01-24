/**
 * Services Index
 *
 * 모든 서비스 통합 export
 */

// MRP Service
export {
  calculateMrp,
  getMrpResults,
  updateMrpResultStatus,
  getLowStockParts,
  getUrgencyLevel,
  getDaysBetween,
  calculateOrderDate,
  type MrpCalculationInput,
  type MrpCalculationResult,
  type MrpSummary,
} from "./mrp.service";

// Inventory Service
export {
  processTransaction,
  adjustInventory,
  reserveInventory,
  releaseReservation,
  getInventoryStatus,
  getLowStockAlerts,
  getTransactionHistory,
  generateTransactionCode,
  calculateAvailableQty,
  type TransactionInput,
  type AdjustmentInput,
  type TransactionResult,
} from "./inventory.service";

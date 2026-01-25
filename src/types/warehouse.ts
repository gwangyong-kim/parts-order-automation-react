export interface Warehouse {
  id: number;
  code: string;
  name: string;
  description: string | null;
  address: string | null;
  width: number;
  height: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  zones?: Zone[];
}

export interface Zone {
  id: number;
  warehouseId: number;
  code: string;
  name: string;
  description: string | null;
  color: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  racks?: Rack[];
}

export interface Rack {
  id: number;
  zoneId: number;
  rowNumber: string;
  posX: number;
  posY: number;
  shelfCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  shelves?: Shelf[];
}

export interface Shelf {
  id: number;
  rackId: number;
  shelfNumber: string;
  capacity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  locationCode?: string;
  partCount?: number;
}

export interface WarehouseLayout extends Warehouse {
  zones: (Zone & {
    racks: (Rack & {
      shelves: (Shelf & {
        locationCode: string;
        partCount: number;
      })[];
    })[];
  })[];
  partCountByLocation: Record<string, number>;
}

export interface LocationLookup {
  locationCode: string;
  shelf: {
    id: number;
    shelfNumber: string;
    capacity: number;
  };
  rack: {
    id: number;
    rowNumber: string;
    posX: number;
    posY: number;
  };
  zone: {
    id: number;
    code: string;
    name: string;
    color: string;
    posX: number;
    posY: number;
  };
  warehouse: {
    id: number;
    code: string;
    name: string;
  };
  parts: {
    id: number;
    partCode: string;
    partName: string;
    unit: string;
    currentQty: number;
    category: string | null;
  }[];
  partCount: number;
}

// Picking types
export type PickingTaskPriority = "URGENT" | "HIGH" | "NORMAL" | "LOW";
export type PickingTaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type PickingItemStatus = "PENDING" | "IN_PROGRESS" | "PICKED" | "SKIPPED";

export interface PickingTask {
  id: number;
  taskCode: string;
  salesOrderId: number | null;
  transactionId: number | null;
  priority: PickingTaskPriority;
  status: PickingTaskStatus;
  assignedTo: string | null;
  startedAt: string | null;
  completedAt: string | null;
  totalItems: number;
  pickedItems: number;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  items?: PickingItem[];
  salesOrder?: {
    id: number;
    orderCode: string;
    project: string | null;
  };
}

export interface PickingItem {
  id: number;
  pickingTaskId: number;
  partId: number;
  storageLocation: string;
  requiredQty: number;
  pickedQty: number;
  status: PickingItemStatus;
  sequence: number;
  scannedAt: string | null;
  verifiedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  part?: {
    id: number;
    partCode: string;
    partName: string;
    unit: string;
  };
}

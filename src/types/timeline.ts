/**
 * Timeline Types
 *
 * 파츠 타임라인 기능을 위한 타입 정의
 */

export type TimelineEventType =
  | "INBOUND"
  | "OUTBOUND"
  | "ADJUSTMENT"
  | "TRANSFER"
  | "ORDER"
  | "SALES_ORDER"
  | "PICKING"
  | "AUDIT";

export interface TimelineEventReference {
  type: string;
  code: string;
  id: number;
}

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  date: string;
  quantity: number;
  beforeQty?: number;
  afterQty?: number;
  reference?: TimelineEventReference;
  performedBy?: string;
  notes?: string;
  status?: string;
  // Additional fields for specific event types
  fromLocation?: string;
  toLocation?: string;
  systemQty?: number;
  countedQty?: number;
  requiredQty?: number;
  pickedQty?: number;
}

export interface PartTimelineResponse {
  part: {
    id: number;
    partNumber: string;
    partName: string;
    currentStock: number;
  };
  events: TimelineEvent[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface TimelineFilters {
  startDate?: string;
  endDate?: string;
  eventTypes?: TimelineEventType[];
}

export type HousekeepingStatus = "NEEDS_CLEANING" | "IN_PROGRESS" | "CLEANED" | "WAITING_TECHNICAL" | "READY";
export type TechnicalWorkOrderStatus = "NEW" | "ACKNOWLEDGED" | "IN_PROGRESS" | "WAITING_ACCEPTANCE" | "COMPLETED" | "ROOM_RELEASED";
export type IncidentStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
export type MaintenanceStatus = "CHUA_XU_LY" | "DANG_BAO_TRI" | "DA_HOAN_THANH";
export type InspectionType = "MINIBAR" | "ROOM_ASSET";
export type ItemCondition = "OK" | "DAMAGED" | "MISSING" | "REFILLED";
export type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** Canonical room status values accepted by the current rooms API. */
export const ROOM_STATUS_VALUES = ["available", "occupied", "cleaning", "maintenance", "out_of_service", "reserved"] as const;
export type RoomStatus = typeof ROOM_STATUS_VALUES[number];

export interface HousekeepingTask { id: number; room_id: string; assignee: string | null; status: HousekeepingStatus; checklist_complete: boolean; blocking_incident: boolean; note: string | null; assigned_by: string | null; updated_at: string; }
export interface HousekeepingTaskCreateRequest { room_id: string; assignee: string; note?: string; }
export interface HousekeepingTaskUpdateRequest { status: HousekeepingStatus; note?: string; assignee?: string; }

export interface ChecklistTemplate { id: number; name: string; active: boolean; }
export interface ChecklistTemplateRequest { name: string; }
export interface ChecklistResult { id: number; task_id: number; item: string; passed: boolean; note: string | null; completed_by: string; completed_at: string; }
export interface ChecklistResultRequest { item: string; passed: boolean; note?: string; }

export interface HousekeepingInspection { id: number; task_id: number; inspection_type: InspectionType; item: string; quantity: number; item_condition: ItemCondition; note: string | null; completed_by: string; completed_at: string; }
export interface HousekeepingInspectionRequest { inspection_type: InspectionType; item: string; quantity: number; item_condition: ItemCondition; note?: string; }

export interface EquipmentIncident { id: number; reservation_id: number | null; room_id: string; equipment_name: string; compensation: number; severity: IncidentSeverity; handoff_status: IncidentStatus; handoff_note: string | null; }
export interface EquipmentIncidentRequest { room_id: string; equipment_name: string; equipment_id?: number; quantity: number; severity?: IncidentSeverity; }
export interface RoomIncidentRequest { room_id: string; equipment_name: string; equipment_id?: number; quantity?: number; severity?: IncidentSeverity; description?: string; }
export interface EquipmentIncidentHandoffRequest { status: IncidentStatus; note?: string; }

export interface TechnicalWorkOrder { id: number; room_id: string; equipment_id: number | null; assignee: string | null; priority: string; sla_due_at: string | null; materials: string | null; result_note: string | null; acceptance_note: string | null; accepted_by: string | null; accepted_at: string | null; status: TechnicalWorkOrderStatus; created_by: string; created_at: string; updated_at: string; }
export interface TechnicalWorkOrderCreateRequest { room_id: string; equipment_id?: number; assignee?: string; priority: string; sla_due_at?: string; materials?: string; }
export interface TechnicalWorkOrderUpdateRequest { status: TechnicalWorkOrderStatus; result_note?: string; assignee?: string; materials?: string; }
export interface AcceptanceRequest { acceptance_note: string; }

export interface Equipment { id: number; room_id: string; name: string; original_value: number; purchased_on: string; quantity: number; active: boolean; }
export interface EquipmentCreateRequest { room_id: string; name: string; original_value: number; purchased_on: string; quantity: number; }
export interface EquipmentUpdateRequest { name: string; original_value: number; purchased_on: string; quantity: number; active: boolean; }

export interface MaintenanceWorkOrder { id: string; room_id: string; type: string; scheduled_date: string; status: MaintenanceStatus; description: string | null; }
export interface MaintenanceCreateRequest { id: string; room_id: string; type: string; scheduled_date: string; description?: string; }
export interface MaintenanceStatusRequest { status: MaintenanceStatus; }

export interface Room { id: string; name: string; room_type_id: string; room_type_name: string; daily_price: number; floor: number; status: RoomStatus; }
export interface RoomAvailability { room_id: string; room_type_id: string; room_type_name: string; daily_price: number; floor: number; available: boolean; }

export interface RoomImage {
  id: number;
  url: string;
  display_order: number;
  cover: boolean;
  content_type: string;
  size_bytes: number;
}

export interface RoomMedia {
  room_id: string;
  images: RoomImage[];
  amenities: string[];
}

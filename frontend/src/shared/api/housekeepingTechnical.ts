import { ApiError, apiClient } from "./client";
import type {
  AcceptanceRequest, ChecklistResult, ChecklistResultRequest, ChecklistTemplate, ChecklistTemplateRequest,
  Equipment, EquipmentCreateRequest, EquipmentIncident, EquipmentIncidentHandoffRequest, EquipmentIncidentRequest,
  EquipmentUpdateRequest, HousekeepingInspection, HousekeepingInspectionRequest, HousekeepingTask,
  HousekeepingTaskCreateRequest, HousekeepingTaskUpdateRequest, MaintenanceCreateRequest, MaintenanceStatusRequest,
  MaintenanceWorkOrder, Room, RoomAvailability, RoomIncidentRequest, RoomStatus, TechnicalWorkOrder, TechnicalWorkOrderCreateRequest,
  TechnicalWorkOrderStatus, TechnicalWorkOrderUpdateRequest,
  RoomMedia,
} from "../types/housekeepingTechnical";

export interface MutationOptions { idempotencyKey?: string; }

const idempotencyKey = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const key = (options?: MutationOptions) => options?.idempotencyKey ?? idempotencyKey();
const query = (params: Record<string, string | undefined>) => {
  const value = new URLSearchParams();
  Object.entries(params).forEach(([name, item]) => { if (item !== undefined && item !== "") value.set(name, item); });
  const result = value.toString();
  return result ? `?${result}` : "";
};

const readRoomMedia = (roomId: string) =>
  apiClient.request<RoomMedia>(`/api/rooms/${encodeURIComponent(roomId)}/media`);

const uploadRoomImage = async (roomId: string, file: File): Promise<RoomMedia["images"][number]> => {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${apiClient.baseUrl}/api/rooms/${encodeURIComponent(roomId)}/images`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(apiClient.store.get()?.access_token
        ? { Authorization: `Bearer ${apiClient.store.get()!.access_token}` }
        : {}),
    },
    body: form,
  });
  if (!response.ok) {
    let payload: { message?: string } | undefined;
    try { payload = await response.json(); } catch { /* response may be empty */ }
    throw new ApiError(response.status, payload);
  }
  return (await response.json()) as RoomMedia["images"][number];
};

export const housekeepingTechnicalApi = {
  tasks: (params: { roomId?: string; assignee?: string; status?: HousekeepingTask["status"] } = {}) => apiClient.request<HousekeepingTask[]>(`/api/operations/housekeeping/tasks${query({ roomId: params.roomId, assignee: params.assignee, status: params.status })}`),
  createTask: (body: HousekeepingTaskCreateRequest, options?: MutationOptions) => apiClient.request<HousekeepingTask>("/api/operations/housekeeping/tasks", { method: "POST", body, idempotencyKey: key(options) }),
  updateTask: (id: number, body: HousekeepingTaskUpdateRequest, options?: MutationOptions) => apiClient.request<HousekeepingTask>(`/api/operations/housekeeping/tasks/${id}`, { method: "PATCH", body, idempotencyKey: key(options) }),
  checklistTemplates: () => apiClient.request<ChecklistTemplate[]>("/api/operations/housekeeping/checklist-templates"),
  createChecklistTemplate: (body: ChecklistTemplateRequest, options?: MutationOptions) => apiClient.request<ChecklistTemplate>("/api/operations/housekeeping/checklist-templates", { method: "POST", body, idempotencyKey: key(options) }),
  checklistResults: (taskId: number) => apiClient.request<ChecklistResult[]>(`/api/operations/housekeeping/tasks/${taskId}/checklist-results`),
  addChecklistResult: (taskId: number, body: ChecklistResultRequest, options?: MutationOptions) => apiClient.request<ChecklistResult>(`/api/operations/housekeeping/tasks/${taskId}/checklist-results`, { method: "POST", body, idempotencyKey: key(options) }),
  inspections: (taskId: number) => apiClient.request<HousekeepingInspection[]>(`/api/operations/housekeeping/tasks/${taskId}/inspections`),
  addInspection: (taskId: number, body: HousekeepingInspectionRequest, options?: MutationOptions) => apiClient.request<HousekeepingInspection>(`/api/operations/housekeeping/tasks/${taskId}/inspections`, { method: "POST", body, idempotencyKey: key(options) }),
  workOrders: (params: { roomId?: string; status?: TechnicalWorkOrderStatus } = {}) => apiClient.request<TechnicalWorkOrder[]>(`/api/operations/technical/work-orders${query({ roomId: params.roomId, status: params.status })}`),
  createWorkOrder: (body: TechnicalWorkOrderCreateRequest, options?: MutationOptions) => apiClient.request<TechnicalWorkOrder>("/api/operations/technical/work-orders", { method: "POST", body, idempotencyKey: key(options) }),
  updateWorkOrder: (id: number, body: TechnicalWorkOrderUpdateRequest, options?: MutationOptions) => apiClient.request<TechnicalWorkOrder>(`/api/operations/technical/work-orders/${id}`, { method: "PATCH", body, idempotencyKey: key(options) }),
  accept: (id: number, body: AcceptanceRequest, options?: MutationOptions) => apiClient.request<TechnicalWorkOrder>(`/api/operations/technical/work-orders/${id}/accept`, { method: "POST", body, idempotencyKey: key(options) }),
  release: (id: number, options?: MutationOptions) => apiClient.request<TechnicalWorkOrder>(`/api/operations/technical/work-orders/${id}/release`, { method: "POST", idempotencyKey: key(options) }),
  equipment: (roomId: string) => apiClient.request<Equipment[]>(`/api/rooms/${encodeURIComponent(roomId)}/equipment`),
  addEquipment: (body: EquipmentCreateRequest, options?: MutationOptions) => apiClient.request<Equipment>(`/api/rooms/${encodeURIComponent(body.room_id)}/equipment`, { method: "POST", body, idempotencyKey: key(options) }),
  updateEquipment: (roomId: string, equipmentId: number, body: EquipmentUpdateRequest, options?: MutationOptions) => apiClient.request<Equipment>(`/api/rooms/${encodeURIComponent(roomId)}/equipment/${equipmentId}`, { method: "PUT", body, idempotencyKey: key(options) }),
  maintenance: (roomId: string) => apiClient.request<MaintenanceWorkOrder[]>(`/api/operations/maintenance/room/${encodeURIComponent(roomId)}`),
  createMaintenance: (body: MaintenanceCreateRequest, options?: MutationOptions) => apiClient.request<MaintenanceWorkOrder>("/api/operations/maintenance", { method: "POST", body, idempotencyKey: key(options) }),
  updateMaintenanceStatus: (id: string, body: MaintenanceStatusRequest, options?: MutationOptions) => apiClient.request<MaintenanceWorkOrder>(`/api/operations/maintenance/${encodeURIComponent(id)}/status`, { method: "PATCH", body, idempotencyKey: key(options) }),
  recordIncident: (reservationId: number, body: EquipmentIncidentRequest, options?: MutationOptions) => apiClient.request<EquipmentIncident>(`/api/operations/reservations/${reservationId}/equipment-incidents`, { method: "POST", body, idempotencyKey: key(options) }),
  createIncident: (body: RoomIncidentRequest, options?: MutationOptions) => apiClient.request<EquipmentIncident>("/api/operations/incidents", { method: "POST", body, idempotencyKey: key(options) }),
  incidents: (params: { roomId?: string; reservationId?: number; handoffStatus?: EquipmentIncident["handoff_status"] } = {}) => apiClient.request<EquipmentIncident[]>(`/api/operations/incidents${query({ roomId: params.roomId, reservationId: params.reservationId?.toString(), handoffStatus: params.handoffStatus })}`),
  handoffIncident: (id: number, body: EquipmentIncidentHandoffRequest, options?: MutationOptions) => apiClient.request<EquipmentIncident>(`/api/operations/reservations/incidents/${id}/handoff`, { method: "PATCH", body, idempotencyKey: key(options) }),
  rooms: (params: { type?: string; status?: RoomStatus } = {}) => apiClient.request<Room[]>(`/api/rooms${query(params)}`),
  availability: (from: string, to: string, type?: string) => apiClient.request<RoomAvailability[]>(`/api/rooms/availability${query({ from, to, type })}`),
  roomMedia: readRoomMedia,
  uploadRoomImage,
  deleteRoomImage: (roomId: string, imageId: number) => apiClient.request<void>(`/api/rooms/${encodeURIComponent(roomId)}/images/${imageId}`, { method: "DELETE" }),
  updateRoomStatus: (roomId: string, status: RoomStatus, options?: MutationOptions) => apiClient.request<Room>(`/api/rooms/${encodeURIComponent(roomId)}/status${query({ status })}`, { method: "PATCH", idempotencyKey: key(options) }),
};

/** UI callers create this once per user action and pass it through retries unchanged. */
export const housekeepingTechnicalMutationKey = idempotencyKey;

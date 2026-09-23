import { apiClient } from "./client";
import type { CashHandover, CashHandoverCreate, CheckInRequest, CheckOutRequest, Dashboard, EquipmentIncident, EquipmentIncidentCreate, Guest, GuestCreate, HotelServiceBooking, Invoice, MembershipHistoryEntry, Page, Payment, PaymentCreate, Receipt, ReceiptCreate, Reservation, ReservationCreate, ReservationUpdate, RoomAvailability, RoomEquipment, RoomSummary, RoomTransfer, RoomTransferCreate, ServiceCatalogItem, TimelineEvent } from "../types/frontDesk";

const key = (): string => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const requireIdempotencyKey = (idempotencyKey: string) => {
  const normalized = idempotencyKey?.trim();
  if (!normalized || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,34}$/.test(normalized)) {
    throw new Error("Payment requires a valid Idempotency-Key (1-35 characters: A-Z, a-z, 0-9, ., _, :, -)");
  }
  return normalized;
};
const mutate = <T>(path: string, body?: unknown, method: "POST" | "PATCH" = "POST", idempotencyKey = key()) => apiClient.request<T>(path, { method, body, idempotencyKey });
const query = (params: Record<string, unknown>) => {
  const values = Object.entries(params).filter(([, value]) => value !== undefined && value !== "");
  return values.length === 0 ? "" : `?${new URLSearchParams(values.map(([name, value]) => [name, String(value)]))}`;
};
export const membershipHistoryPath = (guestId: number) => `/api/guests/${guestId}/membership-history`;

export const frontDeskApi = {
  dashboard: (params: { date?: string; q?: string; status?: string; page?: number; size?: number } = {}) => apiClient.request<Dashboard>(`/api/front-desk/dashboard${query(params)}`),
  guests: (q?: string) => apiClient.request<Guest[]>(`/api/guests${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  guest: (id: number) => apiClient.request<Guest>(`/api/guests/${id}`),
  membershipHistory: (guestId: number) => apiClient.request<MembershipHistoryEntry[]>(membershipHistoryPath(guestId)),
  createGuest: (body: GuestCreate) => apiClient.request<Guest>("/api/guests", { method: "POST", body }),
  reservations: (params: { status?: string; guest_id?: number; page?: number; size?: number } = {}) => apiClient.request<Page<Reservation>>(`/api/reservations${query(params)}`),
  reservation: (id: number) => apiClient.request<Reservation>(`/api/reservations/${id}`),
  createReservation: (body: ReservationCreate) => apiClient.request<Reservation>("/api/reservations", { method: "POST", body, idempotencyKey: key() }),
  confirm: (id: number, idempotencyKey?: string) => mutate<Reservation>(`/api/reservations/${id}/confirm`, undefined, "POST", idempotencyKey),
  updateReservation: (id: number, body: ReservationUpdate, idempotencyKey?: string) => mutate<Reservation>(`/api/reservations/${id}`, body, "PATCH", idempotencyKey),
  cancel: (id: number, reason: string, idempotencyKey?: string) => mutate<Reservation>(`/api/reservations/${id}/cancel`, { reason }, "POST", idempotencyKey),
  noShow: (id: number, idempotencyKey?: string) => mutate<Reservation>(`/api/reservations/${id}/no-show`, undefined, "POST", idempotencyKey),
  checkIn: (id: number, body: CheckInRequest = {}, idempotencyKey?: string) => mutate<Reservation>(`/api/reservations/${id}/check-in`, body, "POST", idempotencyKey),
  checkOut: (id: number, body: CheckOutRequest, idempotencyKey?: string) => mutate<Invoice>(`/api/reservations/${id}/check-out`, body, "POST", idempotencyKey),
  extend: (id: number, new_expected_check_out: string, idempotencyKey?: string) => mutate<Reservation>(`/api/reservations/${id}/extend`, { new_expected_check_out }, "POST", idempotencyKey),
  transfer: (id: number, body: RoomTransferCreate, idempotencyKey?: string) => mutate<RoomTransfer>(`/api/operations/reservations/${id}/room-transfers`, body, "POST", idempotencyKey),
  roomAvailability: (from: string, to: string) => apiClient.request<RoomAvailability[]>(`/api/rooms/availability${query({ from, to })}`),
  addService: (id: number, body: { service_id: string; quantity: number; used_at?: string; room_id?: string; meal_period?: "LUNCH" | "DINNER" }, idempotencyKey?: string) => mutate<Reservation>(`/api/reservations/${id}/services`, body, "POST", idempotencyKey),
  serviceBookings: (reservationId: number) => apiClient.request<HotelServiceBooking[]>(`/api/reservations/${reservationId}/service-bookings`),
  useServiceBooking: (reservationId: number, bookingId: number) => mutate<HotelServiceBooking>(`/api/reservations/${reservationId}/service-bookings/${bookingId}/use`),
  services: () => apiClient.request<ServiceCatalogItem[]>("/api/services"),
  updateRoomStatus: (roomId: string, status: string) => apiClient.request<RoomSummary>(`/api/rooms/${encodeURIComponent(roomId)}/status?status=${encodeURIComponent(status)}`, { method: "PATCH" }),
  roomEquipment: (roomId: string) => apiClient.request<RoomEquipment[]>(`/api/rooms/${encodeURIComponent(roomId)}/equipment`),
  recordEquipmentIncident: (reservationId: number, body: EquipmentIncidentCreate, idempotencyKey?: string) => mutate<EquipmentIncident>(`/api/reservations/${reservationId}/equipment-incidents`, body, "POST", idempotencyKey),
  invoices: (params: { reservation_id?: number; page?: number; size?: number } = {}) => apiClient.request<Page<Invoice>>(`/api/invoices?${new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined).map(([name, value]) => [name, String(value)])).toString()}`),
  invoice: (reservationId: number) => apiClient.request<Invoice>(`/api/invoices/reservation/${reservationId}`),
  payments: (invoiceId: number) => apiClient.request<Payment[] | Page<Payment>>(`/api/invoices/${invoiceId}/payments`),
  recordPayment: async (invoiceId: number, body: PaymentCreate, idempotencyKey: string) => apiClient.request<Payment>(`/api/invoices/${invoiceId}/payments`, { method: "POST", body, idempotencyKey: requireIdempotencyKey(idempotencyKey) }),
  receipts: (invoiceId: number) => apiClient.request<Receipt[] | Page<Receipt>>(`/api/invoices/${invoiceId}/receipts`),
  issueReceipt: (invoiceId: number, body: ReceiptCreate, idempotencyKey = key()) => apiClient.request<Receipt>(`/api/invoices/${invoiceId}/receipts`, { method: "POST", body, idempotencyKey }),
  timeline: (id: number) => apiClient.request<TimelineEvent[]>(`/api/reservations/${id}/timeline`),
  cashHandover: (body: CashHandoverCreate, idempotencyKey: string) => apiClient.request<CashHandover>("/api/finance/cash-handovers", { method: "POST", body, idempotencyKey: requireIdempotencyKey(idempotencyKey) }),
  myCashHandovers: (params: { page?: number; size?: number } = {}) => apiClient.request<Page<CashHandover>>(`/api/finance/cash-handovers/mine${query(params)}`),
};

export const newMutationKey = key;
export const newPaymentIdempotencyKey = () => `FD-${key().replace(/[^a-zA-Z0-9]/g, "").slice(0, 32)}`;
export const newFrontDeskIdempotencyKey = newPaymentIdempotencyKey;

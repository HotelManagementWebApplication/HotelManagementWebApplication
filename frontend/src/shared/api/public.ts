import { apiClient } from "./client";
import type { PublicRoomAvailability, PublicRoomDetail, PublicRoomSummary, PublicService, CommercialSpace } from "../types/public";

export const publicApi = {
  rooms: (type?: string, page?: number, size?: number) => {
    const params = new URLSearchParams();
    if (page !== undefined) params.set("page", String(page));
    if (size !== undefined) params.set("size", String(size));
    if (type) params.set("type", type);
    const query = params.toString();
    return apiClient.request<PublicRoomSummary[]>(`/api/public/rooms${query ? `?${query}` : ""}`);
  },
  room: async (roomId: string) => {
    if (typeof roomId !== "string" || !roomId.trim()) throw new TypeError("roomId must be a non-blank public room ID");
    return apiClient.request<PublicRoomDetail>(`/api/public/rooms/${encodeURIComponent(roomId)}`);
  },
  availability: (from: string, to: string, type?: string, page?: number, size?: number) => {
    const params = new URLSearchParams({ from, to });
    if (type) params.set("type", type);
    if (page !== undefined) params.set("page", String(page));
    if (size !== undefined) params.set("size", String(size));
    return apiClient.request<PublicRoomAvailability[]>(`/api/public/rooms/availability?${params}`);
  },
  services: (page?: number, size?: number) => {
    const params = new URLSearchParams();
    if (page !== undefined) params.set("page", String(page));
    if (size !== undefined) params.set("size", String(size));
    const query = params.toString();
    return apiClient.request<PublicService[]>(`/api/public/services${query ? `?${query}` : ""}`);
  },
  commercialSpaces: () => apiClient.request<CommercialSpace[]>("/api/public/commercial-spaces"),
};

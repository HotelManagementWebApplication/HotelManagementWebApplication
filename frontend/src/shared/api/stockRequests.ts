import { apiClient } from "./client";
import type { Service } from "../types/kitchenAccounting";

export interface StockRequest {
  id:number; service_id:string; service_name:string; unit:string; kind:"ISSUE"|"RETURN"|"DAMAGE"; quantity:number;
  room_id:string|null; requester:string; reason:string; status:"PENDING"|"APPROVED"|"REJECTED";
  approver:string|null; decision_reason:string|null; requested_at:string; decided_at:string|null;
}
export interface StockRequestRequest { kind:"ISSUE"|"RETURN"|"DAMAGE"; service_id:string; quantity:number; room_id:string|null; reason:string; }
const base="/api/operations/stock-requests";
export const stockRequestsApi={
  list:()=>apiClient.request<StockRequest[]>(base),
  catalog:()=>apiClient.request<Service[]>(`${base}/catalog`),
  create:(body:StockRequestRequest,key:string)=>apiClient.request<StockRequest>(base,{method:"POST",body,idempotencyKey:key}),
  decide:(id:number,approve:boolean,reason:string)=>apiClient.request<StockRequest>(`${base}/${id}/${approve?"approve":"reject"}`,{method:"POST",body:{reason}}),
};

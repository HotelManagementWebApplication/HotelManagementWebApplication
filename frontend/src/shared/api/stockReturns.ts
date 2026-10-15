import { apiClient } from "./client";
import type { Service } from "../types/kitchenAccounting";

export interface StockReturn {
  id:number; service_id:string; service_name:string; unit:string; quantity:number;
  room_id:string|null; requester:string; reason:string; status:"PENDING"|"APPROVED"|"REJECTED";
  approver:string|null; decision_reason:string|null; requested_at:string; decided_at:string|null;
}
export interface StockReturnRequest { service_id:string; quantity:number; room_id:string|null; reason:string; }
const base="/api/operations/stock-returns";
export const stockReturnsApi={
  list:()=>apiClient.request<StockReturn[]>(base),
  catalog:()=>apiClient.request<Service[]>(`${base}/catalog`),
  create:(body:StockReturnRequest,key:string)=>apiClient.request<StockReturn>(base,{method:"POST",body,idempotencyKey:key}),
  decide:(id:number,approve:boolean,reason:string)=>apiClient.request<StockReturn>(`${base}/${id}/${approve?"approve":"reject"}`,{method:"POST",body:{reason}}),
};

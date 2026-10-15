import { apiClient } from "./client";
export type ScheduleMode="DURATION"|"UNITS"|"STAY"|"DAILY"|"OVERNIGHT"|"STOCK";
export interface ServiceSchedule { service_id:string;capacity:number|null;unit:string|null;minutes_per_unit:number|null;mode:ScheduleMode|null;consumes_stock:boolean; }
export interface ScheduleRequest { capacity:number;unit:string;minutes_per_unit:number;mode:ScheduleMode;consumes_stock:boolean;reason:string; }
export const serviceScheduleApi={
  get:(id:string)=>apiClient.request<ServiceSchedule>(`/api/services/${encodeURIComponent(id)}/schedule`),
  save:(id:string,body:ScheduleRequest)=>apiClient.request<ServiceSchedule>(`/api/services/${encodeURIComponent(id)}/schedule`,{method:"PUT",body}),
};
export interface ServiceConsumption { id:string;service_id:string;occurred_at:string;quantity:number;free_quantity:number;unit_price:number;amount_due:number; }
export const serviceConsumptionApi={
  list:(from:string,to:string)=>apiClient.request<ServiceConsumption[]>(`/api/services/consumption?${new URLSearchParams({from,to})}`),
};

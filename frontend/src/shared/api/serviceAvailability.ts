import { apiClient } from "./client";
export interface ServiceAvailability { service_id:string;unit:string;capacity:number;booked:number;available:number;mode:"DURATION"|"UNITS"|"STAY"|"STOCK"|"DAILY"|"OVERNIGHT";consumes_stock?:boolean; }
export const serviceAvailabilityApi={
  list:(from:string,to:string)=>apiClient.request<ServiceAvailability[]>(`/api/services/availability?${new URLSearchParams({from,to})}`),
};

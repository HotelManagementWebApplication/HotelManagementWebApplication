import {apiClient} from "./client";
export interface ServiceConsumption { id:string;service_id:string;occurred_at:string;quantity:number;free_quantity:number;unit_price:number;amount_due:number; }
export const serviceConsumptionApi={
  list:(from:string,to:string)=>apiClient.request<ServiceConsumption[]>(`/api/services/consumption?${new URLSearchParams({from,to})}`),
};

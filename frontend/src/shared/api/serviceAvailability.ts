import {apiClient} from "./client";
export interface ServiceAvailability{service_id:string;unit:string;capacity:number;booked:number;available:number;duration_minutes:number;resource?:boolean;resource_source_id?:string|null;}
export const serviceAvailabilityApi={
 list:()=>apiClient.request<ServiceAvailability[]>("/api/services/availability"),
 configure:(id:string,body:{capacity:number;minutes:number;reason:string})=>apiClient.request<void>(`/api/services/${encodeURIComponent(id)}/capacity`,{method:"PUT",body}),
};

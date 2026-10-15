import { apiClient } from "./client";
import type { Approval } from "../types/kitchenAccounting";

export interface CatalogProposal {
  kind: "SERVICE" | "WAREHOUSE";
  id: string;
  name: string;
  unit: string;
  category: string;
  price: number;
  reason: string;
}
export const catalogProposalsApi = {
  list: () => apiClient.request<Approval[]>("/api/services/catalog-proposals"),
  submit: (body: CatalogProposal, key: string) => apiClient.request<Approval>("/api/services/catalog-proposals", { method:"POST", body, idempotencyKey:key }),
};

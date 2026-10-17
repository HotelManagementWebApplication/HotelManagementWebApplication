import { createContext, useContext } from "react";
import type { Service } from "../../shared/types/kitchenAccounting";
import type { EmployeeAdmin } from "../../shared/types/hrGovernance";

// Only price-review cards consume this data; other approval workflows keep their props.
export const ServicePriceReviewContext = createContext<{
  services: Service[];
  employees: EmployeeAdmin[];
  managerId?: string;
}>({services:[],employees:[]});

export const useServicePriceReview = () => useContext(ServicePriceReviewContext);

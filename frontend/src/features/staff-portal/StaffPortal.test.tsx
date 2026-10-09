import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StaffPortal from "./StaffPortal";
import { publicApi } from "../../shared/api/public";
import { frontDeskApi } from "../../shared/api/frontDesk";
import { housekeepingTechnicalApi } from "../../shared/api/housekeepingTechnical";
import { hrGovernanceApi } from "../../shared/api/hrGovernance";
import { kitchenAccountingApi } from "../../shared/api/kitchenAccounting";
import { authApi } from "../../shared/api/auth";

describe("STAFF scoped room portal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authApi, "employeeProfile").mockResolvedValue({employee_id:"STAFF",full_name:"Nhân viên thật",role:"STAFF",permissions:[]});
    vi.spyOn(publicApi, "rooms").mockResolvedValue([5,20].map(floor => ({room_id:`${floor}01`,room_name:`${floor}01`,floor,room_type_name:"Standard",daily_price:500000,hourly_price:100000,status:"available",amenities:[]})) as any);
    vi.spyOn(frontDeskApi, "reservations");
    vi.spyOn(housekeepingTechnicalApi, "tasks");
    vi.spyOn(hrGovernanceApi, "employees");
    vi.spyOn(hrGovernanceApi, "approvals");
    vi.spyOn(hrGovernanceApi, "audit");
    vi.spyOn(kitchenAccountingApi, "invoices");
  });
  it("loads public rooms and actual floors without requesting private data", async () => {
    render(<StaffPortal role="staff" onBack={vi.fn()} />);
    await screen.findByText("Đã kết nối");
    expect(publicApi.rooms).toHaveBeenCalledWith(undefined,0,100);
    for(const call of [frontDeskApi.reservations,housekeepingTechnicalApi.tasks,hrGovernanceApi.employees,hrGovernanceApi.approvals,hrGovernanceApi.audit,kitchenAccountingApi.invoices]) expect(call).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"Tình trạng phòng"}));
    expect(screen.getByRole("button",{name:/501/})).toBeTruthy();
    expect(screen.getByRole("button",{name:/2001/})).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:/^Tầng 20$/}));
    expect(screen.queryByRole("button",{name:/501/})).toBeNull();
    expect(screen.getByRole("button",{name:/2001/})).toBeTruthy();
    expect(screen.queryByRole("button",{name:/^Tầng 1$/})).toBeNull();
  });
  it("exposes a recoverable room-load error instead of a permanent connecting state", async () => {
    vi.mocked(publicApi.rooms).mockRejectedValueOnce(new Error("offline"));
    render(<StaffPortal role="staff" onBack={vi.fn()} />);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button",{name:"Thử lại"}));
    await waitFor(() => expect(screen.getByText("Đã kết nối")).toBeTruthy());
    expect(publicApi.rooms).toHaveBeenCalledTimes(2);
  });
});

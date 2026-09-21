import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./client";
import { hrGovernanceApi } from "./hrGovernance";

describe("HR/admin/governance API contract", () => {
  const request = vi.spyOn(apiClient, "request");
  beforeEach(() => { request.mockReset(); request.mockResolvedValue([]); });

  it("uses the current executable employee, shift, approval and audit routes", async () => {
    await hrGovernanceApi.employees(true);
    await hrGovernanceApi.employee("HR 01");
    await hrGovernanceApi.sessions("HR 01");
    await hrGovernanceApi.loginHistory("HR 01", 2, 10);
    await hrGovernanceApi.shifts({ date: "2026-09-18", to: "2026-09-24", employeeId: "HR 01" });
    await hrGovernanceApi.coverage({ date: "2026-09-18", shiftCode: "AM", minimum_staff: 2 });
    await hrGovernanceApi.approvals("PENDING");
    await hrGovernanceApi.audit({ entity_type: "EMPLOYEE", entity_id: "HR 01", page: 1, size: 20 });
    expect(request.mock.calls.map(call => call[0])).toEqual([
      "/api/auth/employees?includeInactive=true",
      "/api/auth/employees/HR%2001",
      "/api/auth/employees/HR%2001/sessions",
      "/api/auth/employees/HR%2001/login-history?page=2&size=10",
      "/api/hr/shifts?date=2026-09-18&to=2026-09-24&employeeId=HR+01",
      "/api/hr/shifts/coverage?date=2026-09-18&shiftCode=AM&minimum_staff=2",
      "/api/governance/approvals?status=PENDING",
      "/api/governance/audit?entity_type=EMPLOYEE&entity_id=HR+01&page=1&size=20",
    ]);
  });

  it("keeps request bodies snake_case and does not invent idempotency headers", async () => {
    await hrGovernanceApi.setEmployment("E1", "ON_LEAVE", "2026-09-20", "2026-09-22");
    await hrGovernanceApi.assignShift({ employee_id: "E1", shift_date: "2026-09-18", shift_code: "AM", starts_at: "2026-09-18T08:00", ends_at: "2026-09-18T16:00" });
    await hrGovernanceApi.setShiftStatus(4, "STARTED");
    await hrGovernanceApi.approve(8);
    expect(request.mock.calls[0][1]).toEqual(expect.objectContaining({ method: "PATCH", body: { status: "ON_LEAVE", leave_start: "2026-09-20", leave_end: "2026-09-22" } }));
    expect(request.mock.calls[1][1]).toEqual(expect.objectContaining({ method: "POST", body: { employee_id: "E1", shift_date: "2026-09-18", shift_code: "AM", starts_at: "2026-09-18T08:00", ends_at: "2026-09-18T16:00" } }));
    expect(request.mock.calls.every(([, options]) => !Object.prototype.hasOwnProperty.call(options ?? {}, "idempotencyKey"))).toBe(true);
  });
});


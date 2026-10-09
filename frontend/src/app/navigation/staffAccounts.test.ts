import { describe, expect, it } from "vitest";
import { resolveEmployeeDestination, staffAccounts } from "./staffAccounts";

describe("staff account navigation", () => {
  it("keeps employee ID and email aliases mapped to the same station", () => {
    expect(staffAccounts.frontdesk).toMatchObject({ employeeId: "FRONTDESK", view: "frontdesk" });
    expect(staffAccounts["frontdesk@hotel.com"]).toMatchObject({ employeeId: "FRONTDESK", view: "frontdesk" });
    expect(staffAccounts["director@hotel.com"]).toMatchObject({ employeeId: "DIRECTOR", role: "director", view: "manager" });
  });

  it("routes only by the authenticated backend role and rejects an unknown role", () => {
    expect(resolveEmployeeDestination("DIRECTOR")).toEqual({ role: "director", view: "manager" });
    expect(() => resolveEmployeeDestination("UNKNOWN")).toThrow("Không xác định được vai trò nhân viên");
  });
});

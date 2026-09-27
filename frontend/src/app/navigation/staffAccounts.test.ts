import { describe, expect, it } from "vitest";
import { resolveEmployeeDestination, staffAccounts } from "./staffAccounts";

describe("staff account navigation", () => {
  it("keeps employee ID and email aliases mapped to the same station", () => {
    expect(staffAccounts.frontdesk).toMatchObject({ employeeId: "FRONTDESK", view: "frontdesk" });
    expect(staffAccounts["frontdesk@hotel.com"]).toMatchObject({ employeeId: "FRONTDESK", view: "frontdesk" });
    expect(staffAccounts["director@hotel.com"]).toMatchObject({ employeeId: "DIRECTOR", role: "director", view: "manager" });
  });

  it("uses the backend role first and falls back to the entered account mapping", () => {
    expect(resolveEmployeeDestination("DIRECTOR")).toEqual({ role: "director", view: "manager" });
    expect(resolveEmployeeDestination("UNKNOWN", staffAccounts.accounting)).toEqual({ role: "accounting", view: "accounting" });
    expect(resolveEmployeeDestination("UNKNOWN")).toEqual({ role: "staff", view: "staff" });
  });
});

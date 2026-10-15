import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MaintenanceStation from "./MaintenanceStation";
import { authApi } from "../../shared/api/auth";
import { housekeepingTechnicalApi } from "../../shared/api/housekeepingTechnical";
import type { TechnicalWorkOrder } from "../../shared/types/housekeepingTechnical";

const acceptedOrder: TechnicalWorkOrder = {
  id: 1, room_id: "702", equipment_id: null, assignee: "TECHNICAL", priority: "HIGH",
  sla_due_at: null, materials: "Sửa điều hòa", result_note: "Đã sửa",
  acceptance_note: "Đạt", accepted_by: "DIRECTOR", accepted_at: "2026-10-15T01:00:00",
  status: "COMPLETED", created_by: "MANAGER", created_at: "2026-10-14T01:00:00",
  updated_at: "2026-10-15T01:00:00",
};

describe("Technical room release", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authApi, "employeeProfile").mockResolvedValue({ employee_id: "TECHNICAL", full_name: "Kỹ thuật kiểm thử", role: "TECHNICAL", permissions: [] });
    vi.spyOn(housekeepingTechnicalApi, "rooms").mockResolvedValue([{ id: "702", name: "702", room_type_id: "TWIN", room_type_name: "Classic Twin", daily_price: 1000000, floor: 7, status: "maintenance" }]);
    vi.spyOn(housekeepingTechnicalApi, "workOrders").mockResolvedValue([acceptedOrder]);
    vi.spyOn(housekeepingTechnicalApi, "incidents").mockResolvedValue([]);
    vi.spyOn(housekeepingTechnicalApi, "handoffIncident");
    vi.spyOn(window, "confirm");
  });
  afterEach(cleanup);

  it("excludes accepted and released repairs from urgent alerts while retaining unresolved urgent work", async () => {
    vi.mocked(housekeepingTechnicalApi.workOrders).mockResolvedValue([
      acceptedOrder, { ...acceptedOrder, id: 2, status: "ROOM_RELEASED" },
      { ...acceptedOrder, id: 3, status: "IN_PROGRESS" },
    ]);
    render(<MaintenanceStation onBack={vi.fn()} />);
    await screen.findByText("#3", { exact: true });
    expect(within(screen.getByText("Sự cố khẩn cấp", { exact: true }).parentElement!).getByText("1", { exact: true })).toBeTruthy();
    expect(within(screen.getByText("Đã giải quyết", { exact: true }).parentElement!).getByText("2", { exact: true })).toBeTruthy();
  });

  it("cancels the in-page confirmation without releasing or resolving incidents", async () => {
    const release = vi.spyOn(housekeepingTechnicalApi, "release");
    render(<MaintenanceStation onBack={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở phòng" }));
    expect(screen.getByRole("dialog", { name: "Mở khóa phòng 702" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(release).not.toHaveBeenCalled();
    expect(housekeepingTechnicalApi.handoffIncident).not.toHaveBeenCalled();
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("keeps the error and idempotency key when retrying and only closes on server success", async () => {
    const release = vi.spyOn(housekeepingTechnicalApi, "release")
      .mockRejectedValueOnce(new Error("Phòng còn sự cố"))
      .mockResolvedValueOnce({ ...acceptedOrder, status: "ROOM_RELEASED" });
    render(<MaintenanceStation onBack={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở phòng" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận mở phòng" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận mở phòng" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(release).toHaveBeenCalledTimes(2);
    expect(release.mock.calls[0][1]?.idempotencyKey).toBeTruthy();
    expect(release.mock.calls[1]).toEqual(release.mock.calls[0]);
    expect(screen.getByText("Hoàn tất", { exact: true })).toBeTruthy();
    expect(housekeepingTechnicalApi.handoffIncident).not.toHaveBeenCalled();
    expect(window.confirm).not.toHaveBeenCalled();
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ManagerDashboard from "./ManagerDashboard";
import { authApi } from "../shared/api/auth";
import { hrGovernanceApi } from "../shared/api/hrGovernance";
import { housekeepingTechnicalApi } from "../shared/api/housekeepingTechnical";
import { frontDeskApi } from "../shared/api/frontDesk";
import { kitchenAccountingApi } from "../shared/api/kitchenAccounting";

describe("ManagerDashboard Interface and Acceptance Workflow", () => {
  const onBack = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock manager profile
    vi.spyOn(authApi, "employeeProfile").mockResolvedValue({
      employee_id: "EMP_MGR",
      full_name: "Trần Quản Lý Vận Hành",
      role: "MANAGER",
      permissions: ["APPROVAL_APPROVE", "TECHNICAL_WORK_ORDER_READ", "TECHNICAL_WORK_ORDER_ACCEPT"],
    });

    // Mock empty approvals by default
    vi.spyOn(hrGovernanceApi, "approvals").mockResolvedValue([]);

    // Mock rooms
    vi.spyOn(housekeepingTechnicalApi, "rooms").mockResolvedValue([
      { id: "R101", name: "101", room_type_id: "RT1", room_type_name: "Standard", daily_price: 1000000, floor: 1, status: "available" },
      { id: "R202", name: "202", room_type_id: "RT1", room_type_name: "Standard", daily_price: 1000000, floor: 2, status: "maintenance" },
    ]);

    // Mock employees
    vi.spyOn(hrGovernanceApi, "employees").mockResolvedValue([]);

    // Mock tasks
    vi.spyOn(housekeepingTechnicalApi, "tasks").mockResolvedValue([]);

    // Mock incidents
    vi.spyOn(housekeepingTechnicalApi, "incidents").mockResolvedValue([]);

    // Mock invoices
    vi.spyOn(frontDeskApi, "invoices").mockResolvedValue({
      items: [],
      page: 0,
      size: 100,
      total_elements: 0,
      total_pages: 0,
    });

    // Mock expenses
    vi.spyOn(kitchenAccountingApi, "expenses").mockResolvedValue([]);

    // Mock work orders
    vi.spyOn(housekeepingTechnicalApi, "workOrders").mockResolvedValue([]);
  });

  it("loads dynamic manager profile and never renders hardcoded fake profiles or fake mock items", async () => {
    render(<ManagerDashboard role="manager" onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getAllByText("Trần Quản Lý Vận Hành").length).toBeGreaterThan(0);
    });

    // Verify completely eliminated synthetic mock data
    expect(screen.queryByText(/Nguyễn Văn Minh/i)).toBeNull();
    expect(screen.queryByText(/BK1258/i)).toBeNull();
    expect(screen.queryByText(/Heineken/i)).toBeNull();
    expect(screen.queryByText(/P\.214/i)).toBeNull();
  });

  it("displays real WAITING_ACCEPTANCE work orders in approval list and executes acceptance note workflow", async () => {
    vi.spyOn(housekeepingTechnicalApi, "workOrders").mockResolvedValue([
      {
        id: 77,
        room_id: "R202",
        equipment_id: 12,
        assignee: "TEC01",
        priority: "HIGH",
        sla_due_at: "2026-09-21T10:00:00",
        materials: "[HVAC] Thay tụ quạt dàn lạnh",
        result_note: "Đã thay xong tụ quạt, nhiệt độ gió ra đạt 16°C",
        acceptance_note: null,
        accepted_by: null,
        accepted_at: null,
        status: "WAITING_ACCEPTANCE",
        created_by: "MGR01",
        created_at: "2026-09-20T08:00:00",
        updated_at: "2026-09-20T11:30:00",
      },
    ]);

    const acceptSpy = vi.spyOn(housekeepingTechnicalApi, "accept").mockResolvedValue({
      id: 77,
      room_id: "R202",
      equipment_id: 12,
      assignee: "TEC01",
      priority: "HIGH",
      sla_due_at: "2026-09-21T10:00:00",
      materials: "[HVAC] Thay tụ quạt dàn lạnh",
      result_note: "Đã thay xong tụ quạt, nhiệt độ gió ra đạt 16°C",
      acceptance_note: "Đã kiểm tra vận hành thử 30 phút, đạt chuẩn",
      accepted_by: "EMP_MGR",
      accepted_at: "2026-09-20T12:00:00",
      status: "COMPLETED",
      created_by: "MGR01",
      created_at: "2026-09-20T08:00:00",
      updated_at: "2026-09-20T12:00:00",
    });

    render(<ManagerDashboard role="manager" onBack={onBack} />);

    // Wait for the waiting acceptance item to appear
    await waitFor(() => {
      expect(screen.getAllByText("Nghiệm thu sửa chữa phòng R202").length).toBeGreaterThan(0);
    });

    expect(screen.getByText(/Thay tụ quạt dàn lạnh/i)).toBeDefined();
    expect(screen.getByText(/Đã thay xong tụ quạt, nhiệt độ gió ra đạt 16°C/i)).toBeDefined();

    // Click exact "Phê duyệt" action button
    const approveBtn = screen.getByRole("button", { name: /^phê duyệt$/i });
    fireEvent.click(approveBtn);

    // Acceptance modal should open
    await waitFor(() => {
      expect(screen.getByText("Nghiệm thu phiếu bảo trì kỹ thuật")).toBeDefined();
    });

    expect(screen.getByText(/Phiếu #77 · Phòng R202/i)).toBeDefined();

    // Submit with empty note should show error
    const confirmBtn = screen.getByRole("button", { name: /Xác nhận nghiệm thu/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/Vui lòng ghi nhận xét nghiệm thu đạt yêu cầu/i)).toBeDefined();
    });
    expect(acceptSpy).not.toHaveBeenCalled();

    // Enter acceptance note
    const textarea = screen.getByPlaceholderText(/Nhập nhận xét nghiệm thu/i);
    fireEvent.change(textarea, { target: { value: "Đã kiểm tra vận hành thử 30 phút, đạt chuẩn" } });

    // Submit valid note
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(acceptSpy).toHaveBeenCalledWith(77, {
        acceptance_note: "Đã kiểm tra vận hành thử 30 phút, đạt chuẩn",
      });
    });

    // Modal closes
    await waitFor(() => {
      expect(screen.queryByText("Nghiệm thu phiếu bảo trì kỹ thuật")).toBeNull();
    });
  });

  it("handles empty approvals state cleanly without any fallback synthetic records", async () => {
    vi.spyOn(housekeepingTechnicalApi, "workOrders").mockResolvedValue([]);
    render(<ManagerDashboard role="manager" onBack={onBack} />);

    // Navigate to approvals screen
    const approvalsNavBtn = screen.getByRole("button", { name: /Trung tâm Phê duyệt/i });
    fireEvent.click(approvalsNavBtn);

    await waitFor(() => {
      expect(screen.getByText("Hiện không có yêu cầu phê duyệt nào đang chờ xử lý từ các bộ phận.")).toBeDefined();
    });
  });
});

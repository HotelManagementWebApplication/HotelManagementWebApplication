import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ManagerDashboard from "./ManagerDashboard";
import { authApi } from "../../shared/api/auth";
import { hrGovernanceApi } from "../../shared/api/hrGovernance";
import { housekeepingTechnicalApi } from "../../shared/api/housekeepingTechnical";
import { frontDeskApi } from "../../shared/api/frontDesk";
import { kitchenAccountingApi } from "../../shared/api/kitchenAccounting";
import { enterpriseApi } from "../../shared/api/enterprise";
import { personnelApi } from "../../shared/api/personnel";

describe("ManagerDashboard Interface and Acceptance Workflow", () => {
  const onBack = vi.fn();

  it.each([
    ["người tạo", "EMP_MGR", "TEC01", "Bạn là người tạo phiếu này nên không thể tự nghiệm thu."],
    ["người được giao", "TEC01", "EMP_MGR", "Bạn là người được giao phiếu nên không thể tự nghiệm thu."],
  ])("blocks acceptance when the manager is the %s", async (_relationship, createdBy, assignee, reason) => {
    vi.mocked(housekeepingTechnicalApi.workOrders).mockResolvedValue([{
      id: 77, room_id: "R202", assignee, status: "WAITING_ACCEPTANCE", created_by: createdBy,
      materials: "Sửa điều hòa", result_note: "Đã sửa xong",
    }] as any);
    const accept = vi.spyOn(housekeepingTechnicalApi, "accept");
    render(<ManagerDashboard role="manager" onBack={onBack} />);
    expect(await screen.findByText(reason)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Phê duyệt$/i })).toBeNull();
    expect(screen.queryByText("Nghiệm thu phiếu bảo trì kỹ thuật")).toBeNull();
    expect(accept).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Trung tâm Phê duyệt/i }));
    expect((await screen.findAllByText(reason)).length).toBeGreaterThan(0);
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(personnelApi, "profiles").mockResolvedValue([]);
    vi.spyOn(personnelApi, "requests").mockResolvedValue([]);

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
    vi.spyOn(kitchenAccountingApi, "approvals").mockResolvedValue([]);
    vi.spyOn(kitchenAccountingApi, "services").mockResolvedValue([]);
    vi.spyOn(enterpriseApi, "leaves").mockResolvedValue([]);
    vi.spyOn(kitchenAccountingApi, "ledger").mockResolvedValue({items: [], page: 0, size: 100, totalElements: 0, totalPages: 0});
    vi.spyOn(kitchenAccountingApi, "reconciliation").mockResolvedValue({recognized_revenue: 0, net_total: 0, total_payments: 0, total_refunds: 0} as any);

    // Mock work orders
    vi.spyOn(housekeepingTechnicalApi, "workOrders").mockResolvedValue([]);
    vi.spyOn(housekeepingTechnicalApi, "equipment").mockResolvedValue([]);
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
        created_by: "TEC01",
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
      created_by: "TEC01",
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

  it("displays open room incidents in approvals and creates technical work order upon manager approval", async () => {
    vi.spyOn(housekeepingTechnicalApi, "incidents").mockResolvedValue([
      {
        id: 99,
        reservation_id: null,
        room_id: "502",
        equipment_name: "Điều hòa",
        severity: "HIGH",
        handoff_status: "OPEN",
        handoff_note: "Điều hòa chảy nước nhiều",
        compensation: 0,
      },
    ]);
    const handoffSpy = vi.spyOn(housekeepingTechnicalApi, "handoffIncident").mockResolvedValue({
      id: 99,
      reservation_id: null,
      room_id: "502",
      equipment_name: "Điều hòa",
      severity: "HIGH",
      handoff_status: "ACKNOWLEDGED",
      handoff_note: "Quản lý đã duyệt sự cố và điều phối kỹ thuật xử lý",
      compensation: 0,
    });
    const workOrderSpy = vi.spyOn(housekeepingTechnicalApi, "createWorkOrder").mockResolvedValue({
      id: 101,
      room_id: "502",
      equipment_id: null,
      assignee: "TECHNICAL",
      priority: "HIGH",
      sla_due_at: null,
      materials: "[Sự cố phòng] Điều hòa: Điều hòa chảy nước nhiều",
      result_note: null,
      acceptance_note: null,
      accepted_by: null,
      accepted_at: null,
      status: "NEW",
      created_by: "MANAGER",
      created_at: "2026-10-15T00:01:00",
      updated_at: "2026-10-15T00:01:00",
    });

    render(<ManagerDashboard role="manager" onBack={onBack} />);

    // Check that open incident is displayed in Approvals list on Overview
    await waitFor(() => {
      expect(screen.getAllByText("Sự cố phòng 502: Điều hòa").length).toBeGreaterThan(0);
    });

    const approveBtn = screen.getByRole("button", { name: /^phê duyệt$/i });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(handoffSpy).toHaveBeenCalledWith(99, expect.objectContaining({
        status: "ACKNOWLEDGED",
      }), expect.objectContaining({idempotencyKey: "MGMT-INCIDENT-99-DISPATCH"}));
      expect(workOrderSpy).toHaveBeenCalledWith(expect.objectContaining({
        room_id: "502",
        assignee: undefined,
        priority: "HIGH",
      }), expect.objectContaining({idempotencyKey: "MGMT-INCIDENT-99-ORDER"}));
    });
  });

  it("does not acknowledge an incident or show success when work order creation fails", async () => {
    const incident = {id: 99, room_id: "502", equipment_name: "Điều hòa", severity: "HIGH", handoff_status: "OPEN", compensation: 0, handoff_note: null, reservation_id: null} as const;
    vi.mocked(housekeepingTechnicalApi.incidents).mockResolvedValue([incident]);
    const create = vi.spyOn(housekeepingTechnicalApi, "createWorkOrder").mockRejectedValue(new Error("Create failed"));
    const handoff = vi.spyOn(housekeepingTechnicalApi, "handoffIncident");
    vi.spyOn(window, "alert").mockImplementation(() => {});
    render(<ManagerDashboard role="manager" onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", {name: "Sự cố & Khẩn cấp"}));
    fireEvent.click(await screen.findByRole("button", {name: "Duyệt & Giao kỹ thuật"}));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", {name: "Duyệt & Giao kỹ thuật"}).hasAttribute("disabled")).toBe(false));
    expect(handoff).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", {name: "Đã tiếp nhận"})).toBeNull();
  });

  it("reuses an already persisted dispatch work order when retrying the incident handoff", async () => {
    const incident = {id: 99, room_id: "502", equipment_name: "Điều hòa", severity: "HIGH", handoff_status: "OPEN", compensation: 0, handoff_note: null, reservation_id: null} as const;
    vi.mocked(housekeepingTechnicalApi.incidents).mockResolvedValue([incident]);
    vi.mocked(housekeepingTechnicalApi.workOrders).mockResolvedValue([{id:101, room_id:"502", materials:"[Sự cố #99] Điều hòa", status:"NEW"}] as any);
    const create = vi.spyOn(housekeepingTechnicalApi, "createWorkOrder");
    const handoff = vi.spyOn(housekeepingTechnicalApi, "handoffIncident").mockRejectedValueOnce(new Error("Handoff failed")).mockResolvedValue({...incident,handoff_status:"ACKNOWLEDGED"});
    vi.spyOn(window, "alert").mockImplementation(() => {});
    render(<ManagerDashboard role="manager" onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", {name: "Sự cố & Khẩn cấp"}));
    fireEvent.click(await screen.findByRole("button", {name: "Duyệt & Giao kỹ thuật"}));
    await waitFor(() => expect(screen.getByRole("button", {name: "Duyệt & Giao kỹ thuật"}).hasAttribute("disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", {name: "Duyệt & Giao kỹ thuật"}));
    await screen.findByRole("button", {name: "Đã tiếp nhận"});
    expect(handoff).toHaveBeenCalledTimes(2);
    expect(create).not.toHaveBeenCalled();
  });
});

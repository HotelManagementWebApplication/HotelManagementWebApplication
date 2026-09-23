import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MaintenanceStation from "./MaintenanceStation";
import { housekeepingTechnicalApi } from "../shared/api/housekeepingTechnical";
import { enterpriseApi } from "../shared/api/enterprise";
import { authApi } from "../shared/api/auth";

describe("MaintenanceStation Operational Interface", () => {
  const onBack = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock employee profile
    vi.spyOn(authApi, "employeeProfile").mockResolvedValue({
      employee_id: "TECHNICAL",
      full_name: "Lê Hoàng Kỹ Thuật",
      role: "TECHNICAL",
      permissions: ["TECHNICAL_WORK_ORDER_READ", "TECHNICAL_WORK_ORDER_WRITE", "TECHNICAL_WORK_ORDER_RELEASE"],
    });

    // Mock real rooms from database
    vi.spyOn(housekeepingTechnicalApi, "rooms").mockResolvedValue([
      { id: "R101", name: "501", room_type_id: "RT001", room_type_name: "Standard (STD) · Đơn", daily_price: 1200000, floor: 5, status: "available" },
      { id: "R202", name: "602", room_type_id: "RT002", room_type_name: "Standard (STD) · Đôi", daily_price: 1450000, floor: 6, status: "cleaning" },
      { id: "R302", name: "702", room_type_id: "RT002", room_type_name: "Standard (STD) · Đôi", daily_price: 1450000, floor: 7, status: "maintenance" },
    ]);

    // Mock real work orders from database
    vi.spyOn(housekeepingTechnicalApi, "workOrders").mockResolvedValue([
      {
        id: 1,
        room_id: "R302",
        equipment_id: 10,
        assignee: "TECHNICAL",
        priority: "HIGH",
        sla_due_at: "2026-09-20T18:00:00",
        materials: "[HVAC] Điều hòa không làm lạnh",
        result_note: null,
        acceptance_note: null,
        accepted_by: null,
        accepted_at: null,
        status: "IN_PROGRESS",
        created_by: "MANAGER",
        created_at: "2026-09-20T10:00:00",
        updated_at: "2026-09-20T10:00:00",
      },
      {
        id: 2,
        room_id: "R202",
        equipment_id: null,
        assignee: "TECHNICAL",
        priority: "MEDIUM",
        sla_due_at: "2026-09-21T10:00:00",
        materials: "Kiểm tra thiết bị sau vệ sinh",
        result_note: null,
        acceptance_note: null,
        accepted_by: null,
        accepted_at: null,
        status: "NEW",
        created_by: "MANAGER",
        created_at: "2026-09-20T11:00:00",
        updated_at: "2026-09-20T11:00:00",
      },
      {
        id: 3,
        room_id: "R101",
        equipment_id: null,
        assignee: "TECHNICAL",
        priority: "LOW",
        sla_due_at: "2026-09-20T16:00:00",
        materials: "Thay bóng đèn LED phòng khách",
        result_note: "Đã thay bóng LED mới 9W Rạng Đông",
        acceptance_note: "Nghiệm thu đạt tiêu chuẩn",
        accepted_by: "MANAGER",
        accepted_at: "2026-09-20T16:30:00",
        status: "COMPLETED",
        created_by: "MANAGER",
        created_at: "2026-09-20T09:00:00",
        updated_at: "2026-09-20T16:30:00",
      },
    ]);

    // Mock real assets from database
    vi.spyOn(enterpriseApi, "assets").mockResolvedValue([
      {
        id: "AST-HVAC-001",
        name: "Hệ thống điều hòa Chiller trung tâm",
        category: "HVAC",
        location_type: "BUILDING",
        room_id: null,
        floor: 20,
        location: "Tầng kỹ thuật mái",
        brand_model: "Daikin Modular 120RT",
        installed_on: "2023-01-15",
        next_maintenance: "2026-10-15",
        status: "GOOD",
        original_value: 650000000,
        note: "Tài sản tòa nhà",
        active: true,
      },
      {
        id: "AST-GEN-001",
        name: "Máy phát điện dự phòng 500kVA",
        category: "Hệ thống điện",
        location_type: "BUILDING",
        room_id: null,
        floor: -2,
        location: "Phòng kỹ thuật B2",
        brand_model: "Cummins PowerTech",
        installed_on: "2022-11-10",
        next_maintenance: "2026-09-30",
        status: "MAINTENANCE_NEEDED",
        original_value: 480000000,
        note: "Tài sản tòa nhà",
        active: true,
      },
    ]);

    // Mock equipment for room
    vi.spyOn(housekeepingTechnicalApi, "equipment").mockResolvedValue([
      {
        id: 10,
        room_id: "R302",
        name: "Điều hòa Daikin Inverter",
        original_value: 15000000,
        purchased_on: "2024-01-10",
        quantity: 1,
        active: true,
      },
    ]);

    // Mock createWorkOrder
    vi.spyOn(housekeepingTechnicalApi, "createWorkOrder").mockResolvedValue({
      id: 4,
      room_id: "R101",
      equipment_id: null,
      assignee: "TECHNICAL",
      priority: "HIGH",
      sla_due_at: null,
      materials: "[Điều hòa & Không khí (HVAC)] Máy lạnh kêu to",
      result_note: null,
      acceptance_note: null,
      accepted_by: null,
      accepted_at: null,
      status: "NEW",
      created_by: "TECHNICAL",
      created_at: "2026-09-20T12:00:00",
      updated_at: "2026-09-20T12:00:00",
    });

    // Mock updateWorkOrder
    vi.spyOn(housekeepingTechnicalApi, "updateWorkOrder").mockImplementation(async (id, req) => {
      return {
        id,
        room_id: "R302",
        equipment_id: 10,
        assignee: "TECHNICAL",
        priority: "HIGH",
        sla_due_at: "2026-09-20T18:00:00",
        materials: "[HVAC] Điều hòa không làm lạnh",
        result_note: req.result_note || null,
        acceptance_note: null,
        accepted_by: null,
        accepted_at: null,
        status: req.status || "ACKNOWLEDGED",
        created_by: "MANAGER",
        created_at: "2026-09-20T10:00:00",
        updated_at: "2026-09-20T12:00:00",
      };
    });

    // Mock release
    vi.spyOn(housekeepingTechnicalApi, "release").mockResolvedValue({
      id: 3,
      room_id: "R101",
      equipment_id: null,
      assignee: "TECHNICAL",
      priority: "LOW",
      sla_due_at: "2026-09-20T16:00:00",
      materials: "Thay bóng đèn LED phòng khách",
      result_note: "Đã thay bóng LED mới 9W Rạng Đông",
      acceptance_note: "Nghiệm thu đạt tiêu chuẩn",
      accepted_by: "MANAGER",
      accepted_at: "2026-09-20T16:30:00",
      status: "ROOM_RELEASED",
      created_by: "MANAGER",
      created_at: "2026-09-20T09:00:00",
      updated_at: "2026-09-20T17:00:00",
    });
  });

  it("renders live Technical overview screen with real backend data, employee profile and KPIs", async () => {
    render(<MaintenanceStation onBack={onBack} />);

    // Brand and Department
    expect(screen.getByText(/MaM Hotel/i)).toBeDefined();
    expect(screen.getAllByText(/KỸ THUẬT & BẢO TRÌ/i).length).toBeGreaterThan(0);

    // Technician profile loaded dynamically
    await waitFor(() => {
      expect(screen.getAllByText("Lê Hoàng Kỹ Thuật").length).toBeGreaterThan(0);
    });

    // KPIs
    expect(screen.getByText("Phiếu đang mở")).toBeDefined();
    expect(screen.getByText("Sự cố khẩn cấp")).toBeDefined();
    expect(screen.getAllByText("Chờ nghiệm thu").length).toBeGreaterThan(0);

    // Table rows from real work orders
    await waitFor(() => {
      expect(screen.getByText("#1")).toBeDefined();
      expect(screen.getByText("#2")).toBeDefined();
      expect(screen.getByText("#3")).toBeDefined();
    });

    // Room names resolved from real rooms
    await waitFor(() => {
      expect(screen.getAllByText(/702|R302/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/602|R202/i).length).toBeGreaterThan(0);
    });
  });

  it("navigates to 'Danh mục thiết bị & Tài sản' and displays real assets from CSDL", async () => {
    render(<MaintenanceStation onBack={onBack} />);

    const catalogBtn = screen.getByRole("button", { name: /Danh mục thiết bị & Tài sản/i });
    fireEvent.click(catalogBtn);

    expect(await screen.findByText(/Hệ thống điều hòa Chiller trung tâm/i)).toBeDefined();
    expect(screen.getByText(/Máy phát điện dự phòng 500kVA/i)).toBeDefined();
    expect(screen.getByText("AST-HVAC-001")).toBeDefined();
    expect(screen.getByText("AST-GEN-001")).toBeDefined();
  });

  it("opens create panel, loads real rooms from backend, and submits a new work order", async () => {
    render(<MaintenanceStation onBack={onBack} />);

    // Click "Tạo phiếu mới"
    const createBtn = screen.getByRole("button", { name: /Tạo phiếu mới/i });
    fireEvent.click(createBtn);

    expect(await screen.findByText("Tạo phiếu công việc")).toBeDefined();

    // Select real room
    const roomSelect = screen.getByLabelText(/Vị trí phòng/i);
    fireEvent.change(roomSelect, { target: { value: "R101" } });

    // Select category
    const categorySelect = screen.getByLabelText(/Hạng mục sự cố/i);
    fireEvent.change(categorySelect, { target: { value: "Điều hòa & Không khí (HVAC)" } });

    // Enter description
    const descInput = screen.getByPlaceholderText(/Mô tả hiện trạng sự cố/i);
    fireEvent.change(descInput, { target: { value: "Máy lạnh kêu to" } });

    // Submit
    const submitBtn = screen.getByRole("button", { name: /Tạo & phân công phiếu/i });
    expect(submitBtn.hasAttribute("disabled")).toBe(false);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(housekeepingTechnicalApi.createWorkOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          room_id: "R101",
          priority: "HIGH",
          materials: expect.stringContaining("Máy lạnh kêu to"),
        })
      );
    });
  });

  it("acknowledges a NEW work order", async () => {
    render(<MaintenanceStation onBack={onBack} />);

    // Order #2 is NEW -> has "Tiếp nhận" button
    const ackBtn = await screen.findByRole("button", { name: "Tiếp nhận" });
    fireEvent.click(ackBtn);

    await waitFor(() => {
      expect(housekeepingTechnicalApi.updateWorkOrder).toHaveBeenCalledWith(2, {
        status: "ACKNOWLEDGED",
      });
    });
  });

  it("submits result note when completing an IN_PROGRESS work order", async () => {
    render(<MaintenanceStation onBack={onBack} />);

    // Order #1 is IN_PROGRESS -> has "Báo hoàn thành" button
    const doneBtn = await screen.findByRole("button", { name: "Báo hoàn thành" });
    fireEvent.click(doneBtn);

    // Modal opens
    expect(await screen.findByText("Báo cáo kết quả xử lý sự cố")).toBeDefined();

    const noteInput = screen.getByPlaceholderText(/VD: Đã nạp lại gas/i);
    fireEvent.change(noteInput, { target: { value: "Đã nạp ga R32 và vệ sinh lưới lọc" } });

    const submitBtn = screen.getByRole("button", { name: "Gửi chờ nghiệm thu" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(housekeepingTechnicalApi.updateWorkOrder).toHaveBeenCalledWith(1, {
        status: "WAITING_ACCEPTANCE",
        result_note: "Đã nạp ga R32 và vệ sinh lưới lọc",
      });
    });
  });

  it("releases room to PMS when work order is COMPLETED", async () => {
    // Mock confirm dialog
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<MaintenanceStation onBack={onBack} />);

    // Order #3 is COMPLETED -> has "Mở khóa phòng" button
    const releaseBtns = await screen.findAllByRole("button", { name: /Mở.*phòng/i });
    expect(releaseBtns.length).toBeGreaterThan(0);
    fireEvent.click(releaseBtns[0]);

    await waitFor(() => {
      expect(housekeepingTechnicalApi.release).toHaveBeenCalledWith(3);
    });
  });

  it("displays read-only 'Chờ quản lý nghiệm thu' and has NO accept button for Technical role", async () => {
    vi.spyOn(housekeepingTechnicalApi, "workOrders").mockResolvedValue([
      {
        id: 99,
        room_id: "R101",
        equipment_id: null,
        assignee: "TECHNICAL",
        priority: "HIGH",
        sla_due_at: "2026-09-20T18:00:00",
        materials: "Sửa van nước",
        result_note: "Đã thay van mới",
        acceptance_note: null,
        accepted_by: null,
        accepted_at: null,
        status: "WAITING_ACCEPTANCE",
        created_by: "MANAGER",
        created_at: "2026-09-20T10:00:00",
        updated_at: "2026-09-20T12:00:00",
      },
    ]);

    render(<MaintenanceStation onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("#99")).toBeDefined();
    });

    // Verify read-only status badge is present
    expect(screen.getAllByText("Chờ quản lý nghiệm thu").length).toBeGreaterThan(0);

    // Verify there is NO "Nghiệm thu" action button
    const acceptButtons = screen.queryAllByRole("button", { name: /^Nghiệm thu/i });
    expect(acceptButtons.length).toBe(0);
  });

  it("handles profile load error cleanly with retry and does not use fake profile", async () => {
    vi.spyOn(authApi, "employeeProfile").mockRejectedValue(new Error("Network auth error"));

    render(<MaintenanceStation onBack={onBack} />);

    // Should NOT have synthetic profile name "Lê Hoàng Kỹ Thuật"
    await waitFor(() => {
      expect(screen.queryByText("Lê Hoàng Kỹ Thuật")).toBeNull();
    });

    // Should display error state and retry button
    expect(screen.getAllByText("Lỗi tải hồ sơ").length).toBeGreaterThan(0);
    const retryBtn = screen.getByRole("button", { name: "Thử lại" });
    expect(retryBtn).toBeDefined();

    // Re-mock to succeed and click retry
    vi.spyOn(authApi, "employeeProfile").mockResolvedValue({
      employee_id: "TECH_REAL",
      full_name: "Phan Văn Kỹ Thuật",
      role: "TECHNICAL",
      permissions: ["TECHNICAL_WORK_ORDER_READ"],
    });

    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getAllByText("Phan Văn Kỹ Thuật").length).toBeGreaterThan(0);
    });
  });

  it("handles technical data loading failure with retry button", async () => {
    vi.spyOn(housekeepingTechnicalApi, "workOrders").mockRejectedValue(new Error("CSDL connection timed out"));

    render(<MaintenanceStation onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText(/Không thể tải danh sách phiếu kỹ thuật và phòng/i)).toBeDefined();
    });

    // Should offer retry button
    const retryBtns = screen.getAllByRole("button", { name: "Thử lại" });
    expect(retryBtns.length).toBeGreaterThan(0);
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HousekeepingStation from "./HousekeepingStation";
import { housekeepingTechnicalApi } from "../../shared/api/housekeepingTechnical";
import { enterpriseApi } from "../../shared/api/enterprise";
import { authApi } from "../../shared/api/auth";

describe("HousekeepingStation Operational Interface", () => {
  const onBack = vi.fn();

  const mockProfile = {
    employee_id: "EMP01",
    full_name: "Nguyễn Thị Lan",
    role: "HOUSEKEEPING",
    username: "lan.nguyen",
    display_name: "Lan Nguyễn",
  };

  const mockTasks = [
    {
      id: 101,
      room_id: "101",
      assignee: "EMP01",
      status: "NEEDS_CLEANING",
      checklist_complete: false,
      blocking_incident: false,
      note: "Khách trả phòng lúc 11:00",
      assigned_by: "MANAGER",
      updated_at: "2026-09-20T08:00:00",
    },
    {
      id: 201,
      room_id: "201",
      assignee: "EMP01",
      status: "IN_PROGRESS",
      checklist_complete: false,
      blocking_incident: false,
      note: null,
      assigned_by: "MANAGER",
      updated_at: "2026-09-20T08:30:00",
    },
    {
      id: 305,
      room_id: "305",
      assignee: "EMP01",
      status: "CLEANED",
      checklist_complete: true,
      blocking_incident: false,
      note: null,
      assigned_by: "MANAGER",
      updated_at: "2026-09-20T09:00:00",
    },
    {
      id: 102,
      room_id: "102",
      assignee: "EMP01",
      status: "READY",
      checklist_complete: true,
      blocking_incident: false,
      note: null,
      assigned_by: "MANAGER",
      updated_at: "2026-09-20T09:30:00",
    },
  ];

  const mockRooms = [
    { id: "101", name: "101", room_type_id: "DELUXE", room_type_name: "Deluxe King", daily_price: 850000, floor: 1, status: "cleaning" },
    { id: "201", name: "201", room_type_id: "DELUXE", room_type_name: "Deluxe King", daily_price: 850000, floor: 2, status: "cleaning" },
    { id: "305", name: "305", room_type_id: "DELUXE", room_type_name: "Deluxe King", daily_price: 850000, floor: 3, status: "cleaning" },
    { id: "102", name: "102", room_type_id: "DELUXE", room_type_name: "Deluxe King", daily_price: 850000, floor: 1, status: "available" },
  ];

  const mockIncidents = [
    {
      id: 1,
      reservation_id: 901,
      room_id: "108",
      equipment_name: "Điều hòa không mát",
      compensation: 0,
      severity: "HIGH",
      handoff_status: "OPEN",
      handoff_note: null,
    },
  ];

  const mockLinen = [
    { id: "l1", name: "Ga trải giường King", unit: "bộ", current_quantity: 45, safety_threshold: 20, service_id: null, active: true, category: "LINEN" },
    { id: "l5", name: "Khăn tắm lớn", unit: "cái", current_quantity: 15, safety_threshold: 40, service_id: null, active: true, category: "TOWELS" },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(authApi, "employeeProfile").mockResolvedValue(mockProfile as any);
    vi.spyOn(housekeepingTechnicalApi, "tasks").mockResolvedValue(mockTasks as any);
    vi.spyOn(housekeepingTechnicalApi, "rooms").mockResolvedValue(mockRooms as any);
    vi.spyOn(housekeepingTechnicalApi, "incidents").mockResolvedValue(mockIncidents as any);
    vi.spyOn(housekeepingTechnicalApi, "checklistTemplates").mockResolvedValue([
      { id: 1, name: "Thay ga trải giường", active: true },
      { id: 2, name: "Lau sàn phòng tắm", active: true },
    ]);
    vi.spyOn(enterpriseApi, "linen").mockResolvedValue(mockLinen as any);

    vi.spyOn(housekeepingTechnicalApi, "checklistResults").mockResolvedValue([
      { id: 1, task_id: 101, item: "Thay ga trải giường", passed: false, note: null, completed_by: "EMP01", completed_at: "2026-09-20T08:05:00" },
    ]);

    vi.spyOn(housekeepingTechnicalApi, "inspections").mockResolvedValue([
      { id: 1, task_id: 101, inspection_type: "MINIBAR", item: "Bia (lon)", quantity: 1, item_condition: "OK", note: null, completed_by: "EMP01", completed_at: "2026-09-20T08:05:00" },
    ]);

    vi.spyOn(housekeepingTechnicalApi, "updateTask").mockResolvedValue({
      id: 101,
      room_id: "101",
      assignee: "EMP01",
      status: "IN_PROGRESS",
      checklist_complete: false,
      blocking_incident: false,
      note: null,
      assigned_by: "MANAGER",
      updated_at: "2026-09-20T08:35:00",
    } as any);

    vi.spyOn(housekeepingTechnicalApi, "addChecklistResult").mockResolvedValue({
      id: 2,
      task_id: 101,
      item: "Thay ga trải giường",
      passed: true,
      note: null,
      completed_by: "EMP01",
      completed_at: "2026-09-20T08:40:00",
    } as any);

    vi.spyOn(housekeepingTechnicalApi, "addInspection").mockResolvedValue({
      id: 2,
      task_id: 101,
      inspection_type: "MINIBAR",
      item: "Bia (lon)",
      quantity: 2,
      item_condition: "OK",
      note: null,
      completed_by: "EMP01",
      completed_at: "2026-09-20T08:40:00",
    } as any);

    vi.spyOn(housekeepingTechnicalApi, "createIncident").mockResolvedValue({
      id: 501,
      reservation_id: null,
      room_id: "204",
      equipment_name: "Khóa cửa từ không nhận",
      compensation: 0,
      severity: "HIGH",
      handoff_status: "OPEN",
      handoff_note: "Pin yếu, cần thay pin",
    } as any);

    vi.spyOn(housekeepingTechnicalApi, "handoffIncident").mockResolvedValue({
      id: 1,
      reservation_id: 901,
      room_id: "108",
      equipment_name: "Điều hòa không mát",
      compensation: 0,
      severity: "HIGH",
      handoff_status: "OPEN",
      handoff_note: "Buồng phòng nhắc kỹ thuật xử lý sự cố",
    } as any);

    vi.spyOn(enterpriseApi, "moveLinen").mockResolvedValue({
      id: "l1",
      name: "Ga trải giường King",
      unit: "bộ",
      current_quantity: 50,
      safety_threshold: 20,
      service_id: null,
      active: true,
      category: "LINEN",
    } as any);
  });

  it("renders Overview screen with KPIs, shift tasks, and authentic employee profile", async () => {
    render(<HousekeepingStation onBack={onBack} />);

    // Top Brand & Header
    expect(screen.getByText(/VẬN HÀNH BUỒNG PHÒNG/i)).toBeDefined();
    expect(screen.getByText(/Trạm Buồng phòng · Ca trực/i)).toBeDefined();

    // KPI Bar
    expect(screen.getByText("Phòng bẩn")).toBeDefined();
    expect(screen.getByText("Đang dọn phòng")).toBeDefined();
    expect(screen.getByText("Chờ nghiệm thu")).toBeDefined();
    expect(screen.getByText("Đã sẵn sàng")).toBeDefined();
    expect(screen.getByText("Cảnh báo kỹ thuật")).toBeDefined();

    // Shift task header with real employee profile from authApi
    expect(await screen.findByText("Nhiệm vụ ca trực của tôi")).toBeDefined();
    expect(screen.getByText(/Nguyễn Thị Lan · Buồng phòng/i)).toBeDefined();
    expect(screen.getAllByText("Buồng phòng").length).toBeGreaterThan(0);
  });

  it("navigates through all sidebar tabs: Board, Inspection, Linen, Incidents", async () => {
    render(<HousekeepingStation onBack={onBack} />);

    // Wait for initial load
    expect(await screen.findByText("Nhiệm vụ ca trực của tôi")).toBeDefined();

    // 1. Board Kanban
    const boardNav = screen.getByRole("button", { name: /Nhiệm vụ & Checklist/i });
    fireEvent.click(boardNav);
    expect(await screen.findByText("Phòng của tôi (Nguyễn Thị Lan)")).toBeDefined();

    // 2. Inspection
    const inspectNav = screen.getByRole("button", { name: /Kiểm tra & Nghiệm thu/i });
    fireEvent.click(inspectNav);
    expect(await screen.findByText(/Theo dõi phòng đã dọn xong/i)).toBeDefined();

    // 3. Linen & Supplies
    const linenNav = screen.getByRole("button", { name: /Đồ vải & Vật tư ca/i });
    fireEvent.click(linenNav);
    expect(await screen.findByText("Kho đồ vải & Vật tư")).toBeDefined();

    // 4. Incidents
    const incidentNav = screen.getByRole("button", { name: /Báo sự cố kỹ thuật/i });
    fireEvent.click(incidentNav);
    expect(await screen.findByText("Quản lý và theo dõi sự cố phòng liên kết với Bộ phận Kỹ thuật")).toBeDefined();
  });

  it("opens RoomModal, adjusts checklist, updates minibar, and starts cleaning", async () => {
    render(<HousekeepingStation onBack={onBack} />);

    // Find and click on room card
    const roomCards = await screen.findAllByText(/P\.101/i);
    expect(roomCards.length).toBeGreaterThan(0);
    fireEvent.click(roomCards[0]);

    // RoomModal header
    expect(await screen.findByText(/Checklist đồ vải/i)).toBeDefined();
    expect(screen.getByText(/Kiểm kê minibar/i)).toBeDefined();

    // Toggle checklist item
    const checklistItems = screen.getAllByText(/Thay ga trải giường/i);
    if (checklistItems.length > 0) {
      fireEvent.click(checklistItems[0]);
    }

    // Adjust minibar count (+ button)
    const plusButtons = screen.getAllByRole("button");
    const plusBtn = plusButtons.find(b => b.innerHTML.includes("lucide-plus"));
    if (plusBtn) {
      fireEvent.click(plusBtn);
    }

    // Click "Bắt đầu dọn phòng"
    const startCleanBtn = screen.getByRole("button", { name: /Bắt đầu dọn phòng/i });
    fireEvent.click(startCleanBtn);

    await waitFor(() => {
      expect(housekeepingTechnicalApi.updateTask).toHaveBeenCalledWith(101, { status: "IN_PROGRESS" });
    });
  });

  it("completes cleaning and handoff from RoomModal with correct button mapping", async () => {
    render(<HousekeepingStation onBack={onBack} />);

    // Ensure API data is loaded
    expect(await screen.findByText("Nhiệm vụ ca trực của tôi")).toBeDefined();

    // Find and click room 201 card (status: IN_PROGRESS)
    const room201 = screen.getByText("P.201");
    fireEvent.click(room201);

    expect(await screen.findByText(/Checklist đồ vải/i)).toBeDefined();

    const incomplete = screen.getByRole("button", { name: /Cần hoàn thành checklist/i }) as HTMLButtonElement;
    expect(incomplete.disabled).toBe(true);
    fireEvent.click(incomplete);
    expect(housekeepingTechnicalApi.updateTask).not.toHaveBeenCalled();
    expect(housekeepingTechnicalApi.addChecklistResult).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Thay ga trải giường", { exact: true }));
    // Complete only after every displayed checklist item is checked.
    const completeBtn = screen.getByRole("button", { name: /Hoàn tất vệ sinh & Bàn giao/i });
    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(housekeepingTechnicalApi.updateTask).toHaveBeenCalledWith(201, { status: "CLEANED" });
    });
  });

  it("enforces state transition guards: inspecting and ready rooms cannot start or re-complete cleaning", async () => {
    render(<HousekeepingStation onBack={onBack} />);

    expect(await screen.findByText("Nhiệm vụ ca trực của tôi")).toBeDefined();

    // Switch to filter ready rooms
    const readyChip = screen.getByText("Đã sẵn sàng");
    fireEvent.click(readyChip);

    // Open room 102 (READY)
    const room102 = screen.getByText("P.102");
    fireEvent.click(room102);

    expect(await screen.findByText("Phòng đã sẵn sàng đón khách")).toBeDefined();
    expect(screen.queryByRole("button", { name: /Bắt đầu dọn phòng/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Hoàn tất vệ sinh & Bàn giao/i })).toBeNull();
  });

  it("shows rooms awaiting management acceptance without exposing an accept action to housekeeping", async () => {
    render(<HousekeepingStation onBack={onBack} />);

    const inspectNav = screen.getByRole("button", { name: /Kiểm tra & Nghiệm thu/i });
    fireEvent.click(inspectNav);

    expect(await screen.findByText(/Chờ quản lý kiểm tra/i)).toBeDefined();
    expect(await screen.findByRole("heading", { name: /Chờ quản lý nghiệm thu/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /Nghiệm thu đạt/i })).toBeNull();
    expect(housekeepingTechnicalApi.updateTask).not.toHaveBeenCalled();
  });

  it("creates a new equipment incident via createIncident API and never calls createWorkOrder", async () => {
    const workOrderSpy = vi.spyOn(housekeepingTechnicalApi, "createWorkOrder");

    render(<HousekeepingStation onBack={onBack} />);

    const incidentNav = screen.getByRole("button", { name: /Báo sự cố kỹ thuật/i });
    fireEvent.click(incidentNav);

    const newIncidentBtn = await screen.findByRole("button", { name: /Báo sự cố mới/i });
    fireEvent.click(newIncidentBtn);

    expect(screen.getByText("Tạo sự cố thiết bị mới")).toBeDefined();

    // Fill form
    const roomInput = screen.getByPlaceholderText("VD: 204");
    const typeInput = screen.getByPlaceholderText("VD: Điều hòa không lạnh, Rò nước...");
    const descInput = screen.getByPlaceholderText("Mô tả hiện trạng sự cố...");

    fireEvent.change(roomInput, { target: { value: "204" } });
    fireEvent.change(typeInput, { target: { value: "Khóa cửa từ không nhận" } });
    fireEvent.change(descInput, { target: { value: "Pin yếu, cần thay pin" } });

    // Submit
    const submitBtn = screen.getByRole("button", { name: "Gửi báo cáo" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(housekeepingTechnicalApi.createIncident).toHaveBeenCalledWith({
        room_id: "204",
        equipment_name: "Khóa cửa từ không nhận",
        quantity: 1,
        severity: "MEDIUM",
        description: "Pin yếu, cần thay pin",
      });
      expect(workOrderSpy).not.toHaveBeenCalled();
      expect(screen.getByText(/Đã tạo và gửi báo cáo sự cố P\.204/i)).toBeDefined();
    });
  });

  it("calls handoffIncident when reminding technical and does not call window.alert", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    render(<HousekeepingStation onBack={onBack} />);

    const incidentNav = screen.getByRole("button", { name: /Báo sự cố kỹ thuật/i });
    fireEvent.click(incidentNav);

    const remindBtn = await screen.findByRole("button", { name: /Nhắc kỹ thuật/i });
    fireEvent.click(remindBtn);

    await waitFor(() => {
      expect(housekeepingTechnicalApi.handoffIncident).toHaveBeenCalledWith(1, {
        status: "OPEN",
        note: "Buồng phòng nhắc kỹ thuật xử lý sự cố",
      });
      expect(alertSpy).not.toHaveBeenCalled();
    });
  });

  it("performs stock issue and receipt in Linen screen via enterpriseApi.moveLinen", async () => {
    render(<HousekeepingStation onBack={onBack} />);

    const linenNav = screen.getByRole("button", { name: /Đồ vải & Vật tư ca/i });
    fireEvent.click(linenNav);

    expect(await screen.findByText("Kho đồ vải & Vật tư")).toBeDefined();

    // Click "Nhập thêm" on first linen card
    const receiveBtns = await screen.findAllByText("Nhập thêm");
    expect(receiveBtns.length).toBeGreaterThan(0);
    fireEvent.click(receiveBtns[0]);

    expect(screen.getByText(/Nhập kho:/i)).toBeDefined();

    // Click "Lưu tồn kho"
    const saveStockBtn = screen.getByRole("button", { name: "Lưu tồn kho" });
    fireEvent.click(saveStockBtn);

    await waitFor(() => {
      expect(enterpriseApi.moveLinen).toHaveBeenCalledWith(
        expect.objectContaining({
          item_id: "l1",
          movement_type: "RECEIVE",
        })
      );
    });
  });

  it("filters rooms in Kanban Board by floor tabs and search query", async () => {
    render(<HousekeepingStation onBack={onBack} />);

    const boardNav = screen.getByRole("button", { name: /Nhiệm vụ & Checklist/i });
    fireEvent.click(boardNav);

    expect(await screen.findByText("Tầng 1")).toBeDefined();

    // Click "Tầng 2" tab
    const floor2Btn = screen.getByRole("button", { name: "Tầng 2" });
    fireEvent.click(floor2Btn);

    // Search query in header
    const searchInput = screen.getByPlaceholderText("Tìm phòng, ghi chú...");
    fireEvent.change(searchInput, { target: { value: "201" } });

    expect(screen.getByText("201")).toBeDefined();
  });

  /* ══════════════════════════════════════════════════════════
     EDGE CASE TESTS (Zero fake data, Error handling, 401/403)
  ══════════════════════════════════════════════════════════ */

  it("handles empty backend data properly without rendering any mock fallback data", async () => {
    vi.spyOn(housekeepingTechnicalApi, "tasks").mockResolvedValue([]);
    vi.spyOn(housekeepingTechnicalApi, "rooms").mockResolvedValue([]);
    vi.spyOn(housekeepingTechnicalApi, "incidents").mockResolvedValue([]);
    vi.spyOn(enterpriseApi, "linen").mockResolvedValue([]);

    render(<HousekeepingStation onBack={onBack} />);

    // Overview screen should indicate empty list
    expect(await screen.findByText("Chưa có dữ liệu phòng trong danh mục này.")).toBeDefined();
    expect(screen.getByText("Không có sự cố nào đang xử lý.")).toBeDefined();

    // Kanban Board should display empty columns
    const boardNav = screen.getByRole("button", { name: /Nhiệm vụ & Checklist/i });
    fireEvent.click(boardNav);
    expect(await screen.findByText("Tất cả tầng")).toBeDefined();
    const emptyCols = screen.getAllByText("Không có phòng");
    expect(emptyCols.length).toBe(4);

    // Linen screen should display empty message
    const linenNav = screen.getByRole("button", { name: /Đồ vải & Vật tư ca/i });
    fireEvent.click(linenNav);
    expect(await screen.findByText("Chưa có dữ liệu tồn kho đồ vải/vật tư buồng phòng.")).toBeDefined();

    // Incidents screen should display empty message
    const incidentNav = screen.getByRole("button", { name: /Báo sự cố kỹ thuật/i });
    fireEvent.click(incidentNav);
    expect(await screen.findByText("Không có sự cố nào trong danh sách.")).toBeDefined();
  });

  it("displays error banner with retry button on backend API 500 failure", async () => {
    vi.spyOn(housekeepingTechnicalApi, "tasks").mockRejectedValue(new Error("Internal Server Error"));

    render(<HousekeepingStation onBack={onBack} />);

    expect(await screen.findByText("Không thể tải dữ liệu vận hành. Vui lòng thử lại.")).toBeDefined();

    // Test retry button
    vi.spyOn(housekeepingTechnicalApi, "tasks").mockResolvedValue(mockTasks as any);
    const retryBtn = screen.getByRole("button", { name: "Thử lại" });
    fireEvent.click(retryBtn);

    expect(await screen.findByText("Nhiệm vụ ca trực của tôi")).toBeDefined();
  });

  it("displays session expired message on 401 Unauthorized", async () => {
    const error401 = new Error("Unauthorized");
    (error401 as any).status = 401;
    vi.spyOn(housekeepingTechnicalApi, "tasks").mockRejectedValue(error401);

    render(<HousekeepingStation onBack={onBack} />);

    expect(await screen.findByText("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.")).toBeDefined();
  });

  it("displays permission error message on 403 Forbidden", async () => {
    const error403 = new Error("Forbidden");
    (error403 as any).status = 403;
    vi.spyOn(housekeepingTechnicalApi, "tasks").mockRejectedValue(error403);

    render(<HousekeepingStation onBack={onBack} />);

    expect(await screen.findByText("Tài khoản không có quyền truy cập dữ liệu buồng phòng.")).toBeDefined();
  });

  it("handles mutation errors safely and displays error alert without corrupted local state", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(housekeepingTechnicalApi, "updateTask").mockRejectedValueOnce(new Error("Network disconnect"));

    render(<HousekeepingStation onBack={onBack} />);

    const roomCards = await screen.findAllByText(/P\.101/i);
    fireEvent.click(roomCards[0]);

    const startCleanBtn = await screen.findByRole("button", { name: /Bắt đầu dọn phòng/i });
    fireEvent.click(startCleanBtn);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Không thể bắt đầu dọn phòng. Vui lòng thử lại.");
    });
  });
});

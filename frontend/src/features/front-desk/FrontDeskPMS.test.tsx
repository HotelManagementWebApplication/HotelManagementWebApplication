import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FrontDeskPMS from "./FrontDeskPMS";
import { authApi } from "../../shared/api/auth";
import { frontDeskApi } from "../../shared/api/frontDesk";

describe("FrontDeskPMS Reception Interface", () => {
  const onBack = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authApi, "employeeProfile").mockResolvedValue({
      employee_id: "EMP001",
      full_name: "Nguyễn Văn Lễ Tân",
      role: "FRONT_DESK",
      permissions: ["FRONT_DESK_DASHBOARD", "RESERVATION_READ", "RESERVATION_WRITE"],
    });

    vi.spyOn(frontDeskApi, "dashboard").mockResolvedValue({
      business_date: "2026-09-20",
      page: 1,
      size: 10,
      total_elements: 3,
      total_pages: 1,
      room_counts: {},
      unpaid_deposits: [],
      invoice_balances: [],
      rooms: [
        { room_id: "101", name: "101", floor: 1, room_type_id: "DELUXE", room_type_name: "Deluxe King", bed_type: "1 Giường King", daily_price: 850000, status: "OCCUPIED" },
        { room_id: "102", name: "102", floor: 1, room_type_id: "STANDARD", room_type_name: "Standard Twin", bed_type: "2 Giường đơn", daily_price: 550000, status: "VACANT" },
        { room_id: "203", name: "203", floor: 2, room_type_id: "VIP", room_type_name: "Executive Suite", bed_type: "1 Giường Super King", daily_price: 1500000, status: "OCCUPIED" },
        { room_id: "104", name: "104", floor: 1, room_type_id: "STANDARD", room_type_name: "Standard Double", bed_type: "1 Giường đôi", daily_price: 650000, status: "READY" },
        { room_id: "105", name: "105", floor: 1, room_type_id: "STANDARD", room_type_name: "Standard Double", bed_type: "1 Giường đôi", daily_price: 650000, status: "READY" },
      ],
      current_stays: [
        { reservation_id: 1001, guest_id: 10, guest_name: "Trần Văn An", guest_phone: "0901234567", check_in: "2026-09-20T14:00:00", check_out: "2026-09-22T12:00:00", status: "CHECKED_IN", deposit_amount: 500000, deposit_payment_status: "SUCCESS", invoice_balance: 1200000, room_ids: ["203"] },
      ],
      arrivals: [
        { reservation_id: 1002, guest_id: 11, guest_name: "Lê Thị Bình", guest_phone: "0912345678", check_in: "2026-09-20T14:00:00", check_out: "2026-09-21T12:00:00", status: "CONFIRMED", deposit_amount: 300000, deposit_payment_status: "SUCCESS", invoice_balance: 250000, room_ids: ["102"] },
      ],
      departures: [
        { reservation_id: 1003, guest_id: 12, guest_name: "Hoàng Minh Cường", guest_phone: "0923456789", check_in: "2026-09-18T14:00:00", check_out: "2026-09-20T12:00:00", status: "CHECKED_IN", deposit_amount: 1000000, deposit_payment_status: "SUCCESS", invoice_balance: 0, room_ids: ["101"] },
      ],
      incidents: [
        { id: 1, reservation_id: 1001, room_id: "101", compensation: 0 },
      ],
    });

    vi.spyOn(frontDeskApi, "services").mockResolvedValue([
      { id: "1", name: "Coca Cola", price: 30000, unit: "lon", stock: 10, active: true },
      { id: "2", name: "Giặt ủi áo sơ mi", price: 50000, unit: "cái", stock: 10, active: true },
    ]);

    vi.spyOn(frontDeskApi, "timeline").mockResolvedValue([]);

    vi.spyOn(frontDeskApi, "reservation").mockResolvedValue({
      id: 1001,
      guest_id: 10,
      employee_id: "EMP001",
      status: "CHECKED_IN",
      booked_at: "2026-09-18T10:00:00",
      actual_check_in: "2026-09-20T14:00:00",
      actual_check_out: null,
      cancellation_reason: null,
      cancellation_outcome: null,
      deposit: 500000,
      rental_type: "PACKAGE",
      rooms: [{ room_id: "203", expected_check_in: "2026-09-20T14:00:00", expected_check_out: "2026-09-22T12:00:00", actual_check_in: "2026-09-20T14:00:00", actual_check_out: null }],
    });

    vi.spyOn(frontDeskApi, "invoice").mockResolvedValue({
      id: 2001,
      reservation_id: 1001,
      issued_at: "2026-09-20T14:00:00",
      payable: 1200000,
      deposit: 500000,
      room_total: 1500000,
      service_total: 200000,
      late_surcharge: 0,
      compensation: 0,
      extension_total: 0,
      adjustment_total: 0,
      discount: 0,
      payment_method: null,
      status: "CHUA_THANH_TOAN",
    });

    vi.spyOn(frontDeskApi, "checkIn").mockResolvedValue({
      id: 1002,
      guest_id: 11,
      employee_id: "EMP001",
      status: "CHECKED_IN",
      booked_at: "2026-09-18T10:00:00",
      actual_check_in: "2026-09-20T14:05:00",
      actual_check_out: null,
      cancellation_reason: null,
      cancellation_outcome: null,
      deposit: 300000,
      rental_type: "PACKAGE",
      rooms: [{ room_id: "102", expected_check_in: "2026-09-20T14:00:00", expected_check_out: "2026-09-21T12:00:00", actual_check_in: "2026-09-20T14:05:00", actual_check_out: null }],
    });

    vi.spyOn(frontDeskApi, "checkOut").mockResolvedValue({
      id: 2001,
      reservation_id: 1001,
      issued_at: "2026-09-20T14:00:00",
      payable: 1200000,
      deposit: 500000,
      room_total: 1500000,
      service_total: 200000,
      late_surcharge: 0,
      compensation: 0,
      extension_total: 0,
      adjustment_total: 0,
      discount: 0,
      payment_method: null,
      status: "DA_THANH_TOAN",
    });

    vi.spyOn(frontDeskApi, "cashHandover").mockResolvedValue({
      id: 301,
      shift_code: "CA-CHIEU-20",
      from_actor: "EMP001",
      to_actor: "EMP002",
      expected_amount: 5000000,
      actual_amount: 5000000,
      variance: 0,
      note: "Bàn giao ca hoàn tất không lệch tiền.",
      handed_over_at: "2026-09-20T15:00:00",
      denominations: [],
    });
    vi.spyOn(frontDeskApi, "myCashHandovers").mockResolvedValue({
      items: [{
        id: 300, shift_code: "FD-2026-09-20", from_actor: "EMP001", to_actor: "EMP002",
        expected_amount: 5000000, actual_amount: 5000000, variance: 0,
        handed_over_at: "2026-09-20T15:00:00", note: "Khớp quỹ cuối ca", denominations: [],
      }], page: 0, size: 8, total_elements: 1, total_pages: 1,
    });
    vi.spyOn(frontDeskApi, "roomEquipment").mockResolvedValue([
      { id: 1, room_id: "203", name: "TV 4K", original_value: 12000000, purchased_on: "2025-01-01", quantity: 1, active: true },
    ]);
    vi.spyOn(frontDeskApi, "transfer").mockResolvedValue({
      id: 901, reservation_id: 1001, from_room_id: "203", to_room_id: "104",
      transferred_at: "2026-09-20T16:00:00", reason: "Khóa cửa hỏng",
    });
    vi.spyOn(frontDeskApi, "roomAvailability").mockResolvedValue([
      { room_id: "101", room_type_id: "DELUXE", room_type_name: "Deluxe King", daily_price: 850000, floor: 1, available: false },
      { room_id: "102", room_type_id: "STANDARD", room_type_name: "Standard Twin", daily_price: 550000, floor: 1, available: false },
      { room_id: "104", room_type_id: "STANDARD", room_type_name: "Standard Double", daily_price: 650000, floor: 1, available: true },
      { room_id: "105", room_type_id: "STANDARD", room_type_name: "Standard Double", daily_price: 650000, floor: 1, available: false },
      { room_id: "203", room_type_id: "VIP", room_type_name: "Executive Suite", daily_price: 1500000, floor: 2, available: false },
    ]);
  });

  it("renders Overview screen with KPIs and arrivals / departures tables", async () => {
    render(<FrontDeskPMS onBack={onBack} />);

    // Welcome bar
    expect(screen.getByText(/HỆ THỐNG LỄ TÂN/i)).toBeDefined();
    expect(await screen.findByText(/Khách đến hôm nay/i)).toBeDefined();
    expect(screen.getByText(/Khách trả phòng hôm nay/i)).toBeDefined();
    expect(screen.getByText(/Phòng sẵn sàng/i)).toBeDefined();
    expect(screen.queryByText(/Sạch:/i)).toBeNull();

    // Verify arrivals has action button "Xem phòng"
    const viewRoomBtns = await screen.findAllByText("Xem phòng");
    expect(viewRoomBtns.length).toBeGreaterThan(0);

    // Click "Xem phòng" opens RoomMap and selects that room
    fireEvent.click(viewRoomBtns[0]);
    expect(await screen.findByRole("heading", { name: "Sơ đồ phòng" })).toBeDefined();
  });

  it("navigates to Sơ đồ phòng and tests grid / list views, drawer close and tabs", async () => {
    render(<FrontDeskPMS onBack={onBack} />);

    // Click navigation to Sơ đồ phòng
    const roomMapNav = screen.getByRole("button", { name: /Sơ đồ phòng/i });
    fireEvent.click(roomMapNav);

    expect(await screen.findByRole("heading", { name: "Sơ đồ phòng" })).toBeDefined();

    // Find list view button and click
    const buttons = screen.getAllByRole("button");
    const listBtn = buttons.find(b => b.innerHTML.includes("lucide-list"));
    if (listBtn) fireEvent.click(listBtn);

    // Check RoomDrawer can switch tabs
    const tabInfo = await screen.findByText("Thông tin");
    const tabServices = screen.getByText("Dịch vụ");
    const tabHistory = screen.getByText("Lịch sử");
    const tabNotes = screen.getByText("Ghi chú");

    expect(tabInfo).toBeDefined();
    expect(screen.getByRole("note").textContent).toMatch(/Dọn phòng và bảo trì do bộ phận chuyên trách xử lý/i);
    expect(screen.queryByRole("button", { name: /Đổi trạng thái phòng/i })).toBeNull();
    fireEvent.click(tabServices);
    expect(screen.getByText(/Dịch vụ phát sinh & minibar/i)).toBeDefined();
    expect(screen.queryByText(/backend|CSDL|database|API/i)).toBeNull();

    fireEvent.click(tabNotes);
    expect(screen.getAllByText(/Ghi chú vận hành/i).length).toBeGreaterThanOrEqual(1);

    fireEvent.click(tabHistory);
    expect(screen.getByText(/Chưa có lịch sử thao tác/i)).toBeDefined();

    // Bottom action: Chuyển phòng
    const transferBtn = screen.getByRole("button", { name: /Chuyển phòng/i });
    fireEvent.click(transferBtn);
    const targetRoom = screen.getByRole("combobox", { name: "Phòng đích" });
    expect(screen.getByRole("option", { name: /Phòng 102 · room_id 102 · đã giữ phòng/i })).toHaveProperty("disabled", true);
    expect(await screen.findByRole("option", { name: /Phòng 105 · room_id 105 · đã có lịch trùng/i })).toHaveProperty("disabled", true);
    expect(await screen.findByRole("option", { name: /Phòng 104 · room_id 104 · trống, sẵn sàng/i })).toHaveProperty("disabled", false);
    fireEvent.change(targetRoom, { target: { value: "104" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Lý do chuyển phòng" }), { target: { value: "Khóa cửa hỏng" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận chuyển phòng" }));
    await waitFor(() => expect(frontDeskApi.transfer).toHaveBeenCalledWith(1001, {
      from_room_id: "203", to_room_id: "104", reason: "Khóa cửa hỏng",
    }, expect.any(String)));

    // Close RoomDrawer
    const closeBtn = buttons.find(b => b.innerHTML.includes("lucide-x"));
    if (closeBtn) {
      fireEvent.click(closeBtn);
      await waitFor(() => {
        expect(screen.queryByText("Tài khoản lưu trú")).toBeNull();
      });
    }
  });

  it("never attaches a checked-in guest or transfer action to a room that is being cleaned", async () => {
    vi.mocked(frontDeskApi.dashboard).mockResolvedValue({
      business_date: "2026-09-23", page: 0, size: 100, total_elements: 1, total_pages: 1,
      room_counts: {}, unpaid_deposits: [], invoice_balances: [], arrivals: [], departures: [], incidents: [],
      rooms: [
        { room_id: "502", name: "502", floor: 5, room_type_id: "STD", room_type_name: "Standard", bed_type: "Đôi", daily_price: 500000, status: "CLEANING" },
        { room_id: "604", name: "604", floor: 6, room_type_id: "STD", room_type_name: "Standard", bed_type: "Đôi", daily_price: 500000, status: "OCCUPIED" },
      ],
      current_stays: [{
        reservation_id: 1001, guest_id: 10, guest_name: "Trần Thị Bình", guest_phone: "0900000000",
        check_in: "2026-09-21T14:00:00", check_out: "2026-09-26T12:00:00", status: "CHECKED_IN",
        deposit_amount: 0, deposit_payment_status: "NOT_REQUIRED", invoice_balance: 0,
        // Mô phỏng read-model cũ bị lỗi: vẫn gửi cả phòng nguồn đang dọn.
        room_ids: ["502", "604"],
      }],
    });

    render(<FrontDeskPMS onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: /Sơ đồ phòng/i }));
    expect(await screen.findByRole("heading", { name: "Sơ đồ phòng" })).toBeDefined();

    const drawer = await screen.findByLabelText("Chi tiết phòng 502");
    expect(within(drawer).getByText("Đang dọn")).toBeDefined();
    expect(within(drawer).queryByText("Trần Thị Bình")).toBeNull();
    expect(within(drawer).getByRole("button", { name: /Chuyển phòng/i })).toHaveProperty("disabled", true);
  });

  it("shows a future confirmed hourly booking on its room card without marking it occupied", async () => {
    vi.mocked(frontDeskApi.dashboard).mockResolvedValue({
      business_date: "2026-09-23", page: 0, size: 100, total_elements: 1, total_pages: 1,
      room_counts: {}, unpaid_deposits: [], invoice_balances: [], arrivals: [], departures: [], current_stays: [], incidents: [],
      rooms: [
        { room_id: "504", name: "504", floor: 5, room_type_id: "SUP", room_type_name: "Superior", bed_type: "Đôi", daily_price: 300000, status: "READY" },
      ],
      upcoming_stays: [{
        reservation_id: 8, guest_id: 1, guest_name: "Nguyễn Văn An", guest_phone: "0901234567",
        check_in: "2026-09-24T18:00:00", check_out: "2026-09-24T21:00:00", status: "CONFIRMED",
        deposit_amount: 0, deposit_payment_status: "NOT_REQUIRED", invoice_balance: 1230000, room_ids: ["504"],
      }],
    });

    render(<FrontDeskPMS onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: /Sơ đồ phòng/i }));

    const drawer = await screen.findByLabelText("Chi tiết phòng 504");
    expect(within(drawer).getByText("Đã giữ phòng")).toBeDefined();
    expect(within(drawer).queryByText("Có khách")).toBeNull();
    expect(within(drawer).getByText("Nguyễn Văn An")).toBeDefined();
    expect(within(drawer).getByText(/2026-09-24T18:00:00/)).toBeDefined();
  });

  it("navigates to Khách hàng screen, searches and toggles VIP filter", async () => {
    render(<FrontDeskPMS onBack={onBack} />);

    // Navigate to Khách hàng
    const guestsNav = screen.getByRole("button", { name: /Khách hàng/i });
    fireEvent.click(guestsNav);

    expect(await screen.findByText(/Quản lý hồ sơ và trạng thái khách/i)).toBeDefined();

    // Toggle VIP filter
    const vipFilterBtn = screen.getByRole("button", { name: /Lọc VIP/i });
    fireEvent.click(vipFilterBtn);
    expect(screen.getByText(/Chỉ xem VIP/i)).toBeDefined();

    // Search input
    const searchInput = screen.getByPlaceholderText(/Tìm khách, số phòng, mã booking.../i);
    fireEvent.change(searchInput, { target: { value: "KhôngTồnTại12345" } });

    // Switch to Sắp đến tab
    const arrivingTab = screen.getByRole("button", { name: /Sắp đến/i });
    fireEvent.click(arrivingTab);

    // Switch to Trả phòng tab
    const departedTab = screen.getByRole("button", { name: /Trả phòng/i });
    fireEvent.click(departedTab);
  });

  it("navigates to Giao ca & Két tiền, counts cash, toggles checklist and executes handover", async () => {
    render(<FrontDeskPMS onBack={onBack} />);

    // Navigate to Giao ca
    const shiftNav = screen.getByRole("button", { name: /Giao ca & Két tiền/i });
    fireEvent.click(shiftNav);

    expect(await screen.findByText(/Thông tin ca làm/i)).toBeDefined();
    expect(await screen.findByText(/Lịch sử bàn giao của tôi/i)).toBeDefined();
    expect(screen.getByText(/Khớp quỹ cuối ca/i)).toBeDefined();

    // Toggle checklist
    const checklistBtn = screen.getByText(/Kiểm đếm và đối chiếu tiền mặt/i);
    fireEvent.click(checklistBtn);

    // Enter matching cash count (5.000.000)
    const countInputs = screen.getAllByRole("spinbutton");
    // countInputs[0] is actualAmount input
    if (countInputs.length > 0) {
      fireEvent.change(countInputs[0], { target: { value: "5000000" } });
    }

    // Confirm cash count
    const confirmBtn = screen.getByRole("button", { name: /Xác nhận số tiền kiểm thực tế/i });
    fireEvent.click(confirmBtn);

    // Set recipient employee ID
    const recipientInput = screen.getByPlaceholderText("EMP002");
    fireEvent.change(recipientInput, { target: { value: "EMP002" } });

    // Submit handover
    const submitBtn = screen.getByRole("button", { name: /Bàn giao ca chính thức/i }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(frontDeskApi.cashHandover).toHaveBeenCalledWith(
        expect.objectContaining({
          from_actor: "EMP001",
          to_actor: "EMP002",
          actual_amount: 5000000,
        }),
        expect.any(String)
      );
    });

    expect(await screen.findByText(/Bàn giao #301 thành công/i)).toBeDefined();
  });

  it("displays accurate Vietnamese empty states when API returns empty collections and zero mock data", async () => {
    vi.spyOn(frontDeskApi, "dashboard").mockResolvedValueOnce({
      business_date: "2026-09-20",
      page: 1,
      size: 10,
      total_elements: 0,
      total_pages: 1,
      room_counts: {},
      unpaid_deposits: [],
      invoice_balances: [],
      rooms: [
        { room_id: "101", name: "101", floor: 1, room_type_id: "DELUXE", room_type_name: "Deluxe King", bed_type: "1 Giường King", daily_price: 850000, status: "VACANT" },
      ],
      current_stays: [],
      arrivals: [],
      departures: [],
      incidents: [],
    });

    render(<FrontDeskPMS onBack={onBack} />);

    // Verify empty state messages in Overview
    expect(await screen.findByText("Hôm nay không có khách đến")).toBeDefined();
    expect(screen.getByText("Hôm nay không có khách trả phòng")).toBeDefined();
    expect(screen.getByText("Không có sự cố")).toBeDefined();
    expect(screen.getByText("Chưa có hoạt động nào trong ngày")).toBeDefined();

    // Navigate to Khách hàng
    const guestsNav = screen.getByRole("button", { name: /Khách hàng/i });
    fireEvent.click(guestsNav);

    // Verify empty state message in Guests screen
    expect(await screen.findByText("Chưa có khách đang lưu trú")).toBeDefined();
  });

  it("displays canonical status 'Đã giữ phòng' (reserved) for reserved rooms", async () => {
    vi.spyOn(frontDeskApi, "dashboard").mockResolvedValueOnce({
      business_date: "2026-09-20",
      page: 1,
      size: 10,
      total_elements: 1,
      total_pages: 1,
      room_counts: { reserved: 1 },
      unpaid_deposits: [],
      invoice_balances: [],
      rooms: [
        { room_id: "305", name: "305", floor: 3, room_type_id: "DELUXE", room_type_name: "Deluxe King", bed_type: "1 Giường King", daily_price: 900000, status: "reserved" },
      ],
      current_stays: [],
      arrivals: [],
      departures: [],
      incidents: [],
    });

    render(<FrontDeskPMS onBack={onBack} />);

    // Navigate to Sơ đồ phòng
    const roomMapNav = screen.getByRole("button", { name: /Sơ đồ phòng/i });
    fireEvent.click(roomMapNav);

    // Should find the tab "Đã giữ phòng (1)"
    expect(await screen.findByRole("button", { name: /Đã giữ phòng \(1\)/i })).toBeDefined();

    // Room card should display badge "Đã giữ phòng"
    const badges = screen.getAllByText("Đã giữ phòng");
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("shows error banner and retry button on API failure without mock data fallback", async () => {
    const errorSpy = vi.spyOn(frontDeskApi, "dashboard").mockRejectedValueOnce(new Error("Lỗi kết nối cơ sở dữ liệu"));

    render(<FrontDeskPMS onBack={onBack} />);

    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.getByText(/Không tải được thông tin vận hành/i)).toBeDefined();

    const retryBtn = screen.getByRole("button", { name: /Thử lại/i });
    expect(retryBtn).toBeDefined();

    // Clicking retry calls dashboard again
    fireEvent.click(retryBtn);
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });
});

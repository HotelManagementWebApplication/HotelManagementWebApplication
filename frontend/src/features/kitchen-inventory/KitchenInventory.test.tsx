import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import KitchenInventory from "./KitchenInventory";
import { kitchenAccountingApi } from "../../shared/api/kitchenAccounting";
import { authApi } from "../../shared/api/auth";

describe("Kitchen & restaurant operations", () => {
  const booking = {
    id: 71, reservation_id: 7, room_id: "802", service_id: "MAMREST", service_name: "MaM Restaurant",
    scheduled_at: new Date(Date.now() - 60_000).toISOString(), quantity: 1, free_quantity: 0,
    unit_price: 250000, amount_due: 250000, meal_period: "LUNCH", status: "CONFIRMED", note: "Demo order",
  };
  const service = {
    id: "MAMREST", name: "MaM Restaurant", price: 250000, unit: "lượt", category: "fine-dining",
    stock: 20, safety_threshold: 2, low_stock: false, active: true,
  };
  const spaService = { ...service, id:"SPAMASS", name:"Massage", category:"spa" };
  const outOfStockService = { ...service, id:"INROOMQA", name:"Nước suối", category:"inroom", stock:0, safety_threshold:1 };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authApi, "employeeProfile").mockResolvedValue({ employee_id:"KITCHEN", full_name:"Võ Minh Bếp", role:"KITCHEN", permissions:["INVENTORY_WRITE","RESTAURANT_ORDER_WRITE","SERVICE_PRICE_REQUEST"] });
    vi.spyOn(kitchenAccountingApi, "services").mockResolvedValue([service, spaService, outOfStockService]);
    vi.spyOn(kitchenAccountingApi, "inventoryMovements").mockResolvedValue([]);
    vi.spyOn(kitchenAccountingApi, "priceRequests").mockResolvedValue([]);
    vi.spyOn(kitchenAccountingApi, "restaurantBookings").mockResolvedValue([booking]);
    vi.spyOn(kitchenAccountingApi, "markRestaurantBookingUsed").mockResolvedValue({ ...booking, status:"USED" });
    vi.spyOn(kitchenAccountingApi, "recordInventoryMovement").mockResolvedValue({
      id: 901, service_id:"MAMREST", type:"RECEIVE", quantity:4, actor_id:"KITCHEN", occurred_at:new Date().toISOString(), reason:"Nhập thử" });
    vi.spyOn(kitchenAccountingApi, "submitPrice").mockResolvedValue({
      id: 902, requester:"KITCHEN", action:"SERVICE_PRICE_CHANGE", target_id:"MAMREST", payload:"{\"price\":300000}",
      amount:null, reason:"Giá đầu vào thay đổi", risk:"MEDIUM", status:"PENDING", approver:null, decided_at:null,
      expires_at:null, consumed_at:null, requested_at:new Date().toISOString(), idempotency_key:"price-test" });
  });

  it("loads restaurant orders and confirms service through the backend", async () => {
    render(<KitchenInventory onBack={vi.fn()} />);
    expect(await screen.findByText("MaM Restaurant")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name:"Xác nhận phục vụ" }));
    await waitFor(() => expect(kitchenAccountingApi.markRestaurantBookingUsed).toHaveBeenCalledWith(71));
    expect((await screen.findAllByText("Đã phục vụ")).length).toBeGreaterThanOrEqual(2);
  });

  it("records stock intake from the inventory screen with an auditable reason", async () => {
    render(<KitchenInventory onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name:"Kho & Minibar" }));
    expect(await screen.findByText("SKU: MAMREST")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name:"Phiếu nhập kho" }));
    expect(await screen.findByRole("dialog", { name:"Ghi nhận phiếu kho" })).toBeTruthy();
    fireEvent.change(screen.getByRole("spinbutton"), { target:{ value:"4" } });
    fireEvent.change(screen.getByPlaceholderText("Ví dụ: Cấp cho buồng phòng – phòng 502"), { target:{ value:"Nhập thử cho kho bếp" } });
    fireEvent.click(screen.getByRole("button", { name:"Lưu phiếu kho" }));
    await waitFor(() => expect(kitchenAccountingApi.recordInventoryMovement).toHaveBeenCalledWith(
      { service_id:"MAMREST", type:"RECEIVE", quantity:4, reason:"Nhập thử cho kho bếp" }, expect.any(String)));
    expect((await screen.findByRole("status")).textContent).toContain("đã được ghi nhận");
  });

  it("creates price requests for a selected backend service, not free-form labels", async () => {
    render(<KitchenInventory onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name:"Kho & Minibar" }));
    expect(await screen.findByText("SKU: MAMREST")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name:"Đề xuất giá dịch vụ" }));
    fireEvent.click(screen.getByRole("button", { name:"Tạo yêu cầu" }));
    fireEvent.change(screen.getByRole("spinbutton"), { target:{ value:"300000" } });
    fireEvent.change(screen.getByPlaceholderText("Nêu rõ lý do thay đổi"), { target:{ value:"Giá đầu vào thay đổi" } });
    fireEvent.click(screen.getByRole("button", { name:"Gửi quản lý" }));
    await waitFor(() => expect(kitchenAccountingApi.submitPrice).toHaveBeenCalledWith(
      "MAMREST", { price:300000, reason:"Giá đầu vào thay đổi" }, expect.any(String)));
  });

  it("filters by actual backend categories and handles the out-of-stock status", async () => {
    render(<KitchenInventory onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name:"Kho & Minibar" }));
    expect(await screen.findByText("SKU: MAMREST")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name:"Nhà hàng" }));
    expect(screen.getByText("SKU: MAMREST")).toBeTruthy();
    expect(screen.queryByText("SKU: SPAMASS")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name:"Spa" }));
    expect(screen.getByText("SKU: SPAMASS")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name:"Tất cả danh mục" }));
    fireEvent.change(screen.getByRole("combobox"), { target:{ value:"Out of Stock" } });
    expect(await screen.findByText("SKU: INROOMQA")).toBeTruthy();
    expect(screen.queryByText("SKU: MAMREST")).toBeNull();
  });

  it("renders both canonical numeric and legacy object price-request payloads", async () => {
    vi.mocked(kitchenAccountingApi.priceRequests).mockResolvedValue([
      {
        id:903, requester:"KITCHEN", action:"SERVICE_PRICE_CHANGE", target_id:"MAMREST", payload:"251000",
        amount:251000, reason:"Yêu cầu định dạng số thuần", risk:"MEDIUM", status:"PENDING", approver:null,
        decided_at:null, expires_at:null, consumed_at:null, requested_at:new Date().toISOString(), idempotency_key:"scalar-price",
      },
      {
        id:904, requester:"KITCHEN", action:"SERVICE_PRICE_CHANGE", target_id:"SPAMASS",
        payload:'{"service_id":"SPAMASS","price":1100000,"reason":"Dữ liệu lịch sử"}', amount:1100000,
        reason:"Dữ liệu lịch sử", risk:"MEDIUM", status:"PENDING", approver:null, decided_at:null,
        expires_at:null, consumed_at:null, requested_at:new Date().toISOString(), idempotency_key:"legacy-price",
      },
    ]);
    render(<KitchenInventory onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name:"Đề xuất giá dịch vụ" }));
    expect(await screen.findByText("Yêu cầu định dạng số thuần")).toBeTruthy();
    expect(screen.getByText("251.000")).toBeTruthy();
    expect(screen.getByText("Dữ liệu lịch sử")).toBeTruthy();
    expect(screen.getByText("1.100.000")).toBeTruthy();
  });
});

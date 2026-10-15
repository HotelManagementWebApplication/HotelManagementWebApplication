import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import KitchenInventory from "./KitchenInventory";
import { kitchenAccountingApi } from "../../shared/api/kitchenAccounting";
import { authApi } from "../../shared/api/auth";
import { serviceAvailabilityApi } from "../../shared/api/serviceAvailability";
import { catalogProposalsApi } from "../../shared/api/catalogProposals";

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
    vi.spyOn(catalogProposalsApi,"list").mockResolvedValue([]);
    vi.spyOn(serviceAvailabilityApi,"list").mockResolvedValue([
      {service_id:"MAMREST",unit:"suất",capacity:20,booked:0,available:20,mode:"UNITS",consumes_stock:true},
      {service_id:"SPAMASS",unit:"suất",capacity:20,booked:0,available:20,mode:"UNITS"},
      {service_id:"INROOMQA",unit:"suất",capacity:20,booked:20,available:0,mode:"UNITS"},
    ]);
    vi.spyOn(authApi, "employeeProfile").mockResolvedValue({ employee_id:"KITCHEN", full_name:"Võ Minh Bếp", role:"KITCHEN", permissions:["INVENTORY_WRITE","RESTAURANT_ORDER_WRITE","SERVICE_PRICE_REQUEST"] });
    vi.spyOn(kitchenAccountingApi, "services").mockResolvedValue([service, spaService, outOfStockService]);
    vi.spyOn(kitchenAccountingApi, "inventoryMovements").mockResolvedValue([]);
    vi.spyOn(kitchenAccountingApi, "priceRequests").mockResolvedValue([]);
    vi.spyOn(kitchenAccountingApi, "coordinatedBookings").mockResolvedValue([booking]);
    vi.spyOn(kitchenAccountingApi, "markServiceBookingUsed").mockResolvedValue({ ...booking, status:"USED" });
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
    fireEvent.click(screen.getByRole("button", { name:"Xác nhận sử dụng" }));
    await waitFor(() => expect(kitchenAccountingApi.markServiceBookingUsed).toHaveBeenCalledWith(71));
    expect((await screen.findAllByText("Đã sử dụng")).length).toBeGreaterThanOrEqual(2);
  });

  it("separates physical stock from services and filters food, drinks and household goods", async () => {
    const food = { ...service, id:"FOODPHO", name:"Phở bò", category:"food", active:false };
    const drink = { ...service, id:"DRNKTEA", name:"Trà đào", category:"beverage", active:false };
    const household = { ...service, id:"HHKETTLE", name:"Ấm đun nước", category:"room-amenity", active:false };
    vi.mocked(kitchenAccountingApi.services).mockResolvedValue([service, spaService, food, drink, household]);
    render(<KitchenInventory onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name:"Kho" }));
    expect(await screen.findByText("SKU: FOODPHO")).toBeTruthy();
    expect(screen.getByText("SKU: DRNKTEA")).toBeTruthy();
    expect(screen.getByText("SKU: HHKETTLE")).toBeTruthy();
    expect(screen.queryByText("SKU: MAMREST")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name:"Món ăn" }));
    expect(screen.getByText("SKU: FOODPHO")).toBeTruthy();
    expect(screen.queryByText("SKU: DRNKTEA")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name:"Thức uống" }));
    expect(screen.getByText("SKU: DRNKTEA")).toBeTruthy();
    expect(screen.queryByText("SKU: FOODPHO")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name:"Đồ gia dụng" }));
    expect(screen.getByText("SKU: HHKETTLE")).toBeTruthy();
    expect(screen.queryByText("SKU: DRNKTEA")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name:"Dịch vụ" }));
    expect(screen.getByText("SKU: MAMREST")).toBeTruthy();
    expect(screen.getByText("SKU: SPAMASS")).toBeTruthy();
    expect(screen.queryByText("SKU: HHKETTLE")).toBeNull();
    expect(screen.queryByRole("button", { name:"Món ăn" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name:"Kho" }));
    expect(screen.getByText("SKU: FOODPHO")).toBeTruthy();
  });

  it("shows only minibar stock in its filter and keeps it out of hotel services", async () => {
    const minibarDrink = { ...service, id:"MINICOLA", name:"Minibar · Cola", category:"beverage", active:false };
    const minibarSnack = { ...service, id:"MININUTS", name:"Minibar · Hạt điều", category:"food", active:false };
    const kitchenFood = { ...service, id:"FOODRICE", name:"Cơm chiên", category:"food", active:false };
    const household = { ...service, id:"HHGLASS", name:"Ly thủy tinh", category:"room-amenity", active:false };
    vi.mocked(kitchenAccountingApi.services).mockResolvedValue([service, minibarDrink, minibarSnack, kitchenFood, household]);
    render(<KitchenInventory onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name:"Kho" }));
    await screen.findByText("SKU: MINICOLA");
    fireEvent.click(screen.getByRole("button", { name:"Minibar" }));
    expect(screen.getByText("SKU: MINICOLA")).toBeTruthy();
    expect(screen.getByText("SKU: MININUTS")).toBeTruthy();
    expect(screen.queryByText("SKU: FOODRICE")).toBeNull();
    expect(screen.queryByText("SKU: HHGLASS")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name:"Dịch vụ" }));
    expect(screen.getByText("SKU: MAMREST")).toBeTruthy();
    expect(screen.queryByText("SKU: MINICOLA")).toBeNull();
  });

  it("uses dated availability with resource units while keeping billing units and stock prices", async () => {
    vi.mocked(kitchenAccountingApi.services).mockResolvedValue([
      {...service,id:"BADMINTON",name:"Cầu lông",category:"recreation",unit:"giờ",stock:16},
      {...service,id:"BOARDROOM",name:"Phòng họp",category:"business",unit:"ngày",stock:4},
      {...service,id:"HHGLASS",name:"Ly thủy tinh",category:"room-amenity",unit:"cái",price:25000,active:false},
    ]);
    vi.mocked(serviceAvailabilityApi.list).mockImplementation(async(from)=>[
      {service_id:"BADMINTON",unit:"sân",capacity:2,booked:from.includes("T12:")?2:1,available:from.includes("T12:")?0:1,mode:"DURATION"},
      {service_id:"BOARDROOM",unit:"phòng",capacity:1,booked:0,available:1,mode:"DURATION"},
    ]);
    render(<KitchenInventory onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button",{name:"Dịch vụ"}));
    expect(await screen.findByText("1 sân")).toBeTruthy();
    expect(screen.getAllByText("1 phòng")).toHaveLength(2);
    const courtRow=screen.getByText("SKU: BADMINTON").closest("tr")!;
    expect(within(courtRow).getByText("giờ")).toBeTruthy();
    expect(within(courtRow).queryByText("16 giờ")).toBeNull();
    fireEvent.change(screen.getByLabelText("Từ thời điểm"),{target:{value:"2035-01-10T12:00"}});
    fireEvent.change(screen.getByLabelText("Đến thời điểm"),{target:{value:"2035-01-10T13:00"}});
    expect(await screen.findByText("0 sân")).toBeTruthy();
    expect(serviceAvailabilityApi.list).toHaveBeenLastCalledWith("2035-01-10T12:00","2035-01-10T13:00");
    fireEvent.click(screen.getByRole("button",{name:"Kho"}));
    const stockRow=screen.getByText("SKU: HHGLASS").closest("tr")!;
    expect(within(stockRow).getByText("25.000")).toBeTruthy();
    expect(within(stockRow).getByText("cái")).toBeTruthy();
    expect(screen.queryByLabelText("Từ thời điểm")).toBeNull();
  });

  it("does not show stale or fake zero availability when the schedule request fails", async()=>{
    vi.mocked(serviceAvailabilityApi.list).mockRejectedValue(new Error("Lỗi tải lịch"));
    render(<KitchenInventory onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button",{name:"Dịch vụ"}));
    await screen.findByRole("alert");
    expect((await screen.findAllByText("Chưa tải được lịch")).length).toBeGreaterThan(0);
    expect(screen.queryByText("0 suất")).toBeNull();
  });

  it("opens stock activity from the header bell, dismisses it and opens the full history", async () => {
    vi.mocked(kitchenAccountingApi.inventoryMovements).mockImplementation(async id=>id==="MAMREST" ? [{
      id:909, service_id:"MAMREST", type:"RECEIVE", quantity:4, actor_id:"KITCHEN", occurred_at:new Date().toISOString(), reason:"Nhập kiểm thử thông báo",
    }] : []);
    render(<KitchenInventory onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name:"Dịch vụ" }));
    await screen.findByText("SKU: MAMREST");
    expect(screen.queryByText("Biến động tồn kho gần đây")).toBeNull();
    const bell=screen.getByRole("button", { name:"Thông báo biến động kho" });
    fireEvent.click(bell);
    expect(await screen.findByRole("dialog", { name:"Thông báo biến động kho" })).toBeTruthy();
    expect(await screen.findByText("+4")).toBeTruthy();
    expect(bell.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(document, { key:"Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(bell);
    fireEvent.click(bell);
    fireEvent.pointerDown(screen.getByRole("heading", { name:"Danh mục dịch vụ" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(bell);
    fireEvent.click(screen.getByRole("button", { name:"Xem tất cả biến động" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByText("Nhập kiểm thử thông báo")).toBeTruthy();
    expect(screen.queryByRole("button",{name:"Tạo phiếu nhập"})).toBeNull();
    expect(screen.queryByRole("button",{name:"Tạo phiếu xuất"})).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Xuất phiếu"}));
    expect(screen.getByRole("dialog",{name:"Xuất phiếu biến động kho"})).toBeTruthy();
    expect(screen.getByRole("button",{name:/Xuất tất cả biến động/})).toBeTruthy();
    expect(screen.getByRole("button",{name:/Xuất riêng từng biến động/})).toBeTruthy();
  });

  it("records stock intake from the inventory screen with an auditable reason", async () => {
    render(<KitchenInventory onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name:"Dịch vụ" }));
    expect(await screen.findByText("SKU: MAMREST")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name:"Điều chỉnh" })[0]);
    expect(await screen.findByRole("dialog", { name:"Ghi nhận phiếu kho và dịch vụ" })).toBeTruthy();
    fireEvent.change(screen.getByRole("spinbutton"), { target:{ value:"4" } });
    fireEvent.change(screen.getByPlaceholderText("Ví dụ: Cấp cho buồng phòng – phòng 502"), { target:{ value:"Nhập thử cho kho bếp" } });
    fireEvent.click(screen.getByRole("button", { name:"Lưu phiếu" }));
    await waitFor(() => expect(kitchenAccountingApi.recordInventoryMovement).toHaveBeenCalledWith(
      { service_id:"MAMREST", type:"RECEIVE", quantity:4, reason:"Nhập thử cho kho bếp" }, expect.any(String)));
    expect((await screen.findByRole("status")).textContent).toContain("đã được ghi nhận");
  });

  it("only offers receiving, issuing and wastage, and asks for a room only for issuing", async () => {
    render(<KitchenInventory onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name:"Dịch vụ" }));
    await screen.findByText("SKU: MAMREST");
    fireEvent.click(screen.getAllByRole("button", { name:"Điều chỉnh" })[0]);
    expect(screen.queryByLabelText("Chọn phòng nhận (tùy chọn)")).toBeNull();
    expect(screen.queryByRole("option", { name:"Trả lại kho" })).toBeNull();
    expect(screen.queryByRole("option", { name:/Điều chỉnh kiểm kê/ })).toBeNull();
    expect(screen.getByRole("option", { name:"Hao hụt" })).toBeTruthy();
    const type=screen.getByLabelText("Loại phiếu");
    fireEvent.change(type,{target:{value:"ISSUE"}});
    fireEvent.change(screen.getByLabelText("Chọn phòng nhận (tùy chọn)"),{target:{value:"502"}});
    fireEvent.change(type,{target:{value:"WASTE"}});
    expect(screen.queryByLabelText("Chọn phòng nhận (tùy chọn)")).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("Ví dụ: Cấp cho buồng phòng – phòng 502"),{target:{value:"Hàng hỏng"}});
    fireEvent.click(screen.getByRole("button", { name:"Lưu phiếu" }));
    await waitFor(()=>expect(kitchenAccountingApi.recordInventoryMovement).toHaveBeenCalledWith(
      {service_id:"MAMREST",type:"WASTE",quantity:1,reason:"Hàng hỏng"},expect.any(String)));
  });

  it("creates price requests for a selected backend service, not free-form labels", async () => {
    render(<KitchenInventory onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name:"Dịch vụ" }));
    expect(await screen.findByText("SKU: MAMREST")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name:"Đề xuất" }));
    fireEvent.click(screen.getByRole("button", { name:"Tạo yêu cầu" }));
    fireEvent.click(screen.getByRole("button", { name:"Tiếp tục" }));
    fireEvent.change(screen.getByRole("spinbutton"), { target:{ value:"300000" } });
    fireEvent.change(screen.getByPlaceholderText("Nêu rõ lý do thay đổi"), { target:{ value:"Giá đầu vào thay đổi" } });
    fireEvent.click(screen.getByRole("button", { name:"Gửi quản lý phê duyệt" }));
    await waitFor(() => expect(kitchenAccountingApi.submitPrice).toHaveBeenCalledWith(
      "MAMREST", { price:300000, reason:"Giá đầu vào thay đổi" }, expect.any(String)));
  });

  it("opens the catalog proposal popup without a product choice and submits warehouse details", async () => {
    vi.spyOn(catalogProposalsApi,"submit").mockResolvedValue({id:910} as never);
    render(<KitchenInventory onBack={vi.fn()}/>);
    fireEvent.click(screen.getByRole("button",{name:"Dịch vụ"}));
    await screen.findByText("SKU: MAMREST");
    fireEvent.click(screen.getByRole("button",{name:"Đề xuất"}));
    expect(screen.queryByPlaceholderText("Nêu rõ lý do thay đổi")).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Tạo yêu cầu"}));
    fireEvent.click(screen.getByRole("button",{name:/Đề xuất thêm danh mục/}));
    fireEvent.click(screen.getByRole("button",{name:"Tiếp tục"}));
    const dialog=screen.getByRole("dialog");
    expect(within(dialog).queryByRole("button",{name:"Sản phẩm"})).toBeNull();
    fireEvent.click(within(dialog).getByRole("button",{name:"Danh mục kho"}));
    fireEvent.change(within(dialog).getByLabelText("Tên mặt hàng"),{target:{value:"Khăn mới"}});
    fireEvent.change(within(dialog).getByLabelText("Mã danh mục (SKU)"),{target:{value:"TOWELNEW"}});
    fireEvent.change(within(dialog).getByLabelText("Phân loại"),{target:{value:"room-amenity"}});
    fireEvent.change(within(dialog).getByRole("spinbutton"),{target:{value:"50000"}});
    fireEvent.change(within(dialog).getByPlaceholderText("Nêu rõ lý do cần thêm mới"),{target:{value:"Bổ sung đồ dùng"}});
    fireEvent.click(within(dialog).getByRole("button",{name:"Gửi quản lý phê duyệt"}));
    await waitFor(()=>expect(catalogProposalsApi.submit).toHaveBeenCalledWith({kind:"WAREHOUSE",id:"TOWELNEW",name:"Khăn mới",unit:"cái",category:"room-amenity",price:50000,reason:"Bổ sung đồ dùng"},expect.any(String)));
    await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("shows pending additions before the SKU exists and supports zero-price proposals", async () => {
    vi.mocked(catalogProposalsApi.list).mockResolvedValue([{id:911,requester:"KITCHEN",action:"SERVICE_CATALOG_CREATE",target_id:"NEWTOWEL",payload:JSON.stringify({kind:"WAREHOUSE",id:"NEWTOWEL",name:"Khăn mới miễn phí",price:0}),amount:0,reason:"Bổ sung",status:"PENDING",requested_at:new Date().toISOString()} as never]);
    render(<KitchenInventory onBack={vi.fn()}/>);
    fireEvent.click(screen.getByRole("button",{name:"Đề xuất"}));
    expect(await screen.findByText("Khăn mới miễn phí")).toBeTruthy();
    expect(screen.getByText("Thêm mới")).toBeTruthy();
    expect(screen.queryByText(/Infinity|NaN/)).toBeNull();
  });

  it("filters by actual backend categories and handles the out-of-stock status", async () => {
    render(<KitchenInventory onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name:"Dịch vụ" }));
    expect(await screen.findByText("SKU: MAMREST")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name:"Nhà hàng" }));
    expect(screen.getByText("SKU: MAMREST")).toBeTruthy();
    expect(screen.queryByText("SKU: SPAMASS")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name:"Spa" }));
    expect(screen.getByText("SKU: SPAMASS")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name:"Tất cả" }));
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
    fireEvent.click(screen.getByRole("button", { name:"Đề xuất" }));
    expect(await screen.findByText("Yêu cầu định dạng số thuần")).toBeTruthy();
    expect(screen.getByText("251.000")).toBeTruthy();
    expect(screen.getByText("Dữ liệu lịch sử")).toBeTruthy();
    expect(screen.getByText("1.100.000")).toBeTruthy();
  });

  it("opens result modal and allows activating approved price proposals", async () => {
    vi.spyOn(kitchenAccountingApi, "activatePrice").mockResolvedValue(service);
    vi.mocked(kitchenAccountingApi.priceRequests).mockResolvedValue([
      {
        id:905, requester:"KITCHEN", action:"SERVICE_PRICE_CHANGE", target_id:"MAMREST", payload:"320000",
        amount:320000, reason:"Đã duyệt tăng giá", risk:"MEDIUM", status:"APPROVED", approver:"Quản lý Demo",
        decided_at:new Date().toISOString(), expires_at:null, consumed_at:null, requested_at:new Date().toISOString(), idempotency_key:"appr-1",
      },
    ]);
    render(<KitchenInventory onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name:"Đề xuất" }));
    expect(await screen.findByText("Đã duyệt tăng giá")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name:"Xem kết quả" }));
    expect(await screen.findByText("Tiến trình & Kết quả đề xuất")).toBeTruthy();
    expect(screen.getByText("Quản lý Demo")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name:"Kích hoạt giá ngay" }));
    await waitFor(() => expect(kitchenAccountingApi.activatePrice).toHaveBeenCalledWith(
      "MAMREST", { price:320000, reason:"Đã duyệt tăng giá" }, expect.any(String)));
    expect(await screen.findByText("Kích hoạt giá thành công! Dịch vụ đã cập nhật mức giá mới.")).toBeTruthy();
  });
});

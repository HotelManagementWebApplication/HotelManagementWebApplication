import KitchenInventory from "./KitchenInventory";
import * as voucher from "./KitchenInventory";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { kitchenAccountingApi, serviceAvailabilityApi, catalogProposalsApi, serviceConsumptionApi, type ServiceConsumption, serviceScheduleApi, stockReturnsApi, type StockReturn } from "../../shared/api/kitchenAccounting";
import { authApi } from "../../shared/api/auth";
import { ConsumptionReports, buildConsumptionReport, consumptionCsv, type ReportItem, type ReportMovement, ServiceCoordination, ServiceScheduleDialog, StockNotifications, type StockActivity, StockVoucherDialog, StockReturnsPanel } from "./KitchenInventory";

describe("KitchenInventory.test.tsx",()=>{
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
});

describe("ConsumptionReports.test.tsx",()=>{
const items:ReportItem[]=[
  {id:"SPA",name:"Massage",category:"spa",categoryLabel:"Spa",unit:"suất",price:100000,stock:20,reorder:3,isStock:false},
  {id:"ROOMMEAL",name:"Ăn tại phòng",category:"inroom",categoryLabel:"Dịch vụ tại phòng",unit:"suất",price:200000,stock:20,reorder:3,isStock:false},
  {id:"WATER",name:"Nước suối (chai nhỏ)",category:"beverage",categoryLabel:"Thức uống",unit:"chai",price:10000,stock:12,reorder:8,isStock:true},
];
const movements:ReportMovement[]=[
  {id:"1",serviceId:"SPA",movementType:"ISSUE",qty:-2,occurredAt:"2035-01-09T08:00:00"},
  {id:"2",serviceId:"ROOMMEAL",movementType:"ISSUE",qty:-3,occurredAt:"2035-01-15T23:59:59"},
  {id:"3",serviceId:"WATER",movementType:"ISSUE",qty:-5,occurredAt:"2035-01-10T09:00:00",stockBefore:13,stockAfter:8},
  {id:"4",serviceId:"WATER",movementType:"RECEIVE",qty:4,occurredAt:"2035-01-16T09:00:00",stockBefore:8,stockAfter:12},
  {id:"5",serviceId:"WATER",movementType:"WASTE",qty:-1,occurredAt:"2035-01-10T08:00:00",stockBefore:14,stockAfter:13},
  {id:"6",serviceId:"SPA",movementType:"ISSUE",qty:-10,occurredAt:"2035-01-08T23:59:59"},
  {id:"7",serviceId:"SPA",movementType:"ISSUE",qty:-10,occurredAt:"2035-01-16T00:00:00"},
];

const usages:ServiceConsumption[]=movements.filter(row=>row.serviceId!=="WATER").map(row=>({
  id:`BOOKING:${row.id}`,service_id:row.serviceId,occurred_at:row.occurredAt,quantity:Math.abs(row.qty),
  free_quantity:0,unit_price:items.find(item=>item.id===row.serviceId)!.price,
  amount_due:Math.abs(row.qty)*items.find(item=>item.id===row.serviceId)!.price,
}));

describe("Consumption reports",()=>{
  beforeEach(()=>{vi.restoreAllMocks();vi.spyOn(serviceConsumptionApi,"list").mockImplementation(async(from,to)=>usages.filter(row=>row.occurred_at.slice(0,10)>=from&&row.occurred_at.slice(0,10)<=to));});
  it("uses inclusive custom dates for chart values, services, exports and historical stock",()=>{
    const report=buildConsumptionReport(items,movements,"2035-01-15",usages,"2035-01-10");
    expect(report.days).toHaveLength(6);expect(report.start).toBe("2035-01-10");expect(report.end).toBe("2035-01-15");
    expect(report.serviceAmount).toBe(600000);expect(report.services).toHaveLength(1);
    expect(report.stock[0].quantity).toBe(5);expect(report.stock[0].endingStock).toBe(8);
    expect(consumptionCsv(report.stock,"stock",report.start,report.end)).toContain('"2035-01-10","2035-01-15"');
    const single=buildConsumptionReport(items,movements,"2035-01-15",usages,"2035-01-15");
    expect(single.days).toHaveLength(1);expect(single.serviceAmount).toBe(600000);expect(single.stock).toHaveLength(0);
  });
  it("reads longer date ranges through disjoint API windows without changing the server contract",async()=>{
    render(<ConsumptionReports items={items} transactions={movements}/>);
    fireEvent.change(screen.getByLabelText("Từ ngày báo cáo"),{target:{value:"2035-01-01"}});
    fireEvent.change(screen.getByLabelText("Đến ngày báo cáo"),{target:{value:"2035-02-15"}});
    await waitFor(()=>expect(serviceConsumptionApi.list).toHaveBeenCalledWith("2035-02-01","2035-02-15"));
    expect(serviceConsumptionApi.list).toHaveBeenCalledWith("2035-01-01","2035-01-31");
    expect(screen.getByRole("img",{name:"Xu hướng giá trị tiêu thụ 46 ngày"})).toBeTruthy();
    fireEvent.click(screen.getByRole("tab",{name:"Dịch vụ"}));
    await within(screen.getByRole("tabpanel")).findByText("Massage");
    expect(screen.queryByText(/NaN|Infinity/)).toBeNull();
  });
  it("rejects a reversed date range and disables exporting stale report data",async()=>{
    render(<ConsumptionReports items={items} transactions={movements}/>);
    await waitFor(()=>expect(screen.queryByRole("status")).toBeNull());
    vi.mocked(serviceConsumptionApi.list).mockClear();
    fireEvent.change(screen.getByLabelText("Từ ngày báo cáo"),{target:{value:"2099-01-01"}});
    expect((await screen.findByRole("alert")).textContent).toContain("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc");
    expect((screen.getByRole("button",{name:"Xuất báo cáo"}) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("tabpanel")).toBeNull();expect(serviceConsumptionApi.list).not.toHaveBeenCalled();
  });
  it("keeps the same seven-day scope across both series, category shares and detail tabs",()=>{
    const report=buildConsumptionReport(items,movements,"2035-01-15",usages);
    expect(report.start).toBe("2035-01-09");expect(report.days).toHaveLength(7);
    expect(report.serviceAmount).toBe(800000);
    expect(report.groups.map(row=>[row.category,row.percent])).toEqual([["inroom",75],["spa",25]]);
    expect(report.stockGroups.map(row=>[row.category,row.amount,row.percent])).toEqual([["beverage",50000,100]]);
    expect(report.stock[0].item.id).toBe("WATER");expect(report.stock[0].quantity).toBe(5);expect(report.stock[0].amount).toBe(50000);
    expect(report.stock[0].endingStock).toBe(8);
    expect(report.days[0].services).toBe(200000);expect(report.days[6].services).toBe(600000);
    expect(report.days.reduce((sum,day)=>sum+day.stock,0)).toBe(50000);
  });
  it("uses the last movement on the selected date and does not substitute current stock into old reports",()=>{
    const sameTime=[...movements,{id:"8",serviceId:"WATER",movementType:"RETURN" as const,qty:1,occurredAt:"2035-01-10T09:00:00",stockBefore:8,stockAfter:9}];
    expect(buildConsumptionReport(items,sameTime,"2035-01-15",usages).stock[0].endingStock).toBe(9);
    const unknown=movements.map(row=>({...row,stockBefore:undefined,stockAfter:undefined}));
    expect(buildConsumptionReport(items,unknown,"2035-01-15",usages).stock[0].endingStock).toBeNull();
  });
  it("counts resource usage without an issue and does not count consumable issues twice",()=>{
    const actual=[{...usages[0],quantity:3,free_quantity:1,unit_price:90000,amount_due:180000}];
    const report=buildConsumptionReport(items,movements,"2035-01-15",actual);
    expect(report.services).toHaveLength(1);
    expect(report.services[0].quantity).toBe(3);
    expect(report.serviceAmount).toBe(180000);
    expect(report.services[0].item.price).toBe(100000);
    const noIssues=buildConsumptionReport(items,[],"2035-01-15",actual);
    expect(noIssues.serviceAmount).toBe(180000);
  });
  it("exports the selected tab with matching dates, quantities and safe CSV cells",()=>{
    const report=buildConsumptionReport([{...items[2],name:'=HYPERLINK("unsafe")'}],movements,"2035-01-15",usages);
    const csv=consumptionCsv(report.stock,"stock",report.start,report.end);
    expect(csv).toContain('"2035-01-09","2035-01-15","WATER"');
    expect(csv).toContain('"\'=HYPERLINK(""unsafe"")"');
    expect(csv).toContain('"chai","5","10000","50000","8"');
    expect(csv).not.toContain("SPA");
  });
  it("switches detail tabs, uses historical ending stock and clears stale rows when the period changes",async()=>{
    render(<ConsumptionReports items={items} transactions={movements}/>);
    fireEvent.change(screen.getByLabelText("Từ ngày báo cáo"),{target:{value:"2035-01-09"}});
    fireEvent.change(screen.getByLabelText("Đến ngày báo cáo"),{target:{value:"2035-01-15"}});
    const panel=screen.getByRole("tabpanel");
    const stockGroups=screen.getByRole("region",{name:"Giá trị xuất kho theo nhóm hàng"});
    expect(within(stockGroups).getByRole("progressbar",{name:"Thức uống"}).getAttribute("aria-valuenow")).toBe("100");
    expect(within(stockGroups).queryByText("Spa")).toBeNull();
    expect(within(panel).getByText("Nước suối (chai nhỏ)")).toBeTruthy();
    expect(within(panel).getByText("8").className).toContain("low-stock");
    expect(within(panel).queryByText("Massage")).toBeNull();
    fireEvent.click(screen.getByRole("tab",{name:"Dịch vụ"}));
    expect(await within(panel).findByText("Massage")).toBeTruthy();
    const serviceGroups=screen.getByRole("region",{name:"Tiêu thụ theo nhóm dịch vụ"});
    expect(within(serviceGroups).getByRole("progressbar",{name:"Spa"}).getAttribute("aria-valuenow")).toBe("25");
    expect(within(serviceGroups).queryByText("Thức uống")).toBeNull();
    expect(within(panel).queryByText("Tồn cuối")).toBeNull();
    expect(within(panel).queryByText("Nước suối (chai nhỏ)")).toBeNull();
    await act(async()=>{fireEvent.change(screen.getByLabelText("Từ ngày báo cáo"),{target:{value:"2035-01-26"}});fireEvent.change(screen.getByLabelText("Đến ngày báo cáo"),{target:{value:"2035-02-01"}});});
    expect(await within(screen.getByRole("tabpanel")).findByText("Chưa có dịch vụ sử dụng trong kỳ đã chọn.")).toBeTruthy();
    expect(screen.queryByText(/NaN|Infinity/)).toBeNull();
  });
});
});

describe("ServiceCoordination.test.tsx",()=>{
it("filters non-restaurant services by group and room, and labels USED correctly", () => {
  const base={reservation_id:1,scheduled_at:"2035-01-10T08:00:00",quantity:1,free_quantity:0,unit_price:150000,amount_due:150000,meal_period:null,note:null};
  const props={bookings:[{...base,id:1,room_id:"501",service_id:"COURT",service_name:"Cầu lông",status:"CONFIRMED"},{...base,id:2,room_id:"502",service_id:"SPA",service_name:"Massage",status:"USED"}],items:[{id:"COURT",category:"Giải trí",unit:"giờ"},{id:"SPA",category:"Spa",unit:"lượt"}],date:"2035-01-10",loading:false,error:null,busyId:null,searchQuery:"",onDateChange:vi.fn(),onRefresh:vi.fn(),onMarkUsed:vi.fn()};
  const view=render(<ServiceCoordination {...props}/>);
  expect(screen.getByText("Massage")).toBeTruthy();
  expect(screen.queryByText("Đang sử dụng")).toBeNull();
  fireEvent.change(screen.getByRole("combobox",{name:"Nhóm dịch vụ"}),{target:{value:"Spa"}});
  expect(screen.getByText("Massage")).toBeTruthy();
  expect(screen.queryByText("Cầu lông")).toBeNull();
  view.rerender(<ServiceCoordination {...props} searchQuery="501"/>);
  expect(screen.queryByText("Massage")).toBeNull();
  fireEvent.change(screen.getByRole("combobox",{name:"Nhóm dịch vụ"}),{target:{value:""}});
  expect(screen.getByText("Cầu lông")).toBeTruthy();
});
});

describe("ServiceScheduleDialog.test.tsx",()=>{
afterEach(()=>vi.restoreAllMocks());
it("loads actual database settings and saves capacity without treating stock as the number of resources",async()=>{
  vi.spyOn(serviceScheduleApi,"get").mockResolvedValue({service_id:"REALROOM",capacity:2,unit:"phòng",minutes_per_unit:1440,mode:"DURATION",consumes_stock:false});
  const save=vi.spyOn(serviceScheduleApi,"save").mockResolvedValue({service_id:"REALROOM",capacity:3,unit:"phòng",minutes_per_unit:1440,mode:"DURATION",consumes_stock:false});
  const saved=vi.fn();const close=vi.fn();
  render(<ServiceScheduleDialog item={{id:"REALROOM",name:"Phòng họp thực tế"}} onClose={close} onSaved={saved}/>);
  await waitFor(()=>expect((screen.getByLabelText("Số lượng phục vụ tối đa") as HTMLInputElement).value).toBe("2"));
  expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  fireEvent.change(screen.getByLabelText("Số lượng phục vụ tối đa"),{target:{value:"3"}});
  fireEvent.change(screen.getByLabelText("Lý do thay đổi"),{target:{value:"Bổ sung phòng họp"}});
  fireEvent.click(screen.getByRole("button",{name:"Lưu cấu hình"}));
  await waitFor(()=>expect(save).toHaveBeenCalledWith("REALROOM",{capacity:3,unit:"phòng",minutes_per_unit:1440,mode:"DURATION",consumes_stock:false,reason:"Bổ sung phòng họp"}));
  expect(saved).toHaveBeenCalledOnce();expect(close).toHaveBeenCalledOnce();
});
});

describe("StockNotifications.test.tsx",()=>{
const usage:StockActivity[]=[
  {id:"1",name:"Nước suối",sku:"WATER",occurredAt:"2035-01-10T13:04:00",qty:20,staff:"KITCHEN",movementType:"RECEIVE"},
  {id:"2",name:"Khăn tắm",sku:"TOWEL",occurredAt:"2035-01-10T14:04:00",qty:-2,staff:"KITCHEN",movementType:"ISSUE"},
  {id:"3",name:"Bánh quy",sku:"COOKIE",occurredAt:"2035-01-09T10:00:00",qty:-1,staff:"KITCHEN",movementType:"WASTE"},
  {id:"4",name:"Khăn tay",sku:"HANDTOWEL",occurredAt:"2035-01-08T10:00:00",qty:3,staff:"KITCHEN",movementType:"RETURN"},
  {id:"5",name:"Ly thủy tinh",sku:"GLASS",occurredAt:"2035-01-08T09:00:00",qty:-1,staff:"KITCHEN",movementType:"ADJUST"},
];

describe("Stock notifications",()=>{
  it("groups real movements by day and filters each movement without losing return or adjustment entries",()=>{
    render(<StockNotifications usage={usage} onSeeAll={vi.fn()}/>);
    fireEvent.click(screen.getByRole("button",{name:"Thông báo biến động kho"}));
    const dialog=screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("article")).toHaveLength(5);
    expect(within(dialog).getAllByRole("heading",{level:3})).toHaveLength(3);
    expect(within(dialog).getAllByRole("article")[0].textContent).toContain("Khăn tắm");
    expect(within(dialog).getByText("+20")).toBeTruthy();
    const filters=within(dialog).getByRole("group",{name:"Lọc loại biến động"});
    fireEvent.click(within(filters).getByRole("button",{name:"Xuất 1"}));
    expect(within(dialog).getAllByRole("article")).toHaveLength(1);
    expect(within(dialog).getByText("TOWEL")).toBeTruthy();
    expect(within(dialog).queryByText("WATER")).toBeNull();
    fireEvent.click(within(filters).getByRole("button",{name:"Trả kho 1"}));
    expect(within(dialog).getByText("Trả lại kho")).toBeTruthy();
    fireEvent.click(within(filters).getByRole("button",{name:"Điều chỉnh 1"}));
    expect(within(dialog).getByText("GLASS")).toBeTruthy();
    fireEvent.click(within(filters).getByRole("button",{name:"Tất cả 5"}));
    expect(within(dialog).getAllByRole("article")).toHaveLength(5);
  });
  it("shows an empty filter and leaves the full-history action available",()=>{
    const onSeeAll=vi.fn();
    render(<StockNotifications usage={[usage[0]]} onSeeAll={onSeeAll}/>);
    const bell=screen.getByRole("button",{name:"Thông báo biến động kho"});
    fireEvent.click(bell);
    fireEvent.click(screen.getByRole("button",{name:"Hao hụt 0"}));
    expect(screen.getByText("Chưa có biến động thuộc loại này.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"Xem tất cả biến động"}));
    expect(onSeeAll).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(bell);
  });
});
});

describe("StockVoucherDialog.test.tsx",()=>{
const movements:voucher.VoucherMovement[]=[
  {id:"31",serviceId:"WATER",itemName:"Nước suối",unit:"chai",unitPrice:12000,movementType:"RECEIVE",qty:5,occurredAt:"2026-10-15T08:00:00",staffName:"Nguyễn Văn Nhập",stockBefore:10,stockAfter:15,note:"Nhập hàng"},
  {id:"32",serviceId:"TOWEL",itemName:"Khăn tắm",unit:"cái",unitPrice:50000,movementType:"ISSUE",qty:-2,occurredAt:"2026-10-15T09:00:00",staffName:"Trần Thị Xuất",stockBefore:8,stockAfter:6,note:"Cấp cho buồng phòng"},
];
describe("Stock voucher export",()=>{
  beforeEach(()=>vi.restoreAllMocks());
  afterEach(()=>{
    const frame=document.getElementById("stock-voucher-print-frame") as HTMLIFrameElement|null;
    if(frame){frame.onload=null;frame.remove();}
  });
  it("exports only the chosen movement using its performer, not the currently logged-in employee",()=>{
    document.getElementById("stock-voucher-print-frame")?.remove();
    render(<StockVoucherDialog movements={movements} onClose={vi.fn()}/>);
    expect(screen.queryByRole("combobox")).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Tiếp tục"}));
    fireEvent.change(screen.getByLabelText("Chọn biến động"),{target:{value:"32"}});
    expect((screen.getByLabelText("Người xuất / Giao") as HTMLInputElement).value).toBe("Trần Thị Xuất");
    expect((screen.getByLabelText("Người xuất / Giao") as HTMLInputElement).readOnly).toBe(true);
    fireEvent.change(screen.getByLabelText("Người nhập / Nhận"),{target:{value:"Lê Thị Nhận"}});
    fireEvent.click(screen.getByRole("button",{name:"In / Lưu PDF"}));
    const printed=(document.getElementById("stock-voucher-print-frame") as HTMLIFrameElement).srcdoc;
    expect(printed).toContain("Trần Thị Xuất");expect(printed).toContain("Lê Thị Nhận");expect(printed).not.toContain("Nguyễn Văn Nhập");
    const preview=document.querySelector(".ki-voucher-preview") as HTMLElement;
    expect(within(preview).getByText("PHIẾU BIẾN ĐỘNG KHO")).toBeTruthy();
    expect(preview.textContent).toContain("Kho và Dịch vụ");
    expect(preview.textContent).not.toContain("Mã biểu mẫu");
  });
  it("exports all filtered movements and preserves separate handover names per voucher",()=>{
    document.getElementById("stock-voucher-print-frame")?.remove();
    render(<StockVoucherDialog movements={movements} onClose={vi.fn()}/>);
    fireEvent.click(screen.getByRole("button",{name:/Xuất tất cả biến động/}));
    fireEvent.click(screen.getByRole("button",{name:"Tiếp tục"}));
    fireEvent.change(screen.getByLabelText("Người xuất / Giao"),{target:{value:"Nhà cung cấp A"}});
    fireEvent.change(screen.getByRole("combobox"),{target:{value:"32"}});
    fireEvent.change(screen.getByLabelText("Người nhập / Nhận"),{target:{value:"Buồng phòng B"}});
    fireEvent.change(screen.getByRole("combobox"),{target:{value:"31"}});
    expect((screen.getByLabelText("Người xuất / Giao") as HTMLInputElement).value).toBe("Nhà cung cấp A");
    fireEvent.click(screen.getByRole("button",{name:"In / Lưu PDF 2 phiếu"}));
    const printed=(document.getElementById("stock-voucher-print-frame") as HTMLIFrameElement).srcdoc;
    for(const name of ["Nguyễn Văn Nhập","Nhà cung cấp A","Trần Thị Xuất","Buồng phòng B"])expect(printed).toContain(name);
    expect((printed.match(/<article/g)??[]).length).toBe(2);
  });
  it("escapes printable names and reasons while leaving handwritten signature space",()=>{
    const record={...movements[0],staffName:"<img src=x onerror=alert(1)>",note:"<script>alert(1)</script>"};
    const html=voucher.voucherBody(record,voucher.defaultVoucherDetails(record));
    expect(html).not.toContain("<script>");expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");expect(html).toContain("Ký, ghi rõ họ tên");
    expect(html).toContain("Tồn trước");expect(html).toContain("Tồn sau");
  });
});
});

describe("StockReturnsPanel.test.tsx",()=>{
const pending:StockReturn={id:1,service_id:"HHGLASS",service_name:"Ly thủy tinh",unit:"cái",quantity:2,room_id:"502",requester:"HOUSEKEEP",reason:"Còn nguyên",status:"PENDING",approver:null,decision_reason:null,requested_at:"2026-10-15T10:00:00",decided_at:null};
describe("Stock return request and approval",()=>{
  beforeEach(()=>{
    vi.restoreAllMocks();vi.spyOn(stockReturnsApi,"list").mockResolvedValue([]);
    vi.spyOn(stockReturnsApi,"catalog").mockResolvedValue([{id:"HHGLASS",name:"Ly thủy tinh",unit:"cái",price:25000,stock:20,safety_threshold:5,category:"room-amenity",active:false,low_stock:false}]);
    vi.spyOn(stockReturnsApi,"create").mockResolvedValue(pending);
    vi.spyOn(stockReturnsApi,"decide").mockResolvedValue({...pending,status:"APPROVED",approver:"KITCHEN"});
  });
  it("submits a request and presents it as pending without claiming stock increased",async()=>{
    render(<StockReturnsPanel/>);await screen.findByRole("option",{name:/Ly thủy tinh/});
    fireEvent.change(screen.getByLabelText("Số lượng trả"),{target:{value:"2"}});
    fireEvent.change(screen.getByLabelText("Phòng trả (tùy chọn)"),{target:{value:"502"}});
    fireEvent.change(screen.getByLabelText("Lý do trả hàng"),{target:{value:"Còn nguyên"}});
    fireEvent.click(screen.getByRole("button",{name:"Gửi yêu cầu trả kho"}));
    await screen.findByRole("status");
    expect(stockReturnsApi.create).toHaveBeenCalledWith({service_id:"HHGLASS",quantity:2,room_id:"502",reason:"Còn nguyên"},expect.any(String));
    expect(screen.getByText("Chờ duyệt")).toBeTruthy();
    expect(stockReturnsApi.decide).not.toHaveBeenCalled();
  });
  it("reuses the request key when retrying a failed submit",async()=>{
    vi.mocked(stockReturnsApi.create).mockRejectedValueOnce(new Error("Mất kết nối"));
    render(<StockReturnsPanel/>);await screen.findByRole("option",{name:/Ly thủy tinh/});
    fireEvent.change(screen.getByLabelText("Lý do trả hàng"),{target:{value:"Chưa dùng"}});
    fireEvent.click(screen.getByRole("button",{name:"Gửi yêu cầu trả kho"}));await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button",{name:"Gửi yêu cầu trả kho"}));await screen.findByRole("status");
    expect(vi.mocked(stockReturnsApi.create).mock.calls[0][1]).toBe(vi.mocked(stockReturnsApi.create).mock.calls[1][1]);
  });
  it("lets warehouse confirm counted quantity before approval and refreshes stock",async()=>{
    vi.mocked(stockReturnsApi.list).mockResolvedValue([pending]);const changed=vi.fn();
    render(<StockReturnsPanel warehouse onChanged={changed}/>);
    fireEvent.click(await screen.findByRole("button",{name:"Duyệt nhập lại kho"}));
    const dialog=screen.getByRole("dialog",{name:"Duyệt nhập lại kho"});
    fireEvent.change(within(dialog).getByRole("textbox"),{target:{value:"Đã đếm đủ"}});
    fireEvent.click(within(dialog).getByRole("button",{name:"Xác nhận duyệt"}));
    await waitFor(()=>expect(stockReturnsApi.decide).toHaveBeenCalledWith(1,true,"Đã đếm đủ"));
    await screen.findByRole("status");expect(changed).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button",{name:"Duyệt nhập lại kho"})).toBeNull();
  });
  it("requires a rejection reason and leaves the item unapproved",async()=>{
    vi.mocked(stockReturnsApi.list).mockResolvedValue([pending]);
    vi.mocked(stockReturnsApi.decide).mockResolvedValue({...pending,status:"REJECTED",approver:"KITCHEN",decision_reason:"Đã hỏng"});
    render(<StockReturnsPanel warehouse/>);
    fireEvent.click(await screen.findByRole("button",{name:"Từ chối"}));
    const dialog=screen.getByRole("dialog",{name:"Từ chối trả kho"});const note=within(dialog).getByRole("textbox") as HTMLTextAreaElement;
    expect(note.required).toBe(true);fireEvent.change(note,{target:{value:"Đã hỏng"}});
    fireEvent.click(within(dialog).getByRole("button",{name:"Xác nhận từ chối"}));
    await waitFor(()=>expect(stockReturnsApi.decide).toHaveBeenCalledWith(1,false,"Đã hỏng"));
    expect((await screen.findByRole("status")).textContent).toContain("tồn kho không thay đổi");
  });
});
});

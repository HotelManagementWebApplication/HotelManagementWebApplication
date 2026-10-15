import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StockReturnsPanel from "./StockReturnsPanel";
import { stockReturnsApi, type StockReturn } from "../../shared/api/stockReturns";

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

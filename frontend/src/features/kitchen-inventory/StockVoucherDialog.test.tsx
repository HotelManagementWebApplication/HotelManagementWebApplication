import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StockVoucherDialog from "./StockVoucherDialog";
import * as voucher from "./stockVoucher";

const movements:voucher.VoucherMovement[]=[
  {id:"31",serviceId:"WATER",itemName:"Nước suối",unit:"chai",unitPrice:12000,movementType:"RECEIVE",qty:5,occurredAt:"2026-10-15T08:00:00",staffName:"Nguyễn Văn Nhập",stockBefore:10,stockAfter:15,note:"Nhập hàng"},
  {id:"32",serviceId:"TOWEL",itemName:"Khăn tắm",unit:"cái",unitPrice:50000,movementType:"ISSUE",qty:-2,occurredAt:"2026-10-15T09:00:00",staffName:"Trần Thị Xuất",stockBefore:8,stockAfter:6,note:"Cấp cho buồng phòng"},
];
describe("Stock voucher export",()=>{
  beforeEach(()=>vi.restoreAllMocks());
  it("exports only the chosen movement using its performer, not the currently logged-in employee",()=>{
    const print=vi.spyOn(voucher,"printStockVouchers").mockImplementation(()=>{});
    render(<StockVoucherDialog movements={movements} onClose={vi.fn()}/>);
    expect(screen.queryByRole("combobox")).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Tiếp tục"}));
    fireEvent.change(screen.getByLabelText("Chọn biến động"),{target:{value:"32"}});
    expect((screen.getByLabelText("Người xuất / Giao") as HTMLInputElement).value).toBe("Trần Thị Xuất");
    expect((screen.getByLabelText("Người xuất / Giao") as HTMLInputElement).readOnly).toBe(true);
    fireEvent.change(screen.getByLabelText("Người nhập / Nhận"),{target:{value:"Lê Thị Nhận"}});
    fireEvent.click(screen.getByRole("button",{name:"In / Lưu PDF"}));
    expect(print).toHaveBeenCalledWith([movements[1]],expect.objectContaining({"32":expect.objectContaining({sender:"Trần Thị Xuất",receiver:"Lê Thị Nhận"})}));
    const preview=document.querySelector(".ki-voucher-preview") as HTMLElement;
    expect(within(preview).getByText("PHIẾU BIẾN ĐỘNG KHO")).toBeTruthy();
    expect(preview.textContent).toContain("Kho và Dịch vụ");
    expect(preview.textContent).not.toContain("Mã biểu mẫu");
  });
  it("exports all filtered movements and preserves separate handover names per voucher",()=>{
    const print=vi.spyOn(voucher,"printStockVouchers").mockImplementation(()=>{});
    render(<StockVoucherDialog movements={movements} onClose={vi.fn()}/>);
    fireEvent.click(screen.getByRole("button",{name:/Xuất tất cả biến động/}));
    fireEvent.click(screen.getByRole("button",{name:"Tiếp tục"}));
    fireEvent.change(screen.getByLabelText("Người xuất / Giao"),{target:{value:"Nhà cung cấp A"}});
    fireEvent.change(screen.getByRole("combobox"),{target:{value:"32"}});
    fireEvent.change(screen.getByLabelText("Người nhập / Nhận"),{target:{value:"Buồng phòng B"}});
    fireEvent.change(screen.getByRole("combobox"),{target:{value:"31"}});
    expect((screen.getByLabelText("Người xuất / Giao") as HTMLInputElement).value).toBe("Nhà cung cấp A");
    fireEvent.click(screen.getByRole("button",{name:"In / Lưu PDF 2 phiếu"}));
    expect(print).toHaveBeenCalledWith(movements,expect.objectContaining({"31":expect.objectContaining({receiver:"Nguyễn Văn Nhập",sender:"Nhà cung cấp A"}),"32":expect.objectContaining({sender:"Trần Thị Xuất",receiver:"Buồng phòng B"})}));
  });
  it("escapes printable names and reasons while leaving handwritten signature space",()=>{
    const record={...movements[0],staffName:"<img src=x onerror=alert(1)>",note:"<script>alert(1)</script>"};
    const html=voucher.voucherBody(record,voucher.defaultVoucherDetails(record));
    expect(html).not.toContain("<script>");expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");expect(html).toContain("Ký, ghi rõ họ tên");
    expect(html).toContain("Tồn trước");expect(html).toContain("Tồn sau");
  });
});

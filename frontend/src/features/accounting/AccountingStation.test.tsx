import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountingStation from "./AccountingStation";
import { kitchenAccountingApi as api } from "../../shared/api/kitchenAccounting";
import { enterpriseApi } from "../../shared/api/enterprise";
import { authApi } from "../../shared/api/auth";
import type { LedgerPayment, PaymentPage } from "../../shared/types/kitchenAccounting";

const payment=(id:number):LedgerPayment=>({id,invoice_id:id,reservation_id:1000+id,service_total:0,amount:100000,method:"CASH",type:"PAYMENT",status:"COMPLETED",reference:`REF-${id}`,occurred_at:"2026-10-09T10:00:00",actor_id:"ACCOUNTING"});
const result=(page:number,total=150,size=10):PaymentPage=>({items:Array.from({length:Math.max(0,Math.min(size,total-page*size))},(_,i)=>payment(page*size+i+1)),page,size,totalElements:total,totalPages:Math.ceil(total/size),methodCounts:{CASH:total}});
const mount=()=>render(<AccountingStation onBack={vi.fn()} />);

describe("Accounting server pagination",()=>{
  beforeEach(()=>{
    vi.restoreAllMocks();
    vi.spyOn(authApi,"employeeProfile").mockResolvedValue({employee_id:"ACCOUNTING",full_name:"Kế toán kiểm thử",role:"ACCOUNTING",permissions:[]});
    vi.spyOn(api,"partnerDebts").mockResolvedValue([]); vi.spyOn(api,"cashHandovers").mockResolvedValue([]);
    vi.spyOn(enterpriseApi,"ota").mockResolvedValue([]); vi.spyOn(enterpriseApi,"vatInvoices").mockResolvedValue([]);
    vi.spyOn(api,"reconciliation").mockResolvedValue({from_date:"2026-10-09",to_date:"2026-10-09",totals_by_method:{CASH:15000000},total_payments:15000000,total_refunds:0,net_total:15000000,recognized_revenue:15000000,outstanding_partner_debt:0,cash_variance:0,completed_transactions:150,pending_bank_transfers:0});
  });
  it("fetches only the selected page, shows records after 100 and keeps whole-day KPIs",async()=>{
    const invoices=vi.spyOn(api,"invoices"),payments=vi.spyOn(api,"payments").mockImplementation(async(q)=>result(q?.page??0));
    mount(); await screen.findByText("Hiển thị 1–10 trên 150 giao dịch");
    expect(payments).toHaveBeenCalledTimes(1); expect(payments).toHaveBeenLastCalledWith(expect.objectContaining({page:0,size:10}));
    expect(invoices).not.toHaveBeenCalled(); expect(screen.getByText("150 giao dịch hoàn tất")).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"Trang 15"})); await screen.findByText("Hiển thị 141–150 trên 150 giao dịch");
    expect(payments).toHaveBeenCalledTimes(2); expect(payments).toHaveBeenLastCalledWith(expect.objectContaining({page:14,size:10}));
    expect(screen.getByText("PAY-150")).toBeTruthy(); expect(screen.getByText("INV-150")).toBeTruthy(); expect(screen.getByText("1150")).toBeTruthy(); expect(screen.queryByText("PAY-1")).toBeNull();
  });
  it("uses the last server page for next/previous disabled state and styles",async()=>{
    vi.spyOn(api,"payments").mockImplementation(async(q)=>result(q?.page??0,25));
    mount(); await screen.findByText("Hiển thị 1–10 trên 25 giao dịch");
    const prev=screen.getByRole("button",{name:"Trang trước"}) as HTMLButtonElement,next=screen.getByRole("button",{name:"Trang sau"}) as HTMLButtonElement;
    expect(prev.disabled).toBe(true); expect(next.disabled).toBe(false); expect(next.style.cursor).toBe("pointer");
    fireEvent.click(screen.getByRole("button",{name:"Trang 3"})); await screen.findByText("Hiển thị 21–25 trên 25 giao dịch");
    expect(next.disabled).toBe(true); expect(next.style.cursor).toBe("not-allowed"); expect(prev.disabled).toBe(false);
    fireEvent.click(prev); await screen.findByText("Hiển thị 11–20 trên 25 giao dịch");
  });
  it("searches and filters on the server and resets the selected page",async()=>{
    const payments=vi.spyOn(api,"payments").mockImplementation(async(q)=>q?.search?{...result(0,1),items:[payment(150)]}:result(q?.page??0));
    mount(); await screen.findByText("Hiển thị 1–10 trên 150 giao dịch");
    fireEvent.click(screen.getByRole("button",{name:"Trang 15"})); await screen.findByText("PAY-150");
    fireEvent.change(screen.getByPlaceholderText("Tìm mã giao dịch, hóa đơn hoặc đặt phòng..."),{target:{value:"PAY-150"}}); await screen.findByText("Hiển thị 1–1 trên 1 giao dịch");
    expect(payments).toHaveBeenLastCalledWith(expect.objectContaining({page:0,size:10,search:"PAY-150"}));
    fireEvent.change(screen.getByRole("combobox",{name:"Phương thức thanh toán"}),{target:{value:"momo"}});
    await waitFor(()=>expect(payments).toHaveBeenLastCalledWith(expect.objectContaining({page:0,method:"MOMO",search:"PAY-150"})));
  });
  it("ignores a late response from an obsolete search",async()=>{
    let finish!: (page:PaymentPage)=>void;
    const payments=vi.spyOn(api,"payments").mockImplementation(async(q)=>q?.search==="slow"?new Promise(resolve=>{finish=resolve;}):q?.search?{...result(0,1),items:[payment(150)]}:result(0));
    mount(); await screen.findByText("Hiển thị 1–10 trên 150 giao dịch");
    const search=screen.getByPlaceholderText("Tìm mã giao dịch, hóa đơn hoặc đặt phòng...");
    fireEvent.change(search,{target:{value:"slow"}}); await waitFor(()=>expect(payments).toHaveBeenLastCalledWith(expect.objectContaining({search:"slow"})));
    fireEvent.change(search,{target:{value:"PAY-150"}}); await screen.findByText("PAY-150");
    await act(async()=>{finish({...result(0,1),items:[payment(9)]});}); expect(screen.getByText("PAY-150")).toBeTruthy(); expect(screen.queryByText("PAY-9")).toBeNull();
  });
  it("shows errors explicitly and retries instead of presenting them as empty data",async()=>{
    const payments=vi.spyOn(api,"payments").mockRejectedValueOnce(new Error("Network failed")).mockResolvedValue(result(0,0));
    mount(); await screen.findByRole("alert"); expect(screen.queryByText("Chưa có giao dịch thanh toán phù hợp trong ngày đã chọn.")).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Tải lại giao dịch"})); await screen.findByText("Hiển thị 0–0 trên 0 giao dịch"); expect(payments).toHaveBeenCalledTimes(2);
  });
  it("rejects a repeated backend page instead of hiding records",async()=>{
    vi.spyOn(api,"payments").mockResolvedValue(result(0)); mount(); await screen.findByText("Hiển thị 1–10 trên 150 giao dịch");
    fireEvent.click(screen.getByRole("button",{name:"Trang 15"})); expect((await screen.findByRole("alert")).textContent).toContain("Máy chủ trả sai trang"); expect(screen.queryByText("PAY-1")).toBeNull();
  });
  it("exports all matching pages only on demand, including records after 100",async()=>{
    const payments=vi.spyOn(api,"payments").mockImplementation(async(q)=>result(q?.page??0,150,q?.size??10));
    let blob!:Blob; vi.spyOn(URL,"createObjectURL").mockImplementation(value=>{blob=value as Blob;return "blob:test";});
    const click=vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(()=>{});
    mount(); await screen.findByText("Hiển thị 1–10 trên 150 giao dịch"); expect(payments).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button",{name:"Xuất giao dịch CSV"})); await waitFor(()=>expect(click).toHaveBeenCalledTimes(1));
    expect(payments).toHaveBeenCalledWith(expect.objectContaining({page:0,size:100})); expect(payments).toHaveBeenCalledWith(expect.objectContaining({page:1,size:100}));
    const csv=await blob.text(); expect(csv).toContain('"PAY-150","INV-150","1150"'); expect(csv.split("\r\n")).toHaveLength(151);
  });
  it("does not download a partial CSV or hide the loaded page when an export page is missing",async()=>{
    vi.spyOn(api,"payments").mockImplementation(async(q)=>q?.size===100 && q.page===1?{...result(1,150,100),items:[]}:result(q?.page??0,150,q?.size??10));
    const download=vi.spyOn(URL,"createObjectURL");
    mount(); await screen.findByText("Hiển thị 1–10 trên 150 giao dịch");
    fireEvent.click(screen.getByRole("button",{name:"Xuất giao dịch CSV"}));
    expect((await screen.findByRole("alert")).textContent).toContain("trả thiếu");
    expect(download).not.toHaveBeenCalled(); expect(screen.getByText("PAY-1")).toBeTruthy();
    expect(screen.getByText("Hiển thị 1–10 trên 150 giao dịch")).toBeTruthy();
  });
});

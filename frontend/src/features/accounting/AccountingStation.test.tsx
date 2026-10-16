import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AccountingStation from "./AccountingStation";
import { kitchenAccountingApi as api } from "../../shared/api/kitchenAccounting";
import { enterpriseApi } from "../../shared/api/enterprise";
import { authApi } from "../../shared/api/auth";
import type { LedgerPayment, PaymentPage } from "../../shared/types/kitchenAccounting";
import FinanceOperations, { CashVoucherDialog, FinancialApprovalQueue } from "./FinanceOperations";
import InvoiceOperations from "./InvoiceOperations";
import { AccountingWorkspace } from "./AccountingWorkspace";
import { businessDateValue, cashVoucherHtml, type CashVoucher } from "./accountingLogic";

const payment=(id:number):LedgerPayment=>({id,invoice_id:id,reservation_id:1000+id,service_total:0,amount:100000,method:"CASH",type:"PAYMENT",status:"COMPLETED",reference:`REF-${id}`,occurred_at:"2026-10-09T10:00:00",actor_id:"ACCOUNTING"});
const result=(page:number,total=150,size=10):PaymentPage=>({items:Array.from({length:Math.max(0,Math.min(size,total-page*size))},(_,i)=>payment(page*size+i+1)),page,size,totalElements:total,totalPages:Math.ceil(total/size),methodCounts:{CASH:total}});
const mount=()=>render(<AccountingStation onBack={vi.fn()} />);

describe("Accounting notifications",()=>{
  beforeEach(()=>{vi.restoreAllMocks();vi.spyOn(api,"financialRequests").mockResolvedValue([]);vi.spyOn(api,"refundRequests").mockResolvedValue([]);});
  const workspace=(onPageChange=vi.fn(),onRefresh=vi.fn())=>render(<AccountingWorkspace page="handover" onPageChange={onPageChange} profile={{employee_id:"ACCOUNTING",full_name:"Kế toán",role:"ACCOUNTING",permissions:[]}} loading={false} search="" onSearchChange={vi.fn()} date="2026-10-16" onDateChange={vi.fn()} onRefresh={onRefresh} onLogout={vi.fn()} metrics={[]} alerts={null}>{null}</AccountingWorkspace>);
  it("shows real approval updates, marks them read and opens the corresponding workspace",async()=>{
    vi.mocked(api.financialRequests).mockResolvedValue([{id:80,target_id:"finance:expense:KA-1",action:"BILLING_ADJUSTMENT",amount:11000000,status:"APPROVED",reason:"Sửa điều hòa",requested_at:"2026-10-16T09:00:00",decided_at:"2026-10-16T10:00:00"}] as never);
    const navigate=vi.fn(),refresh=vi.fn();workspace(navigate,refresh);
    const bell=await screen.findByRole("button",{name:"Thông báo kế toán, 1 chưa đọc"});
    expect(screen.queryByRole("button",{name:"Tải lại dữ liệu kế toán"})).toBeNull();
    fireEvent.click(bell);
    fireEvent.click((await screen.findByText("Sửa điều hòa")).closest("button")!);
    expect(navigate).toHaveBeenCalledWith("debt");expect(refresh).toHaveBeenCalledOnce();
    expect(screen.queryByRole("region",{name:"Danh sách thông báo kế toán"})).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Thông báo kế toán"}));
    fireEvent.click(screen.getByRole("button",{name:"Chưa đọc 0"}));
    await screen.findByText("Bạn đã đọc hết thông báo.");
    fireEvent.keyDown(document,{key:"Escape"});
    expect(screen.queryByRole("region",{name:"Danh sách thông báo kế toán"})).toBeNull();
  });
  it("shows notification load errors and allows retrying without financial mutations",async()=>{
    vi.mocked(api.financialRequests).mockRejectedValue(new Error("offline"));
    const payment=vi.spyOn(api,"recordPayment"),expense=vi.spyOn(api,"recordExpense");workspace();
    fireEvent.click(screen.getByRole("button",{name:"Thông báo kế toán"}));
    await screen.findByRole("alert");
    vi.mocked(api.financialRequests).mockResolvedValue([]);
    fireEvent.click(screen.getByRole("button",{name:"Tải lại thông báo"}));
    await screen.findByText("Chưa có thông báo mới.");
    expect(payment).not.toHaveBeenCalled();expect(expense).not.toHaveBeenCalled();
  });
});

describe("Large accounting transactions",()=>{
  beforeEach(()=>{vi.restoreAllMocks();vi.spyOn(api,"financialRequests").mockResolvedValue([]);});
  it("submits a large expense for approval without recording or printing it",async()=>{
    vi.spyOn(api,"expenses").mockResolvedValue([]);
    const write=vi.spyOn(api,"recordExpense"),request=vi.spyOn(api,"requestFinancial").mockResolvedValue({} as never);
    render(<FinanceOperations debts={[]} date="2026-10-16" onChanged={vi.fn()}/>);
    fireEvent.click(screen.getByRole("button",{name:"Ghi khoản chi"}));
    fireEvent.change(screen.getByLabelText("Nhóm chi phí"),{target:{value:"Bảo trì"}});
    fireEvent.change(screen.getByLabelText("Mô tả chứng từ"),{target:{value:"Sửa thiết bị"}});
    fireEvent.change(screen.getByLabelText("Số tiền (VND)"),{target:{value:"11000000"}});
    fireEvent.click(screen.getByRole("button",{name:"Gửi Giám đốc duyệt"}));
    await waitFor(()=>expect(request).toHaveBeenCalledOnce());
    expect(request.mock.calls[0][0]).toBe("expense");expect(write).not.toHaveBeenCalled();
    expect(document.getElementById("accounting-cash-voucher-frame")).toBeNull();
  });
  it("only executes approved requests using their original amount and transaction key",async()=>{
    const payload=JSON.stringify({category:"Supplies",description:"New supplies",method:"BANK_TRANSFER",idempotency_key:"KA-original"});
    vi.mocked(api.financialRequests).mockResolvedValue([
      {id:80,target_id:"finance:expense:KA-pending",payload,amount:12000000,status:"PENDING",reason:"Pending"},
      {id:81,target_id:"finance:expense:KA-original",payload,amount:11000000,status:"APPROVED",reason:"Approved"},
    ] as never);
    const write=vi.spyOn(api,"recordExpense").mockResolvedValue({id:5} as never),changed=vi.fn();
    render(<FinancialApprovalQueue operation="expense" refresh={0} onChanged={changed}/>);
    await screen.findByText("Chờ Giám đốc duyệt");
    expect(screen.getAllByRole("button",{name:"Ghi nhận khoản đã duyệt"})).toHaveLength(1);
    fireEvent.click(screen.getByRole("button",{name:"Ghi nhận khoản đã duyệt"}));
    await waitFor(()=>expect(changed).toHaveBeenCalledOnce());
    expect(write).toHaveBeenCalledExactlyOnceWith({category:"Supplies",description:"New supplies",method:"BANK_TRANSFER",amount:11000000},"KA-original");
  });
});

describe("KT_BM1 and KT_BM2 voucher printing",()=>{
  const voucher:CashVoucher={kind:"receipt",number:"PT-000012",occurredAt:"2026-10-16T10:30:00",amount:2500000,method:"BANK_TRANSFER",issuerId:"ACCOUNTING",issuerName:"Phạm Thị Kế Toán",reference:"Hóa đơn INV-12",reason:"Thu tiền phòng"};
  beforeEach(()=>{vi.restoreAllMocks();vi.spyOn(api,"financialRequests").mockResolvedValue([]);});
  afterEach(()=>{
    const frame=document.getElementById("accounting-cash-voucher-frame") as HTMLIFrameElement|null;
    if(frame){frame.onload=null;frame.remove();}
    vi.restoreAllMocks();
  });
  it("requires print-only names, escapes HTML and prints one saved receipt without creating another payment",()=>{
    const payment=vi.spyOn(api,"recordPayment"),receipt=vi.spyOn(api,"issueReceipt"),expense=vi.spyOn(api,"recordExpense");
    const persist=vi.spyOn(Storage.prototype,"setItem");
    render(<CashVoucherDialog voucher={voucher} onClose={vi.fn()}/>);
    fireEvent.submit(document.querySelector(".acct-voucher-fields")!);
    expect(screen.getByRole("alert").textContent).toContain("Nhập đầy đủ");
    expect(document.getElementById("accounting-cash-voucher-frame")).toBeNull();
    fireEvent.change(screen.getByLabelText("Họ tên người nộp tiền"),{target:{value:'Nguyễn Văn A <script>alert(1)</script>'}});
    fireEvent.change(screen.getByLabelText("Lý do thu"),{target:{value:'Tiền phòng <img src=x onerror=alert(1)>'}});
    fireEvent.click(screen.getByRole("button",{name:"In / Lưu PDF"}));
    const printed=(document.getElementById("accounting-cash-voucher-frame") as HTMLIFrameElement).srcdoc;
    expect(printed).toContain("KT_BM1");expect(printed).toContain("PHIẾU THU");expect(printed).toContain("PT-000012");
    expect(printed).toContain("16/10/2026");expect(printed).toContain("2.500.000");expect(printed).toContain("Chuyển khoản ngân hàng");
    expect(printed).not.toContain("<script>");expect(printed).not.toContain("<img");expect(printed).toContain("&lt;script&gt;");
    expect(printed).toContain("Phạm Thị Kế Toán");expect(printed).toContain("Ký, ghi rõ họ tên");
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(payment).not.toHaveBeenCalled();expect(receipt).not.toHaveBeenCalled();expect(expense).not.toHaveBeenCalled();expect(persist).not.toHaveBeenCalled();
  });
  it("prints an existing expense with its original actor and resets supplemental information on reopening",async()=>{
    vi.spyOn(api,"expenses").mockResolvedValue([
      {id:7,category:"Mua minibar",description:"Mua nước suối",amount:200000,paid_by:"FRONTDESK",paid_at:"2026-10-16T09:00:00",status:"RECORDED",method:"CASH"},
      {id:8,category:"Đã hủy",description:"Không in",amount:100,paid_by:"ACCOUNTING",paid_at:"2026-10-16T09:00:00",status:"VOIDED",method:"CASH"},
    ]);
    const save=vi.spyOn(api,"recordExpense");
    render(<FinanceOperations debts={[]} onChanged={vi.fn()} date="2026-10-16" employee={{employee_id:"ACCOUNTING",full_name:"Không phải người chi"}}/>);
    fireEvent.click(await screen.findByRole("button",{name:"In phiếu chi PC-000007"}));
    const dialog=screen.getByRole("dialog");
    expect((within(dialog).getByRole("textbox",{name:/Kế toán lập phiếu/}) as HTMLInputElement).value).toBe("");
    fireEvent.change(within(dialog).getByLabelText("Họ tên người nhận tiền"),{target:{value:"Nhà cung cấp A"}});
    fireEvent.change(within(dialog).getByRole("textbox",{name:/Kế toán lập phiếu/}),{target:{value:"Nguyễn Minh Lễ Tân"}});
    fireEvent.click(within(dialog).getByRole("button",{name:"In / Lưu PDF"}));
    const printed=(document.getElementById("accounting-cash-voucher-frame") as HTMLIFrameElement).srcdoc;
    expect(printed).toContain("KT_BM2");expect(printed).toContain("PHIẾU CHI");expect(printed).toContain("PC-000007");expect(printed).toContain("200.000");
    expect(printed).toContain("FRONTDESK");expect(printed).not.toContain("Không phải người chi");
    fireEvent.click(within(dialog).getByRole("button",{name:"Đóng biểu mẫu"}));
    fireEvent.click(screen.getByRole("button",{name:"In phiếu chi PC-000007"}));
    expect((screen.getByLabelText("Họ tên người nhận tiền") as HTMLInputElement).value).toBe("");
    fireEvent.click(screen.getByRole("button",{name:"Đóng biểu mẫu"}));
    expect((screen.getByRole("button",{name:"In phiếu chi PC-000008"}) as HTMLButtonElement).disabled).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });
  it("creates a receipt only against money already collected and offers its saved record for printing",async()=>{
    const invoice={id:12,reservation_id:112,issued_at:"2026-10-16T09:00:00",room_total:2000000,service_total:0,late_surcharge:0,compensation:0,extension_total:0,adjustment_total:0,discount:0,deposit:0,payable:1000000,payment_method:"CASH" as const,status:"CHUA_THANH_TOAN" as const};
    vi.spyOn(api,"invoices").mockResolvedValue({items:[invoice],page:0,size:10,totalElements:1,totalPages:1});
    vi.spyOn(api,"refundRequests").mockResolvedValue([]);
    vi.spyOn(api,"invoicePayments").mockResolvedValue([{id:1,invoice_id:12,amount:1000000,method:"CASH",type:"PAYMENT",status:"COMPLETED",reference:null,occurred_at:"2026-10-16T09:00:00",actor_id:"ACCOUNTING"}]);
    vi.spyOn(api,"invoiceReceipts").mockResolvedValue([{id:4,receipt_number:"PT-OLD",invoice_id:12,amount:250000,method:"CASH",issued_at:"2026-10-16T09:00:00",issued_by:"ACCOUNTING"}]);
    const issue=vi.spyOn(api,"issueReceipt").mockResolvedValue({id:5,receipt_number:"PT-NEW",invoice_id:12,amount:750000,method:"CASH",issued_at:"2026-10-16T11:42:00",issued_by:"ACCOUNTING"});
    const payment=vi.spyOn(api,"recordPayment");
    render(<InvoiceOperations onChanged={vi.fn()} onVatCreated={vi.fn()} refresh={0} search="" vatInvoices={[]} employee={{employee_id:"ACCOUNTING",full_name:"Phạm Thị Kế Toán"}}/>);
    fireEvent.click(await screen.findByRole("button",{name:"Xem / ghi nhận"}));
    await screen.findByRole("button",{name:"In phiếu thu PT-OLD"});
    fireEvent.click(screen.getByRole("button",{name:"Lập phiếu thu"}));
    const dialog=screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Số phiếu thu"),{target:{value:"PT-NEW"}});
    fireEvent.change(within(dialog).getByLabelText("Số tiền (VND)"),{target:{value:"1000000"}});
    fireEvent.click(within(dialog).getByRole("button",{name:"Lưu nghiệp vụ"}));
    expect((await within(dialog).findByRole("alert")).textContent).toContain("750.000");expect(issue).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText("Số tiền (VND)"),{target:{value:"750000"}});
    fireEvent.click(within(dialog).getByRole("button",{name:"Lưu nghiệp vụ"}));
    const preview=await screen.findByRole("dialog",{name:"In phiếu thu · KT_BM1"});
    expect(issue).toHaveBeenCalledTimes(1);
    expect(issue).toHaveBeenCalledWith(12,{receipt_number:"PT-NEW",amount:750000,method:"CASH"},expect.any(String));
    expect(preview.textContent).toContain("PT-NEW");expect(preview.textContent).toContain("750.000");
    expect(preview.textContent).toContain("11:42");expect(payment).not.toHaveBeenCalled();
  });
  it("renders a long multiline reason as text with the saved document number and signatures",()=>{
    const html=cashVoucherHtml({...voucher,kind:"expense",number:"PC-000500"},{counterpartyName:"Công ty vật tư",issuerName:"Kế toán A",reason:"Thanh toán vật tư\n"+"Hàng hóa đã nhận. ".repeat(20),purpose:"Mua minibar"});
    expect(html).toContain("PC-000500");expect(html).toContain("Người nhận tiền");expect(html).toContain("Hàng hóa đã nhận.");
    expect((html.match(/Ký, ghi rõ họ tên/g)??[]).length).toBe(2);
  });
});

describe("Accounting server pagination",()=>{
  beforeEach(()=>{
    vi.restoreAllMocks();vi.spyOn(api,"financialRequests").mockResolvedValue([]);
    vi.spyOn(api,"cashBalance").mockResolvedValue({actor_id:"ACCOUNTING",calculated_at:"2026-10-09T10:00:00",payments:0,refunds:0,received_handovers:0,handed_over_expected:0,cash_expenses:0,cash_debt_settlements:0,expected_amount:0});
    vi.spyOn(api,"cashRecipients").mockResolvedValue([]);vi.spyOn(api,"refundRequests").mockResolvedValue([]);
    vi.spyOn(authApi,"employeeProfile").mockResolvedValue({employee_id:"ACCOUNTING",full_name:"Kế toán kiểm thử",role:"ACCOUNTING",permissions:[]});
    vi.spyOn(api,"partnerDebts").mockResolvedValue([]); vi.spyOn(api,"cashHandovers").mockResolvedValue([]);
    vi.spyOn(enterpriseApi,"ota").mockResolvedValue([]); vi.spyOn(enterpriseApi,"vatInvoices").mockResolvedValue([]);
    vi.spyOn(api,"reconciliation").mockResolvedValue({from_date:"2026-10-09",to_date:"2026-10-09",totals_by_method:{CASH:15000000},total_payments:15000000,total_refunds:0,net_total:15000000,recognized_revenue:15000000,outstanding_partner_debt:0,cash_variance:0,completed_transactions:150,outstanding_bank_transfer_balances:0});
  });
  it("fills the handover amount from the popup and preserves confirmed counts after cancel", async()=>{
    vi.spyOn(api,"payments").mockResolvedValue(result(0,0));
    mount(); await screen.findByText("Hiển thị 0–0 trên 0 giao dịch");
    fireEvent.click(screen.getByRole("button",{name:"Ghi nhận bàn giao"}));
    fireEvent.click(screen.getByRole("button",{name:"Chi tiết mệnh giá"}));
    fireEvent.change(within(screen.getByRole("dialog")).getAllByRole("spinbutton")[0],{target:{value:"2"}});
    fireEvent.change(within(screen.getByRole("dialog")).getAllByRole("spinbutton")[1],{target:{value:"3"}});
    fireEvent.click(screen.getByRole("button",{name:"Xác nhận & Điền"}));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect((screen.getByLabelText("Số tiền thực đếm") as HTMLInputElement).value).toBe("1600000");
    fireEvent.click(screen.getByRole("button",{name:"Chi tiết mệnh giá"}));
    expect((within(screen.getByRole("dialog")).getAllByRole("spinbutton")[0] as HTMLInputElement).value).toBe("2");
    fireEvent.change(within(screen.getByRole("dialog")).getAllByRole("spinbutton")[0],{target:{value:"8"}});
    fireEvent.click(screen.getByRole("button",{name:"Hủy bỏ"}));
    expect((screen.getByLabelText("Số tiền thực đếm") as HTMLInputElement).value).toBe("1600000");
    expect(screen.getByRole("button",{name:"Chi tiết mệnh giá"}).textContent).toContain("× 2");
  });
  it("opens expense and debt dialogs from navigation without recording a transaction on cancel", async()=>{
    vi.spyOn(api,"payments").mockResolvedValue(result(0,0));
    vi.spyOn(api,"expenses").mockResolvedValue([]);
    const recordExpense=vi.spyOn(api,"recordExpense");
    const recordDebt=vi.spyOn(api,"recordPartnerDebt");
    mount(); await screen.findByText("Hiển thị 0–0 trên 0 giao dịch");
    const nav=screen.getByRole("navigation",{name:"Điều hướng Kế toán"});
    fireEvent.click(within(nav).getByRole("button",{name:"Thu chi & Công nợ"}));
    await screen.findByText("Chưa có khoản chi trong ngày đã chọn.");
    expect(within(nav).getByRole("button",{name:"Thu chi & Công nợ"}).getAttribute("aria-current")).toBe("page");
    fireEvent.click(screen.getByRole("button",{name:"Ghi khoản chi"}));
    let dialog=screen.getByRole("dialog",{name:"Ghi khoản chi"});
    fireEvent.change(within(dialog).getByLabelText("Nhóm chi phí"),{target:{value:"Vật tư"}});
    fireEvent.click(within(dialog).getByRole("button",{name:"Đóng biểu mẫu"}));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Ghi công nợ"}));
    dialog=screen.getByRole("dialog",{name:"Ghi công nợ nhà cung cấp"});
    expect(within(dialog).getByLabelText("Nhà cung cấp")).toBeTruthy();
    fireEvent(dialog,new Event("cancel",{bubbles:true,cancelable:true}));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(recordExpense).not.toHaveBeenCalled();expect(recordDebt).not.toHaveBeenCalled();
  });
  it("fetches only the selected page, shows records after 100 and keeps whole-day KPIs",async()=>{
    const invoices=vi.spyOn(api,"invoices"),payments=vi.spyOn(api,"payments").mockImplementation(async(q)=>result(q?.page??0));
    mount(); await screen.findByText("Hiển thị 1–10 trên 150 giao dịch");
    expect(payments).toHaveBeenCalledTimes(1); expect(payments).toHaveBeenLastCalledWith(expect.objectContaining({page:0,size:10}));
    expect(invoices).not.toHaveBeenCalled(); expect(screen.getByText("Tiền thu − tiền hoàn · 150 giao dịch hoàn tất")).toBeTruthy();
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
    fireEvent.change(screen.getByRole("combobox",{name:"Phương thức thanh toán"}),{target:{value:"card"}});
    await waitFor(()=>expect(payments).toHaveBeenLastCalledWith(expect.objectContaining({page:0,method:"CARD",search:"PAY-150"})));
  });
  it("looks up another day, synchronizes totals and exports the selected date while retaining filters",async()=>{
    const payments=vi.spyOn(api,"payments").mockImplementation(async(q)=>result(q?.page??0,150,q?.size??10));
    vi.spyOn(URL,"createObjectURL").mockReturnValue("blob:test");
    let filename="";
    vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(function(this:HTMLAnchorElement){filename=this.download;});
    mount();await screen.findByText("Hiển thị 1–10 trên 150 giao dịch");
    fireEvent.change(screen.getByPlaceholderText("Tìm mã giao dịch, hóa đơn hoặc đặt phòng..."),{target:{value:"PAY-150"}});
    fireEvent.change(screen.getByRole("combobox",{name:"Phương thức thanh toán"}),{target:{value:"card"}});
    await waitFor(()=>expect(payments).toHaveBeenLastCalledWith(expect.objectContaining({method:"CARD",search:"PAY-150"})));
    fireEvent.click(screen.getByRole("button",{name:"Trang 15"}));await screen.findByText("Hiển thị 141–150 trên 150 giao dịch");
    fireEvent.change(screen.getByLabelText("Ngày tra cứu giao dịch"),{target:{value:"2000-01-02"}});
    await waitFor(()=>expect(payments).toHaveBeenLastCalledWith(expect.objectContaining({from:"2000-01-02",to:"2000-01-02",page:0,method:"CARD",search:"PAY-150"})));
    expect((screen.getByLabelText("Ngày đối soát") as HTMLInputElement).value).toBe("2000-01-02");
    expect(api.reconciliation).toHaveBeenCalledWith({from:"2000-01-02",to:"2000-01-02"});
    await screen.findByText("Hiển thị 1–10 trên 150 giao dịch");
    fireEvent.click(screen.getByRole("button",{name:"Xuất giao dịch CSV"}));
    await waitFor(()=>expect(filename).toBe("payments-2000-01-02.csv"));
    fireEvent.click(screen.getByRole("button",{name:"Hôm nay"}));
    await waitFor(()=>expect(payments).toHaveBeenLastCalledWith(expect.objectContaining({from:businessDateValue(),to:businessDateValue(),page:0})));
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

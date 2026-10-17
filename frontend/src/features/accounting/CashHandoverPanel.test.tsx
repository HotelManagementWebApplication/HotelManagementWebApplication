import {fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import CashHandoverPanel from "./CashHandoverPanel";
import {kitchenAccountingApi} from "../../shared/api/kitchenAccounting";
const row={id:8,shift_code:"Ca sáng",from_actor:"FRONTDESK",to_actor:"ACCOUNT",expected_amount:100000,actual_amount:90000,variance:-10000,handed_over_at:"2026-10-17T13:00:00",note:"Thiếu 10.000",denominations:[]};
afterEach(()=>vi.restoreAllMocks());
describe("Accountant receives a front-desk handover",()=>{
 it("shows the submitted count and acknowledges receipt without creating or recounting cash",async()=>{
  const confirm=vi.spyOn(kitchenAccountingApi,"confirmCashHandover").mockResolvedValue(undefined);
  const onSaved=vi.fn();render(<CashHandoverPanel handovers={[row]} date="2026-10-17" actor="ACCOUNT" onSaved={onSaved}/>);
  expect(screen.getByText(/Thiếu 10.000/)).toBeTruthy();expect(screen.queryByRole("spinbutton")).toBeNull();expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Xác nhận đã nhận"}));await waitFor(()=>expect(confirm).toHaveBeenCalledWith(8));expect(onSaved).toHaveBeenCalledOnce();
 });
 it("does not offer another accountant's acknowledgment and displays the recorded decision",()=>{
  const {rerender}=render(<CashHandoverPanel handovers={[row]} date="2026-10-17" actor="OTHER" onSaved={vi.fn()}/>);
  expect(screen.queryByRole("button",{name:"Xác nhận đã nhận"})).toBeNull();
  rerender(<CashHandoverPanel handovers={[{...row,confirmed_at:"2026-10-17T13:05:00",confirmed_by:"ACCOUNT"}]} date="2026-10-17" actor="ACCOUNT" onSaved={vi.fn()}/>);
  expect(screen.getByText(/Đã xác nhận/)).toBeTruthy();expect(screen.queryByRole("button",{name:"Xác nhận đã nhận"})).toBeNull();
 });
});

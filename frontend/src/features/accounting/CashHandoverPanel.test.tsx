import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CashHandoverPanel from "./CashHandoverPanel";
import { kitchenAccountingApi as api } from "../../shared/api/kitchenAccounting";
import type { CashRecipient } from "../../shared/types/kitchenAccounting";

const recipient=(id:string):CashRecipient=>({employee_id:id,full_name:`Nhân viên ${id}`,role:"Kế toán",shift_code:"AFTERNOON",starts_at:"2026-10-16T14:00:00",ends_at:"2026-10-16T22:00:00"});
const mount=()=>render(<CashHandoverPanel actor="ACCOUNTING" date="2026-10-16" handovers={[]} onSaved={vi.fn()}/>);

describe("Cash handover roster",()=>{
  beforeEach(()=>{
    vi.restoreAllMocks();
    vi.spyOn(api,"cashBalance").mockResolvedValue({actor_id:"ACCOUNTING",calculated_at:"2026-10-16T13:00:00",payments:0,refunds:0,received_handovers:0,handed_over_expected:0,cash_expenses:0,cash_debt_settlements:0,expected_amount:0});
  });
  it("clears the previous recipient on shift changes and ignores obsolete roster responses",async()=>{
    let finish!: (rows:CashRecipient[])=>void;
    const recipients=vi.spyOn(api,"cashRecipients").mockImplementation(async code=>code==="AFTERNOON"?new Promise(resolve=>{finish=resolve;}):[recipient(code==="NIGHT"?"NEXT-MORNING":"NEXT-AFTERNOON"),recipient("ACCOUNTING")]);
    mount();
    await waitFor(()=>expect((screen.getByRole("button",{name:"Ghi nhận bàn giao"}) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button",{name:"Ghi nhận bàn giao"}));
    const select=screen.getByLabelText("Nhân viên nhận ca tiếp theo") as HTMLSelectElement;
    await screen.findByRole("option",{name:/Nhân viên NEXT-AFTERNOON/});
    expect(screen.queryByRole("option",{name:/Nhân viên ACCOUNTING/})).toBeNull();
    fireEvent.change(select,{target:{value:"NEXT-AFTERNOON"}});
    fireEvent.change(screen.getByLabelText("Ca đang bàn giao"),{target:{value:"AFTERNOON"}});
    expect(select.value).toBe("");expect(select.disabled).toBe(true);
    await waitFor(()=>expect(recipients).toHaveBeenLastCalledWith("AFTERNOON"));
    fireEvent.change(screen.getByLabelText("Ca đang bàn giao"),{target:{value:"NIGHT"}});
    await screen.findByRole("option",{name:/Nhân viên NEXT-MORNING/});
    await act(async()=>finish([recipient("OBSOLETE")]));
    expect(screen.queryByRole("option",{name:/OBSOLETE/})).toBeNull();
    expect(select.value).toBe("");
  });
  it("blocks saving and explains missing shift assignments without offering managers",async()=>{
    vi.spyOn(api,"cashRecipients").mockResolvedValue([]);
    const save=vi.spyOn(api,"recordCashHandover");
    mount();await waitFor(()=>expect((screen.getByRole("button",{name:"Ghi nhận bàn giao"}) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button",{name:"Ghi nhận bàn giao"}));
    expect(await screen.findByRole("status")).toHaveProperty("textContent",expect.stringContaining("Chưa có người nhận ca kế tiếp"));
    expect((screen.getByRole("button",{name:"Lưu bàn giao"}) as HTMLButtonElement).disabled).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });
});

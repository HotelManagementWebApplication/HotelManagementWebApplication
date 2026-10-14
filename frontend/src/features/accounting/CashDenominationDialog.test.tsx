import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CashDenominationDialog from "./CashDenominationDialog";

describe("Cash denomination counting", () => {
  it("calculates mixed denominations and confirms the existing API data shape", () => {
    const confirm = vi.fn();
    render(<CashDenominationDialog value={[]} onConfirm={confirm} onClose={vi.fn()} />);
    const inputs = screen.getAllByRole("spinbutton");
    fireEvent.change(inputs[0], { target: { value: "2" } });
    fireEvent.change(inputs[1], { target: { value: "3" } });
    const totals = document.querySelector(".cash-count-totals") as HTMLElement;
    expect(within(totals).getByText("5")).toBeTruthy();
    expect(totals.textContent).toContain("1.600.000");
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận & Điền" }));
    expect(confirm).toHaveBeenCalledWith([{ denomination: 500000, quantity: 2 }, { denomination: 200000, quantity: 3 }]);
  });

  it("keeps confirmed values unchanged when draft edits are cancelled", () => {
    const confirm = vi.fn(), close = vi.fn();
    const view = render(<CashDenominationDialog value={[{ denomination: 500000, quantity: 2 }]} onConfirm={confirm} onClose={close} />);
    const input = screen.getAllByRole("spinbutton")[0] as HTMLInputElement;
    expect(input.value).toBe("2");
    fireEvent.change(input, { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Hủy bỏ" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
    view.unmount();
    render(<CashDenominationDialog value={[{ denomination: 500000, quantity: 2 }]} onConfirm={confirm} onClose={close} />);
    expect((screen.getAllByRole("spinbutton")[0] as HTMLInputElement).value).toBe("2");
  });

  it("rejects fractional or negative quantities and supports Escape", () => {
    const close = vi.fn();
    render(<CashDenominationDialog value={[]} onConfirm={vi.fn()} onClose={close} />);
    const input = screen.getAllByRole("spinbutton")[0];
    for (const value of ["-1", "1.5"]) {
      fireEvent.change(input, { target: { value } });
      expect((screen.getByRole("button", { name: "Xác nhận & Điền" }) as HTMLButtonElement).disabled).toBe(true);
    }
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: false, cancelable: true }));
    expect(close).toHaveBeenCalledOnce();
  });
});

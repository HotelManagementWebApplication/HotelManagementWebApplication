import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VnpayPaymentResultPage } from "./VnpayPaymentResultPage";
import { customerApi } from "../../../shared/api/customer";
import type { CustomerReservation, VnpayPaymentAttempt } from "../../../shared/types/customer";

describe("VnpayPaymentResultPage fake-timer polling regression tests", () => {
  const baseReservation: CustomerReservation = {
    id: 101,
    status: "DRAFT",
    rental_type: "PACKAGE",
    deposit_amount: 500000,
    booked_at: "2026-10-09T08:00:00",
    rooms: [
      {
        room_id: "101",
        expected_check_in: "2026-10-10T14:00:00",
        expected_check_out: "2026-10-11T12:00:00",
      },
    ],
    deposit_payment: {
      payment_code: "DEP-101",
      amount: 500000,
      status: "PENDING",
      expires_at: "2099-10-09T10:30:00+07:00",
      instruction: "Thanh toán cọc",
    },
  };

  const createAttempt = (status: VnpayPaymentAttempt["status"], expiresAt: string): VnpayPaymentAttempt => ({
    attempt_id: 201,
    reservation_id: 101,
    transaction_reference: "TX-101",
    amount: 500000,
    status,
    expires_at: expiresAt,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    delete (window as any).location;
    window.location = new URL("http://localhost:5173/payment/vnpay-result?reservation_id=101&result=pending") as any;
    window.location.assign = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops polling deterministically when expires_at contract is reached and exposes recoverable action", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-10-09T10:00:00Z").getTime();
    vi.setSystemTime(now);

    const attemptExpiresAt = new Date(now + 6000).toISOString(); // 6 seconds in future
    const holdExpiresAt = new Date(now + 900000).toISOString(); // 15 mins hold
    const attempt = createAttempt("PENDING", attemptExpiresAt);

    const reservationSpy = vi.spyOn(customerApi, "reservation").mockResolvedValue({
      ...baseReservation,
      deposit_payment: { ...baseReservation.deposit_payment, expires_at: holdExpiresAt },
    });
    const latestPaymentSpy = vi.spyOn(customerApi, "latestVnpayPayment").mockResolvedValue(attempt);

    render(<VnpayPaymentResultPage isAuthenticated={true} onLogin={vi.fn()} />);

    // Initial mount fetch
    await act(async () => {
      await Promise.resolve();
    });

    expect(reservationSpy).toHaveBeenCalledTimes(1);
    expect(latestPaymentSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Đang xác nhận giao dịch")).toBeTruthy();

    // First tick at 2500ms
    await act(async () => {
      vi.advanceTimersByTime(2500);
      await Promise.resolve();
    });
    expect(latestPaymentSpy).toHaveBeenCalledTimes(2);

    // Second tick at 5000ms
    await act(async () => {
      vi.advanceTimersByTime(2500);
      await Promise.resolve();
    });
    expect(latestPaymentSpy).toHaveBeenCalledTimes(3);

    // Past expires_at (6000ms+) -> polling window ends deterministically
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    // Check that state transitions to recoverable timedOut state
    expect(screen.getByText("Hết thời gian chờ kết quả giao dịch")).toBeTruthy();
    expect(screen.getByText("Hết thời gian chờ")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Kiểm tra lại/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Thanh toán lại/ })).toBeTruthy();

    const callCountAtTimeout = latestPaymentSpy.mock.calls.length;

    // Advance further by 30 seconds -> no further polls should occur
    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
    });
    expect(latestPaymentSpy).toHaveBeenCalledTimes(callCountAtTimeout);
  });

  it("does not start polling when initial status is already settled (SUCCEEDED)", async () => {
    vi.useFakeTimers();
    const attempt = createAttempt("SUCCEEDED", new Date(Date.now() + 60000).toISOString());
    vi.spyOn(customerApi, "reservation").mockResolvedValue(baseReservation);
    const latestPaymentSpy = vi.spyOn(customerApi, "latestVnpayPayment").mockResolvedValue(attempt);

    render(<VnpayPaymentResultPage isAuthenticated={true} onLogin={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Thanh toán cọc thành công")).toBeTruthy();
    expect(latestPaymentSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(10000);
      await Promise.resolve();
    });

    // No interval polling triggered
    expect(latestPaymentSpy).toHaveBeenCalledTimes(1);
  });

  it("cleans timers on status change from PENDING to SUCCEEDED", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-10-09T10:00:00Z").getTime();
    vi.setSystemTime(now);

    const expiresAt = new Date(now + 60000).toISOString();
    const pendingAttempt = createAttempt("PENDING", expiresAt);
    const succeededAttempt = createAttempt("SUCCEEDED", expiresAt);

    vi.spyOn(customerApi, "reservation").mockResolvedValue(baseReservation);
    const latestPaymentSpy = vi.spyOn(customerApi, "latestVnpayPayment")
      .mockResolvedValueOnce(pendingAttempt)
      .mockResolvedValueOnce(succeededAttempt);

    render(<VnpayPaymentResultPage isAuthenticated={true} onLogin={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(latestPaymentSpy).toHaveBeenCalledTimes(1);

    // Advance by 2500ms to trigger first poll, which returns SUCCEEDED
    await act(async () => {
      vi.advanceTimersByTime(2500);
      await Promise.resolve();
    });
    expect(latestPaymentSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Thanh toán cọc thành công")).toBeTruthy();

    // Advance by another 10 seconds -> timers must have been cleaned on status change
    await act(async () => {
      vi.advanceTimersByTime(10000);
      await Promise.resolve();
    });
    expect(latestPaymentSpy).toHaveBeenCalledTimes(2);
  });

  it("cleans timers on unmount without leaking calls", async () => {
    vi.useFakeTimers();
    const expiresAt = new Date(Date.now() + 60000).toISOString();
    const attempt = createAttempt("PENDING", expiresAt);

    vi.spyOn(customerApi, "reservation").mockResolvedValue(baseReservation);
    const latestPaymentSpy = vi.spyOn(customerApi, "latestVnpayPayment").mockResolvedValue(attempt);

    const { unmount } = render(<VnpayPaymentResultPage isAuthenticated={true} onLogin={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(latestPaymentSpy).toHaveBeenCalledTimes(1);

    unmount();

    // Advance timers after unmount
    await act(async () => {
      vi.advanceTimersByTime(10000);
      await Promise.resolve();
    });

    expect(latestPaymentSpy).toHaveBeenCalledTimes(1);
  });

  it("does not start polling if attempt is already expired upon load", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-10-09T10:00:00Z").getTime();
    vi.setSystemTime(now);

    const expiredAt = new Date(now - 1000).toISOString(); // 1 second ago
    const attempt = createAttempt("PENDING", expiredAt);

    vi.spyOn(customerApi, "reservation").mockResolvedValue({
      ...baseReservation,
      deposit_payment: { ...baseReservation.deposit_payment, expires_at: expiredAt },
    });
    const latestPaymentSpy = vi.spyOn(customerApi, "latestVnpayPayment").mockResolvedValue(attempt);

    render(<VnpayPaymentResultPage isAuthenticated={true} onLogin={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Hết thời gian chờ kết quả giao dịch")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Kiểm tra lại/ })).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(10000);
      await Promise.resolve();
    });

    expect(latestPaymentSpy).toHaveBeenCalledTimes(1);
  });

  it("allows recovery via manual check button after timeout", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-10-09T10:00:00Z").getTime();
    vi.setSystemTime(now);

    const expiresAt = new Date(now - 1000).toISOString();
    const attempt = createAttempt("PENDING", expiresAt);
    const succeededAttempt = createAttempt("SUCCEEDED", expiresAt);

    vi.spyOn(customerApi, "reservation").mockResolvedValue(baseReservation);
    const latestPaymentSpy = vi.spyOn(customerApi, "latestVnpayPayment")
      .mockResolvedValueOnce(attempt)
      .mockResolvedValueOnce(succeededAttempt);

    render(<VnpayPaymentResultPage isAuthenticated={true} onLogin={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
    });

    const checkBtn = screen.getByRole("button", { name: /Kiểm tra lại/ });
    await act(async () => {
      fireEvent.click(checkBtn);
      await Promise.resolve();
    });

    expect(latestPaymentSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Thanh toán cọc thành công")).toBeTruthy();
  });

  it("omits retry button when reservation hold has expired alongside timeout", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-10-09T10:00:00Z").getTime();
    vi.setSystemTime(now);

    const expiredAt = new Date(now - 1000).toISOString();
    const attempt = createAttempt("PENDING", expiredAt);

    vi.spyOn(customerApi, "reservation").mockResolvedValue({
      ...baseReservation,
      deposit_payment: { ...baseReservation.deposit_payment, expires_at: expiredAt },
    });
    vi.spyOn(customerApi, "latestVnpayPayment").mockResolvedValue(attempt);

    render(<VnpayPaymentResultPage isAuthenticated={true} onLogin={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: /Kiểm tra lại/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Trang chủ/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Thanh toán lại/ })).toBeNull();
  });

  it("fails closed immediately into timed-out state without polling when both expiry timestamps are missing", async () => {
    vi.useFakeTimers();
    const attempt: VnpayPaymentAttempt = {
      attempt_id: 201,
      reservation_id: 101,
      transaction_reference: "TX-101",
      amount: 500000,
      status: "PENDING",
      expires_at: undefined as any,
    };

    vi.spyOn(customerApi, "reservation").mockResolvedValue({
      ...baseReservation,
      deposit_payment: {
        ...baseReservation.deposit_payment!,
        expires_at: undefined as any,
      },
    });
    const latestPaymentSpy = vi.spyOn(customerApi, "latestVnpayPayment").mockResolvedValue(attempt);

    render(<VnpayPaymentResultPage isAuthenticated={true} onLogin={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Hết thời gian chờ kết quả giao dịch")).toBeTruthy();
    expect(screen.getByText("Hết thời gian chờ")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Kiểm tra lại/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Trang chủ/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Thanh toán lại/ })).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
    });

    // Must never poll indefinitely: exactly 1 call on initial load
    expect(latestPaymentSpy).toHaveBeenCalledTimes(1);
  });

  it("fails closed immediately into timed-out state without polling when both expiry timestamps are malformed or non-finite", async () => {
    vi.useFakeTimers();
    const attempt: VnpayPaymentAttempt = {
      attempt_id: 201,
      reservation_id: 101,
      transaction_reference: "TX-101",
      amount: 500000,
      status: "PENDING",
      expires_at: "not-a-valid-date-iso",
    };

    vi.spyOn(customerApi, "reservation").mockResolvedValue({
      ...baseReservation,
      deposit_payment: {
        ...baseReservation.deposit_payment!,
        expires_at: "malformed-timestamp-value",
      },
    });
    const latestPaymentSpy = vi.spyOn(customerApi, "latestVnpayPayment").mockResolvedValue(attempt);

    render(<VnpayPaymentResultPage isAuthenticated={true} onLogin={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Hết thời gian chờ kết quả giao dịch")).toBeTruthy();
    expect(screen.getByText("Hết thời gian chờ")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Kiểm tra lại/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Trang chủ/ })).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
    });

    // Must never poll indefinitely: exactly 1 call on initial load
    expect(latestPaymentSpy).toHaveBeenCalledTimes(1);
  });

  it("preserves valid reservation expires_at when attempt expires_at is malformed", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-10-09T10:00:00Z").getTime();
    vi.setSystemTime(now);

    const holdExpiresAt = new Date(now + 6000).toISOString();
    const attempt: VnpayPaymentAttempt = {
      attempt_id: 201,
      reservation_id: 101,
      transaction_reference: "TX-101",
      amount: 500000,
      status: "PENDING",
      expires_at: "malformed-date",
    };

    vi.spyOn(customerApi, "reservation").mockResolvedValue({
      ...baseReservation,
      deposit_payment: { ...baseReservation.deposit_payment, expires_at: holdExpiresAt },
    });
    const latestPaymentSpy = vi.spyOn(customerApi, "latestVnpayPayment").mockResolvedValue(attempt);

    render(<VnpayPaymentResultPage isAuthenticated={true} onLogin={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Đang xác nhận giao dịch")).toBeTruthy();
    expect(latestPaymentSpy).toHaveBeenCalledTimes(1);

    // First tick at 2500ms
    await act(async () => {
      vi.advanceTimersByTime(2500);
      await Promise.resolve();
    });
    expect(latestPaymentSpy).toHaveBeenCalledTimes(2);

    // Second tick at 5000ms
    await act(async () => {
      vi.advanceTimersByTime(2500);
      await Promise.resolve();
    });
    expect(latestPaymentSpy).toHaveBeenCalledTimes(3);

    // Past 6000ms -> ends polling window
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(screen.getByText("Hết thời gian chờ kết quả giao dịch")).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
    });
    expect(latestPaymentSpy).toHaveBeenCalledTimes(3);
  });

  it("caps polling at two minutes even when the backend keeps extending expires_at", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T10:00:00+07:00"));
    vi.spyOn(customerApi,"reservation").mockResolvedValue(baseReservation);
    const latest=vi.spyOn(customerApi,"latestVnpayPayment").mockImplementation(async()=>createAttempt("PENDING",new Date(Date.now()+3600000).toISOString()));
    render(<VnpayPaymentResultPage isAuthenticated onLogin={vi.fn()} />);
    await act(async()=>{ await Promise.resolve(); });
    for(let i=0;i<48;i++) await act(async()=>{ await vi.advanceTimersByTimeAsync(2500); });
    expect(screen.getByText("Hết thời gian chờ kết quả giao dịch")).toBeTruthy();
    const calls=latest.mock.calls.length;
    expect(calls).toBeLessThanOrEqual(49);
    await act(async()=>{ await vi.advanceTimersByTimeAsync(60000); });
    expect(latest).toHaveBeenCalledTimes(calls);
  });

  it("does not overlap slow requests and still reaches the deadline", async () => {
    vi.useFakeTimers();
    const now=Date.now();
    vi.spyOn(customerApi,"reservation").mockResolvedValue(baseReservation);
    let finish!: (attempt: VnpayPaymentAttempt)=>void;
    const latest=vi.spyOn(customerApi,"latestVnpayPayment")
      .mockResolvedValueOnce(createAttempt("PENDING",new Date(now+10000).toISOString()))
      .mockImplementationOnce(()=>new Promise(resolve=>{ finish=resolve; }));
    const { unmount }=render(<VnpayPaymentResultPage isAuthenticated onLogin={vi.fn()} />);
    await act(async()=>{ await Promise.resolve(); });
    await act(async()=>{ await vi.advanceTimersByTimeAsync(2500); });
    await act(async()=>{ await vi.advanceTimersByTimeAsync(30000); });
    expect(latest).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Hết thời gian chờ kết quả giao dịch")).toBeTruthy();
    unmount();
    await act(async()=>{ finish(createAttempt("SUCCEEDED",new Date(now+10000).toISOString())); });
    expect(latest).toHaveBeenCalledTimes(2);
  });

  it("stops at the earlier reservation hold expiry", async () => {
    vi.useFakeTimers();
    const now=Date.now();
    vi.spyOn(customerApi,"reservation").mockResolvedValue({...baseReservation,deposit_payment:{...baseReservation.deposit_payment!,expires_at:new Date(now+3000).toISOString()}});
    const latest=vi.spyOn(customerApi,"latestVnpayPayment").mockResolvedValue(createAttempt("PENDING",new Date(now+60000).toISOString()));
    render(<VnpayPaymentResultPage isAuthenticated onLogin={vi.fn()} />);
    await act(async()=>{ await Promise.resolve(); });
    await act(async()=>{ await vi.advanceTimersByTimeAsync(3000); });
    expect(screen.getByText("Hết thời gian chờ kết quả giao dịch")).toBeTruthy();
    expect(screen.queryByRole("button",{name:/Thanh toán lại/})).toBeNull();
    const calls=latest.mock.calls.length;
    await act(async()=>{ await vi.advanceTimersByTimeAsync(30000); });
    expect(latest).toHaveBeenCalledTimes(calls);
  });

  it("does not poll a pending attempt once the reservation is paid", async () => {
    vi.useFakeTimers();
    vi.spyOn(customerApi,"reservation").mockResolvedValue({...baseReservation,deposit_payment:{...baseReservation.deposit_payment!,status:"PAID"}});
    const latest=vi.spyOn(customerApi,"latestVnpayPayment").mockResolvedValue(createAttempt("PENDING",new Date(Date.now()+60000).toISOString()));
    render(<VnpayPaymentResultPage isAuthenticated onLogin={vi.fn()} />);
    await act(async()=>{ await Promise.resolve(); });
    expect(screen.getByText("Thanh toán cọc thành công")).toBeTruthy();
    await act(async()=>{ await vi.advanceTimersByTimeAsync(30000); });
    expect(latest).toHaveBeenCalledTimes(1);
  });

  it("cancels requests and timers when authentication is lost", async () => {
    vi.useFakeTimers();
    vi.spyOn(customerApi,"reservation").mockResolvedValue(baseReservation);
    const latest=vi.spyOn(customerApi,"latestVnpayPayment").mockResolvedValue(createAttempt("PENDING",new Date(Date.now()+60000).toISOString()));
    const {rerender}=render(<VnpayPaymentResultPage isAuthenticated onLogin={vi.fn()} />);
    await act(async()=>{ await Promise.resolve(); });
    const signal=latest.mock.calls[0][1];
    rerender(<VnpayPaymentResultPage isAuthenticated={false} onLogin={vi.fn()} />);
    expect(signal?.aborted).toBe(true);
    await act(async()=>{ await vi.advanceTimersByTimeAsync(30000); });
    expect(latest).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button",{name:"Đăng nhập"})).toBeTruthy();
  });
  it("still stops by the deadline when polling APIs keep failing",async()=>{
    vi.useFakeTimers();
    const expires=new Date(Date.now()+10000).toISOString();
    vi.spyOn(customerApi,"reservation").mockResolvedValue(baseReservation);
    const latest=vi.spyOn(customerApi,"latestVnpayPayment").mockResolvedValueOnce(createAttempt("PENDING",expires)).mockRejectedValue(new Error("Network failed"));
    render(<VnpayPaymentResultPage isAuthenticated onLogin={vi.fn()} />);
    await act(async()=>{await Promise.resolve();});
    await act(async()=>{await vi.advanceTimersByTimeAsync(10000);});
    expect(screen.getByText("Hết thời gian chờ kết quả giao dịch")).toBeTruthy();
    const calls=latest.mock.calls.length;
    expect(calls).toBeGreaterThan(1);
    await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});
    expect(latest).toHaveBeenCalledTimes(calls);
  });
});

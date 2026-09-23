import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LuxuryFnBView, type FnbService } from "./LuxuryFnBView";

const breakfast: FnbService = {
  id: "BREAKFAST",
  category: "inroom",
  title: "Bữa sáng tại phòng",
  subtitle: "Ẩm thực tại phòng",
  price: 450_000,
  unit: "suất",
  desc: "Bữa sáng phục vụ tận phòng.",
  img: "https://example.test/breakfast.jpg",
  tag: "In-room dining",
  tagColor: "#166534",
};

const baseProps = {
  fnbCategory: "all",
  setFnbCategory: vi.fn(),
  tableModal: false,
  setTableModal: vi.fn(),
  services: [breakfast],
  selectedService: null,
  onSelectService: vi.fn(),
  onBookService: vi.fn().mockResolvedValue(null),
  onLoadBookings: vi.fn(() => new Promise<never>(() => undefined)),
  onCancelBooking: vi.fn(),
  reservations: [],
};

describe("LuxuryFnBView service discovery", () => {
  it("lets a visitor inspect service details before login or booking", () => {
    const setTableModal = vi.fn();
    const onSelectService = vi.fn();
    const { rerender } = render(
      <LuxuryFnBView {...baseProps} setTableModal={setTableModal} onSelectService={onSelectService} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Xem dịch vụ" }));
    expect(onSelectService).toHaveBeenCalledWith(breakfast);
    expect(setTableModal).toHaveBeenCalledWith(true);

    rerender(
      <LuxuryFnBView {...baseProps} tableModal selectedService={breakfast} setTableModal={setTableModal} onSelectService={onSelectService} />,
    );
    expect(screen.getByText("Thông tin dịch vụ")).toBeTruthy();
    expect(screen.getAllByText("Bữa sáng phục vụ tận phòng.").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("button", { name: "Đăng nhập để đặt" })).toBeTruthy();
  });

  it("warns hourly guests that service usage is fully charged", () => {
    render(
      <LuxuryFnBView
        {...baseProps}
        tableModal
        selectedService={breakfast}
        isAuthenticated
        reservations={[{
          id: 20,
          status: "DEPOSIT_PAID",
          rental_type: "HOURLY",
          deposit_amount: 390_000,
          total_amount: 780_000,
          booked_at: "2031-01-10T10:00:00",
          rooms: [{ room_id: "R303", expected_check_in: "2031-01-10T14:00:00", expected_check_out: "2031-01-10T17:00:00", guest_count: 2 }],
          deposit_payment: { payment_code: "HOS-TEST", amount: 390_000, status: "PAID", expires_at: "2031-01-10T10:15:00", instruction: "" },
        }]}
      />,
    );
    expect(screen.getByText(/Booking theo giờ không có dịch vụ miễn phí/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Xác nhận đặt dịch vụ" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

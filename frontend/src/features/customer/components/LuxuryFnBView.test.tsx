import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LuxuryFnBView, type FnbService } from "./LuxuryFnBView";
import { ApiError } from "../../../shared/api/client";
import type { CustomerReservation } from "../../../shared/types/customer";

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
  const restaurant = {...breakfast,id:"MAMREST",title:"MaM Restaurant",category:"fine-dining"};
  const stay: CustomerReservation = {
    id:6,status:"DEPOSIT_PAID",rental_type:"PACKAGE",deposit_amount:500000,total_amount:1000000,booked_at:"2035-01-01T10:00:00",
    rooms:[{room_id:"1401",expected_check_in:"2035-01-10T14:00:00",expected_check_out:"2035-01-12T12:00:00",guest_count:1}],
    deposit_payment:{payment_code:"TEST",amount:500000,status:"PAID",expires_at:"2035-01-02T10:00:00",instruction:""},
  };
  const renderRestaurant = (overrides: Partial<React.ComponentProps<typeof LuxuryFnBView>> = {}) => render(
    <LuxuryFnBView {...baseProps} tableModal selectedService={restaurant} services={[restaurant]} isAuthenticated reservations={[stay]} {...overrides} />,
  );

  it("offers only meal/stay-compatible times and switches safely between meals", async () => {
    const book = vi.fn().mockResolvedValue(null);
    renderRestaurant({onBookService:book});
    fireEvent.change(screen.getByLabelText("Ngày"),{target:{value:"2035-01-11"}});
    const time = screen.getByLabelText("Giờ") as HTMLSelectElement;
    await waitFor(() => expect(time.value).toBe("14:00"));
    expect([...time.options].map(o=>o.value)).toEqual(["11:30","12:00","12:30","13:00","13:30","14:00"]);
    fireEvent.change(screen.getByLabelText("Bữa ăn"),{target:{value:"DINNER"}});
    expect(time.value).toBe("18:30");
    expect([...time.options].map(o=>o.value)).toEqual(["18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30","22:00"]);
    fireEvent.click(screen.getByRole("button",{name:"Xác nhận đặt dịch vụ"}));
    await waitFor(() => expect(book).toHaveBeenCalledWith(expect.objectContaining({meal_period:"DINNER",scheduled_at:"2035-01-11T18:30:00",quantity:1})));
  });
  it.each(["-2","0","1.5","21",""])("rejects invalid quantity %s without clamping or writing", async value => {
    const book=vi.fn(); renderRestaurant({onBookService:book});
    fireEvent.change(screen.getByLabelText("Số suất/lần"),{target:{value}});
    fireEvent.submit(screen.getByRole("button",{name:"Xác nhận đặt dịch vụ"}).closest("form")!);
    expect(screen.getByRole("alert").textContent).toContain("Số suất/lần phải là số nguyên từ 1 đến 20");
    expect(book).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Số suất/lần") as HTMLInputElement).value).toBe(value);
  });
  it("rejects the exact checkout boundary and dates outside the stay", () => {
    const book=vi.fn(); renderRestaurant({onBookService:book});
    fireEvent.change(screen.getByLabelText("Ngày"),{target:{value:"2035-01-12"}});
    const time=screen.getByLabelText("Giờ") as HTMLSelectElement;
    expect([...time.options].map(o=>o.value)).toEqual(["11:30"]);
    fireEvent.change(screen.getByLabelText("Ngày"),{target:{value:"2035-01-13"}});
    fireEvent.submit(time.closest("form")!);
    expect(screen.getByRole("alert").textContent).toContain("Chọn giờ phục vụ phù hợp");
    expect(book).not.toHaveBeenCalled();
  });
  it("shows backend business errors in the form and makes the close button accessible", async () => {
    const close=vi.fn(); renderRestaurant({setTableModal:close,onBookService:vi.fn().mockRejectedValue(new ApiError(422,{code:"SERVICE_OUTSIDE_STAY",message:"Thời gian dịch vụ phải nằm trong kỳ lưu trú"}))});
    fireEvent.click(screen.getByRole("button",{name:"Xác nhận đặt dịch vụ"}));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent","Thời gian dịch vụ phải nằm trong kỳ lưu trú");
    fireEvent.click(screen.getByRole("button",{name:"Đóng đặt dịch vụ"}));
    expect(close).toHaveBeenCalledWith(false);
  });
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

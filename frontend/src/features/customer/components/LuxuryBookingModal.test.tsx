import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LuxuryBookingModal } from "./LuxuryBookingModal";

const room = {
  id: "R101", number: "101", floor: 1, type: "Standard" as const,
  pricePerNight: 1_200_000, pricePerHour: 180_000, status: "available" as const,
  cleanStatus: "clean" as const, view: "Biển", beds: "King", area: 32,
  maxOccupancy: 2, amenities: [], image: "",
};

describe("LuxuryBookingModal", () => {
  it("keeps hourly checkout in local datetime-local time instead of shifting it to UTC", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <LuxuryBookingModal room={room} isOpen onClose={vi.fn()} checkIn="2031-01-10" checkOut="2031-01-12"
        guests={1} isAuthenticated
        customerIdentity={{ fullName: "Nguyễn Văn An", phone: "0901234567", identityNumber: "012345678901", email: "an@example.com" }}
        onConfirm={onConfirm} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /theo giờ/i }));
    const datetime = container.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    fireEvent.change(datetime, { target: { value: "2031-01-10T14:00" } });
    fireEvent.change(screen.getByPlaceholderText("Nguyễn Văn A"), { target: { value: "Nguyễn Văn An" } });
    fireEvent.change(screen.getByPlaceholderText("0901 234 567"), { target: { value: "0901234567" } });
    fireEvent.click(screen.getByRole("button", { name: /tiếp tục đến cổng vnpay/i }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onConfirm.mock.calls[0][0]).toMatchObject({
      mode: "hour",
      hourlyCheckIn: "2031-01-10T14:00",
      hourlyCheckOut: "2031-01-10T17:00",
      paymentMethod: "vnpay",
    });
  });
});

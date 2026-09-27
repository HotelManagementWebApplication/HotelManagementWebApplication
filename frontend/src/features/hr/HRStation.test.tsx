import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HRStation from "./HRStation";
import { authApi } from "../../shared/api/auth";
import { enterpriseApi } from "../../shared/api/enterprise";
import { hrGovernanceApi } from "../../shared/api/hrGovernance";
import { localDateValue } from "../../shared/utils/localDate";

const weekAtOffset = (offset: number) => {
  const monday = new Date();
  const day = monday.getDay() || 7;
  monday.setDate(monday.getDate() - day + 1 + offset * 7);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
};

const dateLabel = (date: Date) => date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
const weekLabel = (dates: Date[]) =>
  `${dates[0].toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })} - ${dates[6].toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}`;

describe("HRStation weekly shift schedule", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(hrGovernanceApi, "shifts").mockResolvedValue([]);
    vi.spyOn(authApi, "employeeProfile").mockResolvedValue({
      employee_id: "HR01",
      full_name: "Nhân sự kiểm thử",
      role: "HR",
      permissions: [],
    });
    vi.spyOn(hrGovernanceApi, "employees").mockResolvedValue([]);
    vi.spyOn(hrGovernanceApi, "approvals").mockResolvedValue({
      items: [], page: 0, size: 20, total_elements: 0, total_pages: 0,
    });
    vi.spyOn(enterpriseApi, "attendance").mockResolvedValue([]);
    vi.spyOn(enterpriseApi, "leaves").mockResolvedValue([]);
  });

  it("keeps the displayed week, column dates, and shift query aligned while navigating", async () => {
    const shifts = vi.mocked(hrGovernanceApi.shifts);
    const onBack = vi.fn();
    render(<HRStation onBack={onBack} />);

    const assertWeek = async (offset: number, callNumber: number) => {
      const dates = weekAtOffset(offset);
      await waitFor(() => {
        expect(shifts).toHaveBeenCalledTimes(callNumber);
        expect(screen.getByText(weekLabel(dates))).toBeTruthy();
      });
      expect(shifts).toHaveBeenLastCalledWith({
        date: localDateValue(dates[0]),
        to: localDateValue(dates[6]),
      });
      for (const date of dates) expect(screen.getByText(dateLabel(date), { exact: true })).toBeTruthy();
    };

    await assertWeek(0, 1);
    fireEvent.click(screen.getByRole("button", { name: "Tuần sau" }));
    await assertWeek(1, 2);
    fireEvent.click(screen.getByRole("button", { name: "Tuần trước" }));
    await assertWeek(0, 3);
    fireEvent.click(screen.getByRole("button", { name: "Tuần trước" }));
    await assertWeek(-1, 4);
    fireEvent.click(screen.getByRole("button", { name: "Về tuần hiện tại" }));
    await assertWeek(0, 5);
  });
});

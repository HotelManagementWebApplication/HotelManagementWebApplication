import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  it.each([false, true])("saves a full overnight shift when editing=%s", async (editing) => {
    const day = localDateValue(weekAtOffset(0)[0]);
    const next = new Date(`${day}T12:00:00`); next.setDate(next.getDate()+1);
    vi.mocked(hrGovernanceApi.employees).mockResolvedValue([{employee_id: "FRONTDESK", full_name: "Lễ tân kiểm thử", role: "FRONT_DESK", phone: "0901111111", enabled: true, account_non_locked: true, failed_login_attempts: 0, employment_status: "WORKING"}]);
    vi.mocked(hrGovernanceApi.shifts).mockResolvedValue(editing ? [{id: 8, employee_id: "FRONTDESK", shift_date: day, shift_code: "MORNING", starts_at: `${day}T06:00:00`, ends_at: `${day}T14:00:00`, status: "ASSIGNED", created_by: "HR"}] : []);
    const assign = vi.spyOn(hrGovernanceApi, "assignShift").mockResolvedValue({id: 9} as any);
    const update = vi.spyOn(hrGovernanceApi, "updateShift").mockResolvedValue({id: 8} as any);
    render(<HRStation onBack={vi.fn()} />);
    const person = await screen.findByText("Lễ tân kiểm thử", {exact: true});
    const row = person.closest("tr")!;
    fireEvent.click(within(row).getAllByRole("button")[0]);
    fireEvent.click(screen.getByRole("button", {name: /Ca Đêm \(22:00 - 06:00\)/}));
    const payload = {shift_date: day, shift_code: "NIGHT", starts_at: `${day}T22:00:00`, ends_at: `${localDateValue(next)}T06:00:00`};
    await waitFor(() => editing ? expect(update).toHaveBeenCalledWith(8, payload) : expect(assign).toHaveBeenCalledWith({employee_id: "FRONTDESK", ...payload}));
  });

  it("shows the account-provisioning boundary without exposing a fake HR creation form", async () => {
    const provision = vi.spyOn(enterpriseApi, "autoProvisionEmployee");
    render(<HRStation onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", {name: /Hồ sơ nhân sự/}));
    fireEvent.click(screen.getByRole("button", {name: /Tiếp nhận nhân viên mới/}));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/HR không có quyền cấp tài khoản/)).toBeTruthy();
    expect(screen.queryByRole("button", {name: "Lưu hồ sơ"})).toBeNull();
    expect(provision).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", {name: "Đã hiểu"}));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
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

  it("renders employee attendance copy instead of hotel room copy in attendance table", async () => {
    render(<HRStation onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Chấm công" }));
    await waitFor(() => {
      expect(screen.getByRole("columnheader", { name: "Giờ vào" })).toBeTruthy();
      expect(screen.getByRole("columnheader", { name: "Giờ ra" })).toBeTruthy();
    });
    expect(screen.queryByRole("columnheader", { name: "Nhận phòng" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Trả phòng" })).toBeNull();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScreenRouter } from "./ScreenRouter";

vi.mock("../../features/front-desk/FrontDeskPMS", () => ({
  default: () => <div>front-desk-screen</div>,
}));

vi.mock("../../features/management/ManagerDashboard", () => ({
  default: ({ role }: { role: string }) => <div>{role}-dashboard</div>,
}));

const callbacks = {
  customerAuthenticated: false,
  onLogin: vi.fn(async () => null),
  onCustomerBack: vi.fn(),
  onOpenLogin: vi.fn(),
  onLogout: vi.fn(async () => undefined),
};

describe("ScreenRouter", () => {
  it("renders the selected front desk feature", () => {
    render(<ScreenRouter {...callbacks} view="frontdesk" role="reception" />);

    expect(screen.getByText("front-desk-screen")).toBeTruthy();
  });

  it("keeps a director on the management screen with director permissions", () => {
    render(<ScreenRouter {...callbacks} view="manager" role="director" />);

    expect(screen.getByText("director-dashboard")).toBeTruthy();
  });
});

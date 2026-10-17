import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ServiceCoordination } from "./ServiceCoordination";

it("filters non-restaurant services by group and room, and labels USED correctly", () => {
  const base={reservation_id:1,scheduled_at:"2035-01-10T08:00:00",quantity:1,free_quantity:0,unit_price:150000,amount_due:150000,meal_period:null,note:null};
  const props={bookings:[{...base,id:1,room_id:"501",service_id:"COURT",service_name:"Cầu lông",status:"CONFIRMED"},{...base,id:2,room_id:"502",service_id:"SPA",service_name:"Massage",status:"USED"}],items:[{id:"COURT",category:"Giải trí",unit:"giờ"},{id:"SPA",category:"Spa",unit:"lượt"}],date:"2035-01-10",loading:false,error:null,busyId:null,searchQuery:"",onDateChange:vi.fn(),onRefresh:vi.fn(),onMarkUsed:vi.fn()};
  const view=render(<ServiceCoordination {...props}/>);
  expect(screen.getByText("Massage")).toBeTruthy();
  expect(screen.queryByText("Đang sử dụng")).toBeNull();
  fireEvent.change(screen.getByRole("combobox",{name:"Nhóm dịch vụ"}),{target:{value:"Spa"}});
  expect(screen.getByText("Massage")).toBeTruthy();
  expect(screen.queryByText("Cầu lông")).toBeNull();
  view.rerender(<ServiceCoordination {...props} searchQuery="501"/>);
  expect(screen.queryByText("Massage")).toBeNull();
  fireEvent.change(screen.getByRole("combobox",{name:"Nhóm dịch vụ"}),{target:{value:""}});
  expect(screen.getByText("Cầu lông")).toBeTruthy();
});

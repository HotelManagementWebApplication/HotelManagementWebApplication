import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ServiceScheduleDialog } from "./ServiceScheduleDialog";
import { serviceScheduleApi } from "../../shared/api/serviceSchedule";
afterEach(()=>vi.restoreAllMocks());
it("loads actual database settings and saves capacity without treating stock as the number of resources",async()=>{
  vi.spyOn(serviceScheduleApi,"get").mockResolvedValue({service_id:"REALROOM",capacity:2,unit:"phòng",minutes_per_unit:1440,mode:"DURATION",consumes_stock:false});
  const save=vi.spyOn(serviceScheduleApi,"save").mockResolvedValue({service_id:"REALROOM",capacity:3,unit:"phòng",minutes_per_unit:1440,mode:"DURATION",consumes_stock:false});
  const saved=vi.fn();const close=vi.fn();
  render(<ServiceScheduleDialog item={{id:"REALROOM",name:"Phòng họp thực tế"}} onClose={close} onSaved={saved}/>);
  await waitFor(()=>expect((screen.getByLabelText("Số lượng phục vụ tối đa") as HTMLInputElement).value).toBe("2"));
  expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  fireEvent.change(screen.getByLabelText("Số lượng phục vụ tối đa"),{target:{value:"3"}});
  fireEvent.change(screen.getByLabelText("Lý do thay đổi"),{target:{value:"Bổ sung phòng họp"}});
  fireEvent.click(screen.getByRole("button",{name:"Lưu cấu hình"}));
  await waitFor(()=>expect(save).toHaveBeenCalledWith("REALROOM",{capacity:3,unit:"phòng",minutes_per_unit:1440,mode:"DURATION",consumes_stock:false,reason:"Bổ sung phòng họp"}));
  expect(saved).toHaveBeenCalledOnce();expect(close).toHaveBeenCalledOnce();
});

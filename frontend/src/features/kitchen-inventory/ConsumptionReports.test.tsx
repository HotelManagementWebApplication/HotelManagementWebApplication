import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ConsumptionReports from "./ConsumptionReports";
import { buildConsumptionReport, consumptionCsv, type ReportItem, type ReportMovement } from "./consumptionReport";

const items:ReportItem[]=[
  {id:"SPA",name:"Massage",category:"spa",categoryLabel:"Spa",unit:"suất",price:100000,stock:20,reorder:3,isStock:false},
  {id:"ROOMMEAL",name:"Ăn tại phòng",category:"inroom",categoryLabel:"Dịch vụ tại phòng",unit:"suất",price:200000,stock:20,reorder:3,isStock:false},
  {id:"WATER",name:"Nước suối (chai nhỏ)",category:"beverage",categoryLabel:"Thức uống",unit:"chai",price:10000,stock:12,reorder:8,isStock:true},
];
const movements:ReportMovement[]=[
  {id:"1",serviceId:"SPA",movementType:"ISSUE",qty:-2,occurredAt:"2035-01-09T08:00:00"},
  {id:"2",serviceId:"ROOMMEAL",movementType:"ISSUE",qty:-3,occurredAt:"2035-01-15T23:59:59"},
  {id:"3",serviceId:"WATER",movementType:"ISSUE",qty:-5,occurredAt:"2035-01-10T09:00:00",stockBefore:13,stockAfter:8},
  {id:"4",serviceId:"WATER",movementType:"RECEIVE",qty:4,occurredAt:"2035-01-16T09:00:00",stockBefore:8,stockAfter:12},
  {id:"5",serviceId:"WATER",movementType:"WASTE",qty:-1,occurredAt:"2035-01-10T08:00:00",stockBefore:14,stockAfter:13},
  {id:"6",serviceId:"SPA",movementType:"ISSUE",qty:-10,occurredAt:"2035-01-08T23:59:59"},
  {id:"7",serviceId:"SPA",movementType:"ISSUE",qty:-10,occurredAt:"2035-01-16T00:00:00"},
];

describe("Consumption reports",()=>{
  it("keeps the same seven-day scope across both series, category shares and detail tabs",()=>{
    const report=buildConsumptionReport(items,movements,"2035-01-15");
    expect(report.start).toBe("2035-01-09");expect(report.days).toHaveLength(7);
    expect(report.serviceAmount).toBe(800000);
    expect(report.groups.map(row=>[row.category,row.percent])).toEqual([["inroom",75],["spa",25]]);
    expect(report.stock[0].item.id).toBe("WATER");expect(report.stock[0].quantity).toBe(5);expect(report.stock[0].amount).toBe(50000);
    expect(report.stock[0].endingStock).toBe(8);
    expect(report.days[0].services).toBe(200000);expect(report.days[6].services).toBe(600000);
    expect(report.days.reduce((sum,day)=>sum+day.stock,0)).toBe(50000);
  });
  it("uses the last movement on the selected date and does not substitute current stock into old reports",()=>{
    const sameTime=[...movements,{id:"8",serviceId:"WATER",movementType:"RETURN" as const,qty:1,occurredAt:"2035-01-10T09:00:00",stockBefore:8,stockAfter:9}];
    expect(buildConsumptionReport(items,sameTime,"2035-01-15").stock[0].endingStock).toBe(9);
    const unknown=movements.map(row=>({...row,stockBefore:undefined,stockAfter:undefined}));
    expect(buildConsumptionReport(items,unknown,"2035-01-15").stock[0].endingStock).toBeNull();
  });
  it("exports the selected tab with matching dates, quantities and safe CSV cells",()=>{
    const report=buildConsumptionReport([{...items[2],name:'=HYPERLINK("unsafe")'}],movements,"2035-01-15");
    const csv=consumptionCsv(report.stock,"stock",report.start,report.end);
    expect(csv).toContain('"2035-01-09","2035-01-15","WATER"');
    expect(csv).toContain('"\'=HYPERLINK(""unsafe"")"');
    expect(csv).toContain('"chai","5","10000","50000","8"');
    expect(csv).not.toContain("SPA");
  });
  it("switches detail tabs, uses historical ending stock and clears stale rows when the period changes",()=>{
    render(<ConsumptionReports items={items} transactions={movements}/>);
    fireEvent.change(screen.getByLabelText("Ngày báo cáo"),{target:{value:"2035-01-15"}});
    const panel=screen.getByRole("tabpanel");
    expect(within(panel).getByText("Nước suối (chai nhỏ)")).toBeTruthy();
    expect(within(panel).getByText("8").className).toContain("low-stock");
    expect(within(panel).queryByText("Massage")).toBeNull();
    fireEvent.click(screen.getByRole("tab",{name:"Dịch vụ"}));
    expect(within(panel).getByText("Massage")).toBeTruthy();
    expect(within(panel).queryByText("Tồn cuối")).toBeNull();
    expect(within(panel).queryByText("Nước suối (chai nhỏ)")).toBeNull();
    fireEvent.change(screen.getByLabelText("Ngày báo cáo"),{target:{value:"2035-02-01"}});
    expect(within(panel).getByText("Chưa có dịch vụ sử dụng trong kỳ đã chọn.")).toBeTruthy();
    expect(screen.queryByText(/NaN|Infinity/)).toBeNull();
  });
});

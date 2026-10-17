import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StockNotifications, { type StockActivity } from "./StockNotifications";

const usage:StockActivity[]=[
  {id:"1",name:"Nước suối",sku:"WATER",occurredAt:"2035-01-10T13:04:00",qty:20,staff:"KITCHEN",movementType:"RECEIVE"},
  {id:"2",name:"Khăn tắm",sku:"TOWEL",occurredAt:"2035-01-10T14:04:00",qty:-2,staff:"KITCHEN",movementType:"ISSUE"},
  {id:"3",name:"Bánh quy",sku:"COOKIE",occurredAt:"2035-01-09T10:00:00",qty:-1,staff:"KITCHEN",movementType:"WASTE"},
  {id:"4",name:"Khăn tay",sku:"HANDTOWEL",occurredAt:"2035-01-08T10:00:00",qty:3,staff:"KITCHEN",movementType:"RETURN"},
  {id:"5",name:"Ly thủy tinh",sku:"GLASS",occurredAt:"2035-01-08T09:00:00",qty:-1,staff:"KITCHEN",movementType:"ADJUST"},
];

describe("Stock notifications",()=>{
  it("groups real movements by day and filters each movement without losing return or adjustment entries",()=>{
    render(<StockNotifications usage={usage} onSeeAll={vi.fn()}/>);
    fireEvent.click(screen.getByRole("button",{name:"Thông báo biến động kho"}));
    const dialog=screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("article")).toHaveLength(5);
    expect(within(dialog).getAllByRole("heading",{level:3})).toHaveLength(3);
    expect(within(dialog).getAllByRole("article")[0].textContent).toContain("Khăn tắm");
    expect(within(dialog).getByText("+20")).toBeTruthy();
    const filters=within(dialog).getByRole("group",{name:"Lọc loại biến động"});
    fireEvent.click(within(filters).getByRole("button",{name:"Xuất 1"}));
    expect(within(dialog).getAllByRole("article")).toHaveLength(1);
    expect(within(dialog).getByText("TOWEL")).toBeTruthy();
    expect(within(dialog).queryByText("WATER")).toBeNull();
    fireEvent.click(within(filters).getByRole("button",{name:"Trả kho 1"}));
    expect(within(dialog).getByText("Trả lại kho")).toBeTruthy();
    fireEvent.click(within(filters).getByRole("button",{name:"Điều chỉnh 1"}));
    expect(within(dialog).getByText("GLASS")).toBeTruthy();
    fireEvent.click(within(filters).getByRole("button",{name:"Tất cả 5"}));
    expect(within(dialog).getAllByRole("article")).toHaveLength(5);
  });
  it("shows an empty filter and leaves the full-history action available",()=>{
    const onSeeAll=vi.fn();
    render(<StockNotifications usage={[usage[0]]} onSeeAll={onSeeAll}/>);
    const bell=screen.getByRole("button",{name:"Thông báo biến động kho"});
    fireEvent.click(bell);
    fireEvent.click(screen.getByRole("button",{name:"Hao hụt 0"}));
    expect(screen.getByText("Chưa có biến động thuộc loại này.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"Xem tất cả biến động"}));
    expect(onSeeAll).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(bell);
  });
});

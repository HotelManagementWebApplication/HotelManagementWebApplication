import type { ServiceConsumption } from "../../shared/api/serviceConsumption";
import type { MovementType } from "../../shared/types/kitchenAccounting";
import { localDateValue, parseApiDate } from "../../shared/utils/localDate";

export interface ReportItem {
  id:string;name:string;category:string;categoryLabel:string;unit:string;
  price:number;stock:number;reorder:number;isStock:boolean;
}
export interface ReportMovement {
  id:string;serviceId:string;movementType:MovementType;qty:number;occurredAt:string;
  stockBefore?:number|null;stockAfter?:number|null;
}
export interface ConsumptionRow {
  item:ReportItem;quantity:number;amount:number;endingStock:number|null;
}
export type ReportTab="services"|"stock";

function endingStock(item:ReportItem,movements:ReportMovement[],end:string):number|null {
  const sorted=movements.filter(row=>row.serviceId===item.id).sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt)||Number(b.id)-Number(a.id));
  const previous=sorted.find(row=>localDateValue(parseApiDate(row.occurredAt))<=end);
  if(previous?.stockAfter!=null)return previous.stockAfter;
  const next=sorted.filter(row=>localDateValue(parseApiDate(row.occurredAt))>end).at(-1);
  if(next?.stockBefore!=null)return next.stockBefore;
  return end===localDateValue()?item.stock:null;
}

export function buildConsumptionReport(items:ReportItem[],movements:ReportMovement[],end:string,usages:ServiceConsumption[]) {
  const endDate=parseApiDate(end);const startDate=new Date(endDate);startDate.setDate(startDate.getDate()-6);
  const start=localDateValue(startDate);
  const days=Array.from({length:7},(_,index)=>{
    const date=new Date(startDate);date.setDate(date.getDate()+index);
    return {key:localDateValue(date),label:date.toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit"}),services:0,stock:0};
  });
  const itemById=new Map(items.map(item=>[item.id,item]));
  const byDay=new Map(days.map(day=>[day.key,day]));
  const totals=new Map<string,ConsumptionRow>();
  let issueCount=0;
  movements.forEach(movement=>{
    const day=byDay.get(localDateValue(parseApiDate(movement.occurredAt)));
    const item=itemById.get(movement.serviceId);
    if(!day||!item||!item.isStock||movement.movementType!=="ISSUE")return;
    issueCount++;
    const quantity=Math.abs(movement.qty);const amount=quantity*item.price;
    day[item.isStock?"stock":"services"]+=amount;
    const row=totals.get(item.id)??{item,quantity:0,amount:0,endingStock:null};
    row.quantity+=quantity;row.amount+=amount;totals.set(item.id,row);
  });
  usages.forEach(usage=>{
    const day=byDay.get(localDateValue(parseApiDate(usage.occurred_at)));
    const item=itemById.get(usage.service_id);
    if(!day||!item||item.isStock)return;
    issueCount++;
    day.services+=usage.amount_due;
    const row=totals.get(item.id)??{item,quantity:0,amount:0,endingStock:null};
    row.quantity+=usage.quantity;row.amount+=usage.amount_due;totals.set(item.id,row);
  });
  const rows=[...totals.values()].map(row=>({...row,endingStock:row.item.isStock?endingStock(row.item,movements,end):null}))
    .sort((a,b)=>b.amount-a.amount||a.item.name.localeCompare(b.item.name,"vi"));
  const services=rows.filter(row=>!row.item.isStock);const stock=rows.filter(row=>row.item.isStock);
  const groupTotals=new Map<string,{category:string;label:string;amount:number}>();
  services.forEach(row=>{
    const group=groupTotals.get(row.item.category)??{category:row.item.category,label:row.item.categoryLabel,amount:0};
    group.amount+=row.amount;groupTotals.set(row.item.category,group);
  });
  const serviceAmount=services.reduce((total,row)=>total+row.amount,0);
  const groups=[...groupTotals.values()].sort((a,b)=>b.amount-a.amount).map(group=>({...group,percent:serviceAmount>0?group.amount/serviceAmount*100:0}));
  return {start,end,days,services,stock,groups,serviceAmount,issueCount};
}

export function consumptionCsv(rows:ConsumptionRow[],tab:ReportTab,start:string,end:string):string {
  const cell=(value:string|number)=>`"${String(value).replace(/^[=+@-]/,"'$&").replaceAll('"','""')}"`;
  const header=["Từ ngày","Đến ngày","Mã hàng","Tên mặt hàng","ĐVT",tab==="stock"?"SL xuất dùng":"SL sử dụng","Đơn giá tham chiếu","Thành tiền",...(tab==="stock"?["Tồn cuối"]:[])];
  const data=rows.map(row=>[start,end,row.item.id,row.item.name,row.item.unit,row.quantity,row.item.price,row.amount,...(tab==="stock"?[row.endingStock??""]:[])]);
  return "\uFEFF"+[header,...data].map(row=>row.map(cell).join(",")).join("\r\n");
}

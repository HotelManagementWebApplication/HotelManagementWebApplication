import { serviceConsumptionApi, type ServiceConsumption } from "../../shared/api/serviceConsumption";
import { apiErrorMessage } from "../../shared/api/client";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, BedDouble, BriefcaseBusiness, CalendarDays, Car, CircleHelp, Download, Dumbbell, Flower2, Package, PieChart, Shirt, Utensils } from "lucide-react";
import { formatVnd } from "../../shared/utils/money";
import { localDateValue } from "../../shared/utils/localDate";
import { buildConsumptionReport, consumptionCsv, type ReportItem, type ReportMovement, type ReportTab } from "./consumptionReport";
import "./consumptionReports.css";

type TrendDay=ReturnType<typeof buildConsumptionReport>["days"][number];
const colors=["#1D4ED8","#3B82F6","#60A5FA","#93C5FD","#2563EB","#7DD3FC"];
const groupIcons:Record<string,typeof Package>={inroom:BedDouble,"fine-dining":Utensils,laundry:Shirt,business:BriefcaseBusiness,spa:Flower2,transport:Car,recreation:Dumbbell};
const quantity=(value:number)=>value.toLocaleString("vi-VN");

function ConsumptionTrend({days,issueCount}:{days:TrendDay[];issueCount:number}) {
  const [focused,setFocused]=useState<number|null>(null);
  const max=Math.max(...days.flatMap(day=>[day.services,day.stock]))||1000000;
  const rough=max/4;const magnitude=10**Math.floor(Math.log10(rough));const ratio=rough/magnitude;
  const step=(ratio<=1?1:ratio<=2?2:ratio<=5?5:10)*magnitude;const ceiling=step*4;
  const left=103,right=696,top=34,bottom=210;
  const x=(index:number)=>left+(right-left)*index/6;
  const y=(value:number)=>bottom-(bottom-top)*value/ceiling;
  const points=(key:"services"|"stock")=>days.map((day,index)=>`${x(index)},${y(day[key])}`).join(" ");
  const area=(key:"services"|"stock")=>`M ${left},${bottom} L ${days.map((day,index)=>`${x(index)},${y(day[key])}`).join(" L ")} L ${right},${bottom} Z`;
  const hasValue=days.some(day=>day.services>0||day.stock>0);
  return <div className="ki-report-chart-scroll"><svg viewBox="0 0 720 251" className="ki-report-chart" role="img" aria-label="Xu hướng giá trị tiêu thụ 7 ngày">
    <defs><linearGradient id="ki-report-service-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3B82F6" stopOpacity=".2"/><stop offset="100%" stopColor="#3B82F6" stopOpacity=".025"/></linearGradient><linearGradient id="ki-report-stock-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60A5FA" stopOpacity=".12"/><stop offset="100%" stopColor="#60A5FA" stopOpacity=".025"/></linearGradient></defs>
    {Array.from({length:5},(_,index)=>{const value=ceiling-index*step;return <g key={index}><line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="#E9EEF0"/><text x={left-12} y={y(value)+4} textAnchor="end" className="ki-report-axis">{formatVnd(value)}</text></g>;})}
    {days.map((day,index)=><g key={day.key}><line x1={x(index)} x2={x(index)} y1={top} y2={bottom} stroke="#F0F3F4"/><text x={x(index)} y={239} textAnchor="middle" className="ki-report-axis">{day.label}</text></g>)}
    <path d={area("services")} fill="url(#ki-report-service-fill)"/><path d={area("stock")} fill="url(#ki-report-stock-fill)"/>
    <polyline points={points("services")} fill="none" stroke="#1D4ED8" strokeWidth="2.5" strokeLinejoin="round"/><polyline points={points("stock")} fill="none" stroke="#60A5FA" strokeWidth="2.5" strokeLinejoin="round"/>
    {days.map((day,index)=>{const close=Math.abs(y(day.services)-y(day.stock))<26;return <g key={day.key} tabIndex={0} role="img" aria-label={`${day.label}: dịch vụ ${formatVnd(day.services)}, hàng xuất dùng ${formatVnd(day.stock)}`} onMouseEnter={()=>setFocused(index)} onMouseLeave={()=>setFocused(null)} onFocus={()=>setFocused(index)} onBlur={()=>setFocused(null)}>
      <title>{day.label}: Dịch vụ {formatVnd(day.services)}; Hàng xuất dùng {formatVnd(day.stock)}</title>
      <rect x={x(index)-34} y={top} width={68} height={bottom-top} fill="transparent"/>
      {(["services","stock"] as const).map(key=>{const upper=day[key]>=day[key==="services"?"stock":"services"];const offset=close&&!upper?16:-12;return <g key={key}><circle cx={x(index)} cy={y(day[key])} r={focused===index?5:4} fill={key==="services"?"#1D4ED8":"#60A5FA"}/>{hasValue&&<text x={x(index)} y={y(day[key])+offset+(close&&day.services===day.stock&&key==="stock"?28:0)} textAnchor="middle" className="ki-report-value">{quantity(day[key])}</text>}</g>;})}
    </g>;})}
    {!hasValue&&<text x="400" y="116" textAnchor="middle" className="ki-report-empty-chart">{issueCount===0?"Chưa có lượt sử dụng hoặc phiếu xuất dùng trong kỳ này":"Các lượt trong kỳ có giá trị bằng 0"}</text>}
  </svg></div>;
}

export default function ConsumptionReports({items,transactions}:{items:ReportItem[];transactions:ReportMovement[]}) {
  const [endDate,setEndDate]=useState(()=>localDateValue());
  const [tab,setTab]=useState<ReportTab>("stock");
  const [usages,setUsages]=useState<ServiceConsumption[]>([]);
  const [usageError,setUsageError]=useState<string|null>(null);
  const [usageLoading,setUsageLoading]=useState(true);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{let active=true;setUsages([]);setUsageError(null);setUsageLoading(true);
    const start=new Date(`${endDate}T00:00:00`);start.setDate(start.getDate()-6);
    serviceConsumptionApi.list(localDateValue(start),endDate).then(rows=>{if(active)setUsages(rows);})
      .catch(error=>{if(active)setUsageError(apiErrorMessage(error,"Không tải được các lượt sử dụng dịch vụ."));})
      .finally(()=>{if(active)setUsageLoading(false);});
    return()=>{active=false;};},[endDate,retry]);
  const report=useMemo(()=>buildConsumptionReport(items,transactions,endDate,usages),[items,transactions,endDate,usages]);
  const rows=tab==="stock"?report.stock:report.services;
  const total=rows.reduce((sum,row)=>sum+row.amount,0);
  const download=()=>{
    const url=URL.createObjectURL(new Blob([consumptionCsv(rows,tab,report.start,report.end)],{type:"text/csv;charset=utf-8"}));
    const anchor=document.createElement("a");anchor.href=url;anchor.download=`bao-cao-${tab==="stock"?"hang-xuat-dung":"dich-vu"}-${report.start}-${report.end}.csv`;anchor.click();URL.revokeObjectURL(url);
  };
  return <div className="ki-consumption-reports">
    <div className="ki-report-page-header"><div><h2>Báo cáo tiêu thụ</h2><p>Theo dõi dịch vụ và hàng xuất dùng trong 7 ngày · {report.days[0].label} – {report.days[6].label}</p></div><div className="ki-report-page-actions"><label><CalendarDays size={15}/><input aria-label="Ngày báo cáo" type="date" value={endDate} onChange={event=>{if(event.target.value)setEndDate(event.target.value);}}/></label><button type="button" onClick={download} disabled={tab==="services"&&(usageLoading||Boolean(usageError))}><Download size={15}/>Xuất báo cáo</button></div></div>
    {usageError&&<p role="alert">{usageError} <button onClick={()=>setRetry(value=>value+1)}>Tải lại</button></p>}
    {usageLoading&&<p role="status">Đang tải lượt sử dụng dịch vụ…</p>}
    <div className="ki-report-overview">
      <section className="ki-report-card ki-report-trend" aria-labelledby="consumption-trend-title"><header><h3 id="consumption-trend-title"><BarChart3 size={20}/>Xu hướng tiêu thụ</h3><div className="ki-report-legend"><span><i/>Giá trị dịch vụ</span><span><i/>Giá trị xuất dùng</span></div></header><ConsumptionTrend days={report.days} issueCount={report.issueCount}/><p className="ki-report-reference-note"><CircleHelp size={12}/>Dịch vụ: giá đã ghi nhận, trừ phần miễn phí. Hàng xuất dùng: đơn giá danh mục hiện tại.</p></section>
      <section className="ki-report-card ki-report-groups" aria-labelledby="service-groups-title"><header><h3 id="service-groups-title"><PieChart size={21}/>Tiêu thụ theo nhóm dịch vụ</h3></header><div className="ki-report-group-list">{report.groups.map((group,index)=>{const Icon=groupIcons[group.category]??Package;const color=colors[index%colors.length];return <div key={group.category} className="ki-report-group"><span className="ki-report-group-icon" style={{color}}><Icon size={20}/></span><div><div className="ki-report-group-label"><strong>{group.label}</strong><span>{quantity(Number(group.percent.toFixed(1)))}%</span><b>{formatVnd(group.amount)}</b></div><div className="ki-report-progress" role="progressbar" aria-label={group.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(group.percent.toFixed(1))}><span style={{width:`${group.percent}%`,background:color}}/></div></div></div>;})}{report.groups.length===0&&<div className="ki-report-empty"><PieChart size={30}/><p>Chưa có tiêu thụ dịch vụ trong kỳ đã chọn.</p></div>}</div></section>
    </div>
    <section className="ki-report-card ki-report-details" aria-labelledby="consumption-details-title"><header><h3 id="consumption-details-title"><Package size={20}/>Chi tiết tiêu thụ</h3><div className="ki-report-tabs" role="tablist" aria-label="Loại chi tiết tiêu thụ"><button id="report-services-tab" role="tab" aria-selected={tab==="services"} aria-controls="report-consumption-table" onClick={()=>setTab("services")}>Dịch vụ</button><button id="report-stock-tab" role="tab" aria-selected={tab==="stock"} aria-controls="report-consumption-table" onClick={()=>setTab("stock")}>Hàng xuất dùng</button></div></header>
      <div id="report-consumption-table" role="tabpanel" aria-labelledby={tab==="stock"?"report-stock-tab":"report-services-tab"} className="ki-report-table-scroll"><table><thead><tr>{["#","Mã hàng",tab==="stock"?"Tên mặt hàng":"Tên dịch vụ","ĐVT",tab==="stock"?"SL xuất dùng":"SL sử dụng","Đơn giá tham chiếu","Thành tiền",...(tab==="stock"?["Tồn cuối"]:[])].map(title=><th key={title}>{title}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={row.item.id}><td>{index+1}</td><td className="ki-report-sku">{row.item.id}</td><td>{row.item.name}</td><td>{row.item.unit}</td><td>{quantity(row.quantity)}</td><td>{formatVnd(row.item.price)}</td><td>{formatVnd(row.amount)}</td>{tab==="stock"&&<td><span className={row.endingStock===0?"ki-report-no-stock":row.endingStock!=null&&row.endingStock<row.item.reorder?"ki-report-low-stock":""}>{row.endingStock==null?"—":quantity(row.endingStock)}</span></td>}</tr>)}{rows.length===0&&<tr><td colSpan={tab==="stock"?8:7} className="ki-report-empty-cell">{tab==="stock"?"Chưa có hàng xuất dùng trong kỳ đã chọn.":"Chưa có dịch vụ sử dụng trong kỳ đã chọn."}</td></tr>}</tbody></table></div>
      <footer><span>Hiển thị {rows.length} {tab==="stock"?"mặt hàng":"dịch vụ"} · {report.days[0].label} – {report.days[6].label}</span><span>{tab==="stock"?"Tổng giá trị tham chiếu:":"Tổng giá trị dịch vụ đã dùng:"} <strong>{formatVnd(total)}</strong></span></footer>
    </section>
  </div>;
}

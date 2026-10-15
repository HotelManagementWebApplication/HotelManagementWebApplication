import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, Bell, Package, RotateCcw, SlidersHorizontal, Trash2, X } from "lucide-react";
import type { MovementType } from "../../shared/types/kitchenAccounting";
import "./stockNotifications.css";

export interface StockActivity {
  id: string;
  name: string;
  sku: string;
  occurredAt: string;
  qty: number;
  staff: string;
  movementType: MovementType;
}

const types = {
  RECEIVE: { filter:"Nhập", label:"Nhập kho", tone:"green", Icon:ArrowDownToLine },
  ISSUE: { filter:"Xuất", label:"Xuất kho", tone:"blue", Icon:ArrowUpFromLine },
  WASTE: { filter:"Hao hụt", label:"Hao hụt", tone:"red", Icon:Trash2 },
  RETURN: { filter:"Trả kho", label:"Trả lại kho", tone:"green", Icon:RotateCcw },
  ADJUST: { filter:"Điều chỉnh", label:"Điều chỉnh", tone:"slate", Icon:SlidersHorizontal },
} as const;

const dateKey = (date:Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
function dayLabel(date:Date) {
  const today=new Date();const yesterday=new Date(today.getFullYear(),today.getMonth(),today.getDate()-1);
  const label=dateKey(date)===dateKey(today)?"Hôm nay":dateKey(date)===dateKey(yesterday)?"Hôm qua":date.toLocaleDateString("vi-VN",{weekday:"long"});
  const short=date.toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit",...(date.getFullYear()!==today.getFullYear()?{year:"numeric" as const}:{})});
  return `${label} · ${short}`;
}

export default function StockNotifications({usage,onSeeAll}:{usage:StockActivity[];onSeeAll:()=>void}) {
  const [open,setOpen]=useState(false);
  const [filter,setFilter]=useState<"all"|MovementType>("all");
  const containerRef=useRef<HTMLDivElement>(null);
  const triggerRef=useRef<HTMLButtonElement>(null);
  const closeRef=useRef<HTMLButtonElement>(null);
  const close=()=>{setOpen(false);triggerRef.current?.focus();};
  useEffect(()=>{
    if(!open)return;
    closeRef.current?.focus();
    const outside=(event:PointerEvent)=>{if(!containerRef.current?.contains(event.target as Node))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){setOpen(false);triggerRef.current?.focus();}};
    document.addEventListener("pointerdown",outside);document.addEventListener("keydown",escape);
    return ()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape);};
  },[open]);
  const sorted=[...usage].sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt));
  const rows=sorted.filter(activity=>filter==="all"||activity.movementType===filter);
  const groups=new Map<string,{date:Date;rows:StockActivity[]}>();
  rows.forEach(activity=>{
    const date=new Date(activity.occurredAt);const key=dateKey(date);
    if(!groups.has(key))groups.set(key,{date,rows:[]});
    groups.get(key)!.rows.push(activity);
  });
  const filterTypes:MovementType[]=["RECEIVE","ISSUE","WASTE",...(["RETURN","ADJUST"] as const).filter(type=>usage.some(row=>row.movementType===type))];
  return <div ref={containerRef} className="ki-stock-notifications">
    <button ref={triggerRef} type="button" aria-label="Thông báo biến động kho" aria-haspopup="dialog" aria-expanded={open} aria-controls={open?"stock-notifications":undefined} className={`ki-stock-bell${open?" is-open":""}`} onClick={()=>{setFilter("all");setOpen(value=>!value);}}>
      <Bell size={19}/>{usage.length>0&&<span className="ki-stock-count" aria-hidden="true">{usage.length}</span>}
    </button>
    {open&&<>
      <div className="ki-stock-backdrop" aria-hidden="true" onPointerDown={close}/>
      <div id="stock-notifications" className="ki-stock-popover" role="dialog" aria-label="Thông báo biến động kho">
        <header className="ki-stock-heading"><div><h2>Thông báo kho</h2><p className="ki-stock-subtitle">Biến động tồn kho gần đây</p></div><button ref={closeRef} type="button" aria-label="Đóng thông báo kho" className="ki-stock-close" onClick={close}><X size={17}/></button></header>
        <p className="ki-stock-description">Các lần nhập, xuất và điều chỉnh gần nhất của danh mục đang xem.</p>
        <div className="ki-stock-filters" role="group" aria-label="Lọc loại biến động">
          <button type="button" aria-pressed={filter==="all"} onClick={()=>setFilter("all")}>Tất cả <span>{usage.length}</span></button>
          {filterTypes.map(type=><button type="button" key={type} aria-pressed={filter===type} onClick={()=>setFilter(type)}>{types[type].filter} <span>{usage.filter(row=>row.movementType===type).length}</span></button>)}
        </div>
        <div className="ki-stock-list">
          {[...groups].map(([key,group])=><section key={key} className="ki-stock-day" aria-label={dayLabel(group.date)}>
            <h3>{dayLabel(group.date)}</h3>
            {group.rows.map(activity=>{
              const cfg=types[activity.movementType];const Icon=cfg.Icon;
              return <article className="ki-stock-activity" key={activity.id}>
                <span className={`ki-stock-icon ${cfg.tone}`} aria-hidden="true"><Icon size={19}/></span>
                <div className="ki-stock-item"><h4 title={activity.name}>{activity.name}</h4><div className="ki-stock-meta"><span className="ki-stock-sku">{activity.sku}</span><span title={activity.staff}>{activity.staff}</span><span aria-hidden="true">·</span><time dateTime={activity.occurredAt}>{new Date(activity.occurredAt).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit",hour12:false})}</time></div></div>
                <div className="ki-stock-amount"><strong className={activity.qty<0?"negative":activity.qty>0?"positive":"neutral"}>{activity.qty>0?"+":""}{activity.qty.toLocaleString("vi-VN")}</strong><span className={`ki-stock-type ${cfg.tone}`}>{cfg.label}</span></div>
              </article>;
            })}
          </section>)}
          {rows.length===0&&<div className="ki-stock-empty"><Package size={28}/><p>{usage.length===0?"Chưa có biến động kho.":"Chưa có biến động thuộc loại này."}</p></div>}
        </div>
        <footer className="ki-stock-footer"><button type="button" onClick={()=>{close();onSeeAll();}}>Xem tất cả biến động <ArrowRight size={16}/></button></footer>
      </div>
    </>}
  </div>;
}

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Clock, FolderPlus, Package, Send, Tag, X } from "lucide-react";
import type { CatalogProposal } from "../../shared/api/catalogProposals";
import { formatVnd } from "../../shared/utils/money";
import "./proposalDialog.css";

type Item = { id:string;name:string;price:number;category:string;active:boolean };
const goods = new Set(["food","beverage","room-amenity","Minibar Beverage","Minibar Snack","Kitchen Dry","Kitchen Fresh"]);
const serviceCategories = [["business","Dịch vụ doanh nghiệp"],["inroom","Dịch vụ tại phòng"],["recreation","Giải trí"],["fine-dining","Nhà hàng"],["spa","Spa"],["transport","Vận chuyển"],["laundry","Giặt ủi"],["other","Khác"]];
const stockCategories = [["food","Món ăn"],["beverage","Thức uống"],["room-amenity","Đồ gia dụng"]];
const units = ["giờ","ngày","lần","suất","món","đêm","lượt","chuyến","khách","khách/ngày","bộ","chai","lon","ly","kg","đơn vị","cái","gói","cuộn","tuýp"];

export default function ProposalDialog({items,onClose,onPrice,onCatalog}:{
  items:Item[];onClose:()=>void;
  onPrice:(item:Item,price:number,reason:string)=>Promise<void>;
  onCatalog:(body:CatalogProposal)=>Promise<void>;
}) {
  const ref=useRef<HTMLDialogElement>(null);
  const [step,setStep]=useState<"choose"|"price"|"catalog">("choose");
  const [type,setType]=useState<"price"|"catalog">("price");
  const [kind,setKind]=useState<"SERVICE"|"WAREHOUSE">("SERVICE");
  const [serviceId,setServiceId]=useState("");
  const [name,setName]=useState("");const [sku,setSku]=useState("");
  const [unit,setUnit]=useState("giờ");const [category,setCategory]=useState("business");
  const [threshold,setThreshold]=useState("0");
  const [price,setPrice]=useState("");const [reason,setReason]=useState("");
  const [saving,setSaving]=useState(false);const [error,setError]=useState("");
  useEffect(()=>{ref.current?.showModal();},[]);
  const available=items.filter(item=>kind==="WAREHOUSE"?goods.has(item.category):!goods.has(item.category)&&item.active);
  const selected=available.find(item=>item.id===serviceId)??available[0];
  const amount=Number(price);const delta=selected?amount-selected.price:0;
  const valid=price.trim()!==""&&Number.isFinite(amount)&&amount>=0&&amount<=99999999.99&&reason.trim().length>0
    &&(step==="price"?Boolean(selected)&&amount!==selected?.price:Boolean(name.trim())&&/^[A-Z0-9]{1,10}$/.test(sku));
  const changeKind=(next:"SERVICE"|"WAREHOUSE")=>{setKind(next);setServiceId("");setCategory(next==="SERVICE"?"business":"food");setUnit(next==="SERVICE"?"giờ":"cái");};
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();if(!valid||saving)return;setSaving(true);setError("");
    try {
      if(step==="price"&&selected)await onPrice(selected,amount,reason.trim());
      else await onCatalog({kind,id:sku,name:name.trim(),unit,category,price:amount,reason:reason.trim(),...(kind==="WAREHOUSE"?{safety_threshold:Number(threshold)}:{})});
      onClose();
    }catch(err){setError(err instanceof Error?err.message:"Không thể gửi đề xuất. Vui lòng thử lại.");}
    finally{setSaving(false);}
  };
  return <dialog ref={ref} className="ki-proposal" aria-labelledby="proposal-title" onCancel={event=>{event.preventDefault();if(!saving)onClose();}}>
    <form onSubmit={submit}>
      <header><div>{step!=="choose"&&<span className="ki-proposal-icon">{step==="price"?<Tag size={24}/>:<FolderPlus size={24}/>}</span>}<div>
        <h2 id="proposal-title">{step==="choose"?"Tạo yêu cầu đề xuất mới":step==="price"?"Đề xuất giá dịch vụ / mặt hàng":"Đề xuất thêm danh mục / mặt hàng mới"}</h2>
        <p>{step==="choose"?"Vui lòng chọn loại đề xuất bạn muốn tạo:":step==="price"?"Điền thông tin thay đổi giá và gửi quản lý phê duyệt.":"Điền thông tin danh mục mới và gửi quản lý phê duyệt."}</p>
      </div></div><button type="button" aria-label="Đóng đề xuất" className="ki-proposal-close" disabled={saving} onClick={onClose}><X size={20}/></button></header>
      <section>
        {step==="choose"?<div className="ki-proposal-choices">
          {([{id:"price",title:"Đề xuất giá dịch vụ / mặt hàng",desc:"Thay đổi đơn giá hiện tại cho các dịch vụ hoặc mặt hàng có sẵn.",Icon:Tag},{id:"catalog",title:"Đề xuất thêm danh mục / mặt hàng mới",desc:"Thêm một dịch vụ hoặc mặt hàng vào danh mục kho mới.",Icon:FolderPlus}] as const).map(option=><button type="button" key={option.id} aria-pressed={type===option.id} className={type===option.id?"selected":""} onClick={()=>setType(option.id)}><span className="ki-choice-top"><span className="ki-proposal-icon"><option.Icon size={26}/></span><span className="ki-choice-check">{type===option.id&&<Check size={17}/>}</span></span><strong>{option.title}</strong><p>{option.desc}</p></button>)}
        </div>:<>
          <fieldset><legend>Loại danh mục</legend><div className="ki-proposal-kind">{([ ["SERVICE","Dịch vụ",Tag],["WAREHOUSE",step==="price"?"Mặt hàng":"Danh mục kho",Package] ] as const).map(([value,label,Icon])=><button type="button" key={value} aria-pressed={kind===value} className={kind===value?"selected":""} onClick={()=>changeKind(value)}><Icon size={20}/>{label}</button>)}</div></fieldset>
          {step==="price"?<label>Chọn {kind==="SERVICE"?"dịch vụ":"mặt hàng"}<select value={selected?.id??""} onChange={event=>setServiceId(event.target.value)}><option value="" disabled>Chọn trong danh mục</option>{available.map(item=><option key={item.id} value={item.id}>{item.name} ({item.id})</option>)}</select></label>:<>
            <label>Tên {kind==="SERVICE"?"dịch vụ":"mặt hàng"}<input maxLength={100} value={name} onChange={event=>setName(event.target.value)} placeholder={kind==="SERVICE"?"Nhập tên dịch vụ mới":"Nhập tên mặt hàng mới"}/></label>
            <div className="ki-proposal-grid"><label>Mã danh mục (SKU)<input maxLength={10} value={sku} onChange={event=>setSku(event.target.value.toUpperCase())} placeholder="Ví dụ: SPAFOOT" pattern="[A-Z0-9]{1,10}"/></label><label>Phân loại<select value={category} onChange={event=>setCategory(event.target.value)}>{(kind==="SERVICE"?serviceCategories:stockCategories).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
          </>}
          <div className="ki-proposal-grid">
            {step==="catalog"&&kind==="WAREHOUSE"&&<label>Ngưỡng tồn an toàn<input type="number" min="0" step="1" required value={threshold} onChange={e=>setThreshold(e.target.value)}/></label>}
            {step==="price"?<label>Giá hiện tại<input readOnly value={selected?formatVnd(selected.price):"—"}/></label>:<label>Đơn vị tính<select value={unit} onChange={event=>setUnit(event.target.value)}>{units.map(value=><option key={value}>{value}</option>)}</select></label>}
            <label><span className="ki-price-label">Giá đề xuất {step==="price"&&price!==""&&selected&&<small>{delta>0?"+":""}{formatVnd(delta)}{selected.price>0?` · ${delta>0?"+":""}${(delta/selected.price*100).toFixed(1)}%`:""}</small>}</span><input type="number" min="0" max="99999999.99" step="any" value={price} onChange={event=>setPrice(event.target.value)} placeholder="VND"/></label>
          </div>
          <label><span className="ki-price-label">Lý do <small>{reason.length}/300</small></span><textarea maxLength={300} value={reason} onChange={event=>setReason(event.target.value)} placeholder={step==="price"?"Nêu rõ lý do thay đổi":"Nêu rõ lý do cần thêm mới"}/></label>
          <p className="ki-proposal-note"><Clock size={18}/>{step==="price"?"Giá mới chỉ được áp dụng sau khi quản lý phê duyệt.":"Mục mới chỉ được tạo sau khi quản lý phê duyệt. Hàng trong Kho được quản lý nội bộ."}</p>
        </>}
        {error&&<p role="alert" className="ki-proposal-error">{error}</p>}
      </section>
      <footer>{step!=="choose"&&<button type="button" disabled={saving} onClick={()=>{setStep("choose");setError("");}}>Quay lại</button>}<button type="button" disabled={saving} onClick={onClose}>Hủy bỏ</button>{step==="choose"?<button type="button" className="primary" onClick={()=>setStep(type)}>Tiếp tục <ArrowRight size={18}/></button>:<button type="submit" className="primary" disabled={!valid||saving}><Send size={17}/>{saving?"Đang gửi…":"Gửi quản lý phê duyệt"}</button>}</footer>
    </form>
  </dialog>;
}

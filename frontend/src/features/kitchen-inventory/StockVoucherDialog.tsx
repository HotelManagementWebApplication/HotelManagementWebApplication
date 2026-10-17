import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, FileText, Files, Printer, X } from "lucide-react";
import { defaultVoucherDetails, isOutgoing, movementLabels, printStockVouchers, voucherBody, type VoucherDetails, type VoucherMovement } from "./stockVoucher";
import "./stockVoucher.css";

export default function StockVoucherDialog({movements,onClose}:{movements:VoucherMovement[];onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);
  const [step,setStep]=useState<"choose"|"preview">("choose");
  const [mode,setMode]=useState<"all"|"single">("single");
  const [id,setId]=useState(movements[0]?.id??"");
  const [detailsById,setDetailsById]=useState<Record<string,VoucherDetails>>({});
  const selected=movements.find(row=>row.id===id);
  const details=selected?(detailsById[id]??defaultVoucherDetails(selected)):{sender:"",receiver:"",source:"",destination:"",reference:""};
  const update=(field:keyof VoucherDetails,value:string)=>setDetailsById(previous=>({...previous,[id]:{...details,[field]:value}}));
  useEffect(()=>{ref.current?.showModal();},[]);
  return <dialog ref={ref} className={`ki-voucher-dialog${step==="choose"?" ki-voucher-select-mode":""}`} aria-labelledby="voucher-dialog-title" onCancel={event=>{event.preventDefault();onClose();}}>
    <header><div><h2 id="voucher-dialog-title">Xuất phiếu biến động kho</h2><p>{step==="choose"?"Vui lòng chọn cách xuất phiếu bạn muốn thực hiện:":mode==="all"?`Xuất ${movements.length} phiếu theo danh sách đang lọc. Mỗi biến động một phiếu riêng.`:"Chọn biến động đã ghi nhận, kiểm tra thông tin và in hoặc lưu PDF."}</p></div><button type="button" aria-label="Đóng xuất phiếu" onClick={onClose}><X size={20}/></button></header>
    {step==="choose"?<section className="ki-voucher-choices">
      {([{value:"all",title:"Xuất tất cả biến động",description:`Xuất ${movements.length} biến động trong danh sách đang lọc. Mỗi biến động có phiếu và phần ký riêng.`,Icon:Files},{value:"single",title:"Xuất riêng từng biến động",description:"Chọn một biến động cụ thể để xem, bổ sung thông tin và xuất phiếu.",Icon:FileText}] as const).map(choice=><button type="button" key={choice.value} aria-pressed={mode===choice.value} onClick={()=>setMode(choice.value)}><span className="ki-voucher-choice-top"><span className="ki-voucher-choice-icon"><choice.Icon size={28}/></span><span className="ki-voucher-choice-check">{mode===choice.value&&<Check size={17}/>}</span></span><strong>{choice.title}</strong><p>{choice.description}</p></button>)}
    </section>:<>
      <section className="ki-voucher-controls">
        <label>{mode==="all"?"Xem trước / bổ sung thông tin từng phiếu":"Chọn biến động"}<select value={id} onChange={event=>setId(event.target.value)}>{movements.map(row=><option key={row.id} value={row.id}>BDK-{row.id} · {movementLabels[row.movementType]} · {row.itemName} · {new Date(row.occurredAt).toLocaleString("vi-VN")}</option>)}</select></label>
        {selected&&<><div className="ki-voucher-fields">
          <label>Người xuất / Giao<input maxLength={100} value={details.sender} readOnly={isOutgoing(selected)&&Boolean(selected.staffName)} onChange={event=>update("sender",event.target.value)} placeholder="Họ tên bên giao"/></label>
          <label>Người nhập / Nhận<input maxLength={100} value={details.receiver} readOnly={!isOutgoing(selected)&&Boolean(selected.staffName)} onChange={event=>update("receiver",event.target.value)} placeholder="Họ tên bên nhận"/></label>
          <label>Vị trí nguồn<input maxLength={150} value={details.source} onChange={event=>update("source",event.target.value)}/></label>
          <label>Vị trí đích<input maxLength={150} value={details.destination} onChange={event=>update("destination",event.target.value)}/></label>
        </div><label>Chứng từ liên quan (tùy chọn)<input maxLength={150} value={details.reference} onChange={event=>update("reference",event.target.value)}/></label>
        <p>Tên người thực hiện lấy từ giao dịch đã lưu. Thông tin bổ sung dùng trên bản in này; chỗ ký để người giao và người nhận ký thực tế.</p></>}
      </section>
      {selected?<div className="ki-voucher-preview" dangerouslySetInnerHTML={{__html:voucherBody(selected,details)}}/>:<p>Không có biến động để xuất phiếu.</p>}
    </>}
    <footer>{step==="preview"&&<button type="button" onClick={()=>setStep("choose")}>Quay lại</button>}<button type="button" onClick={onClose}>Hủy bỏ</button>{step==="choose"?<button type="button" className="primary" disabled={movements.length===0} onClick={()=>setStep("preview")}>Tiếp tục <ArrowRight size={17}/></button>:<button type="button" className="primary" disabled={!selected} onClick={()=>{if(selected)printStockVouchers(mode==="all"?movements:[selected],detailsById);}}><Printer size={16}/>{mode==="all"?`In / Lưu PDF ${movements.length} phiếu`:"In / Lưu PDF"}</button>}</footer>
  </dialog>;
}

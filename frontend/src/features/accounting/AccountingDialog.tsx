import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function AccountingDialog({title,description,busy,onClose,children,className=""}:{title:string;description?:string;busy:boolean;onClose:()=>void;children:ReactNode;className?:string}) {
  const ref=useRef<HTMLDialogElement>(null);const titleId=useId();
  useEffect(()=>{ref.current?.showModal();},[]);
  return <dialog ref={ref} className={`acct-dialog ${className}`} aria-labelledby={titleId} onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <header className="acct-dialog-header"><div><span className="acct-eyebrow">NGHIỆP VỤ KẾ TOÁN</span><h2 id={titleId}>{title}</h2>{description&&<p>{description}</p>}</div><button type="button" className="acct-icon-button" aria-label="Đóng biểu mẫu" disabled={busy} onClick={onClose}><X size={19}/></button></header>
    <div className="acct-dialog-body">{children}</div>
  </dialog>;
}

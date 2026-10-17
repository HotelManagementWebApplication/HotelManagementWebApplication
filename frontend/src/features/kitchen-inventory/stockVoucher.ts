import type { MovementType } from "../../shared/types/kitchenAccounting";

export interface VoucherMovement {
  id:string;serviceId:string;itemName:string;unit:string;unitPrice:number;
  movementType:MovementType;qty:number;occurredAt:string;staffName?:string;
  stockBefore?:number|null;stockAfter?:number|null;note?:string;
}
export interface VoucherDetails { sender:string;receiver:string;source:string;destination:string;reference:string }
export const movementLabels:Record<MovementType,string>={RECEIVE:"Nhập kho",ISSUE:"Xuất kho",WASTE:"Hao hụt",RETURN:"Trả lại kho",ADJUST:"Điều chỉnh"};
const escape=(value:unknown)=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!));
const number=(value:number|null|undefined)=>value==null?"—":value.toLocaleString("vi-VN");
export const isOutgoing=(movement:VoucherMovement)=>movement.qty<0;
export function defaultVoucherDetails(movement:VoucherMovement):VoucherDetails {
  const outgoing=isOutgoing(movement);
  return {sender:outgoing?movement.staffName??"":"",receiver:outgoing?"":movement.staffName??"",source:outgoing?"Kho và Dịch vụ":"",destination:outgoing?"":"Kho và Dịch vụ",reference:""};
}

export function voucherBody(movement:VoucherMovement,details:VoucherDetails) {
  const time=new Date(movement.occurredAt);
  return `<article class="stock-voucher-sheet">
    <header><strong>MaM HOTEL</strong><h1>PHIẾU BIẾN ĐỘNG KHO</h1></header>
    <div class="voucher-meta"><p><b>Đơn vị phụ trách:</b> Kho và Dịch vụ</p><p><b>Số phiếu:</b> BDK-${escape(movement.id)} <span><b>Ngày lập:</b> ${escape(time.toLocaleDateString("vi-VN"))}</span></p>
    <p><b>Thời điểm ghi nhận:</b> ${escape(time.toLocaleString("vi-VN"))}</p><p><b>Người thực hiện:</b> ${escape(movement.staffName||"Chưa có thông tin họ tên")}</p>
    <p><b>Loại biến động:</b> ${escape(movementLabels[movement.movementType])}</p><p><b>Vị trí nguồn:</b> ${escape(details.source)||"........................................"} <span><b>Vị trí đích:</b> ${escape(details.destination)||"........................................"}</span></p>
    <p><b>Chứng từ liên quan:</b> ${escape(details.reference)||"............................................................................"}</p><p><b>Lý do:</b> ${escape(movement.note)||"........................................................................................"}</p></div>
    <table><thead><tr><th>Mã / Tên hàng</th><th>ĐVT</th><th>SL biến động</th><th>Đơn giá tham chiếu (đ)</th><th>Tồn trước</th><th>Tồn sau</th></tr></thead><tbody>
    <tr><td>${escape(movement.serviceId)}<br/>${escape(movement.itemName)}</td><td>${escape(movement.unit)}</td><td>${movement.qty>0?"+":""}${escape(number(movement.qty))}</td><td>${escape(number(movement.unitPrice))}</td><td>${escape(number(movement.stockBefore))}</td><td>${escape(number(movement.stockAfter))}</td></tr>
    ${Array.from({length:3},()=>"<tr class=\"voucher-blank\"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>").join("")}</tbody></table>
    <p class="voucher-price-note">Đơn giá tham chiếu theo danh mục tại thời điểm xuất phiếu.</p>
    <section class="voucher-confirmation"><h2>Xác nhận và trách nhiệm</h2><div class="voucher-signatures"><div><strong>Người xuất / Giao</strong><em>(Ký, ghi rõ họ tên)</em><p>${escape(details.sender)}</p></div><div><strong>Người nhập / Nhận</strong><em>(Ký, ghi rõ họ tên)</em><p>${escape(details.receiver)}</p></div></div><p>Thời điểm xác nhận: ........................................................................................</p></section>
  </article>`;
}

export const voucherPrintStyles=`
@page{size:A4 portrait;margin:18mm}*{box-sizing:border-box}body{margin:0;color:#000;background:#fff;font-family:"Times New Roman",serif;font-size:12pt}.stock-voucher-sheet{width:100%;line-height:1.5}.stock-voucher-sheet header{text-align:center;margin-bottom:16px}.stock-voucher-sheet h1{font-size:16pt;margin:4px 0 0;font-weight:bold}.voucher-meta p{margin:5px 0;overflow-wrap:anywhere}.voucher-meta span{margin-left:30px}.stock-voucher-sheet table{width:100%;border-collapse:collapse;margin-top:16px;table-layout:fixed}.stock-voucher-sheet th,.stock-voucher-sheet td{border:1px solid #000;padding:7px 5px;text-align:center;overflow-wrap:anywhere}.stock-voucher-sheet th:first-child{width:29%}.stock-voucher-sheet th:nth-child(2){width:9%}.stock-voucher-sheet th:nth-child(4){width:20%}.stock-voucher-sheet td:first-child{text-align:left}.voucher-blank{height:32px}.voucher-price-note{font-size:10pt;font-style:italic}.voucher-confirmation{border:1px solid #000;padding:12px;margin-top:22px;break-inside:avoid}.voucher-confirmation h2{font-size:12pt;margin:0 0 8px}.voucher-signatures{display:grid;grid-template-columns:1fr 1fr;text-align:center;gap:20px}.voucher-signatures strong,.voucher-signatures em{display:block}.voucher-signatures em{font-size:11pt}.voucher-signatures p{margin:85px 0 10px;min-height:22px;font-weight:bold}.voucher-confirmation>p{font-size:11pt;margin-top:18px}.stock-voucher-sheet table tr{break-inside:avoid}
`;

export function printStockVouchers(movements:VoucherMovement[],detailsById:Record<string,VoucherDetails>) {
  if(movements.length===0)return;
  document.getElementById("stock-voucher-print-frame")?.remove();
  const frame=document.createElement("iframe");
  frame.id="stock-voucher-print-frame";frame.title="In phiếu biến động kho";frame.setAttribute("aria-hidden","true");
  Object.assign(frame.style,{position:"fixed",width:"0",height:"0",border:"0",bottom:"0",left:"0"});
  frame.onload=()=>{frame.contentWindow?.addEventListener("afterprint",()=>frame.remove(),{once:true});frame.contentWindow?.focus();frame.contentWindow?.print();};
  frame.srcdoc=`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Phiếu biến động kho${movements.length===1?` BDK-${escape(movements[0].id)}`:""}</title><style>${voucherPrintStyles}.stock-voucher-sheet{break-after:page}.stock-voucher-sheet:last-child{break-after:auto}</style></head><body>${movements.map(movement=>voucherBody(movement,detailsById[movement.id]??defaultVoucherDetails(movement))).join("")}</body></html>`;
  document.body.appendChild(frame);
}

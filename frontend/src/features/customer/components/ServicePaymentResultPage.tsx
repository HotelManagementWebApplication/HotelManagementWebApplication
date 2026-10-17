import {useEffect,useState} from "react";
import {customerApi} from "../../../shared/api/customer";
import type {HotelServiceBooking} from "../../../shared/types/customer";
import {apiErrorMessage} from "../../../shared/api/client";
export default function ServicePaymentResultPage({onBack}:{onBack:()=>void}){
 const id=Number(new URLSearchParams(window.location.search).get("service_booking_id"));
 const [booking,setBooking]=useState<HotelServiceBooking|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{if(!Number.isSafeInteger(id)||id<1){setError("Mã dịch vụ không hợp lệ.");return;}let active=true;
 const load=()=>customerApi.servicePayment(id).then(row=>{if(active){setBooking(row);setError("");}}).catch(e=>{if(active)setError(apiErrorMessage(e,"Không thể lấy kết quả thanh toán. Đăng nhập để xem đơn của bạn."));});
 void load();const timer=window.setInterval(()=>void load(),3000);return()=>{active=false;window.clearInterval(timer);};},[id]);
 const paid=Number(booking?.paid_amount)>0,expired=booking?.status==="EXPIRED",late=booking?.payment_response==="LATE";
 return <main style={{minHeight:"100vh",background:"#FAF8F5",display:"grid",placeItems:"center",padding:24}}><section style={{maxWidth:560,width:"100%",padding:32,border:"1px solid #E2DDD4",borderRadius:20,background:"#FFF"}}>
 <h1 style={{fontSize:24,fontWeight:700}}>Thanh toán dịch vụ</h1>{error&&<p role="alert" style={{color:"#B91C1C",marginTop:16}}>{error}</p>}
 {booking?<><h2 style={{margin:"16px 0",fontSize:18}}>{booking.service_name??booking.service_id}</h2><p role="status">{paid?"Đã thanh toán và xác nhận đặt dịch vụ.":late?"Thanh toán đến sau hạn giữ chỗ. Vui lòng liên hệ lễ tân để đối soát; lượt đặt chưa được xác nhận.":expired?"Đã hết hạn giữ chỗ; chưa xác nhận đặt dịch vụ.":"Chưa ghi nhận thanh toán thành công."}</p>
 <p style={{marginTop:12}}>Giờ sử dụng: {new Date(booking.scheduled_at).toLocaleString("vi-VN")}{booking.ends_at&&" – "+new Date(booking.ends_at).toLocaleTimeString("vi-VN")}</p>
 <p style={{marginTop:12}}>Giá dịch vụ: {booking.amount_due.toLocaleString("vi-VN")} ₫ · Đã trả: {(booking.paid_amount??0).toLocaleString("vi-VN")} ₫</p>
 {paid&&<p style={{marginTop:12}}>Không hoàn tiền khi khách tự hủy, không đến hoặc không sử dụng. Khoản đã trả được ghi nhận để không thu lại khi checkout.</p>}
 {!paid&&!expired&&!late&&<button disabled={busy} style={{marginTop:20}} onClick={async()=>{setBusy(true);try{const c=await customerApi.payService(id);window.location.assign(c.payment_url);}catch(e){setError(apiErrorMessage(e,"Không thể thanh toán."));}finally{setBusy(false);}}}>Thanh toán lại qua VNPay</button>}</>:!error&&<p>Đang kiểm tra kết quả…</p>}
 <button type="button" onClick={onBack} style={{display:"block",marginTop:24}}>Về trang khách hàng</button></section></main>;
}

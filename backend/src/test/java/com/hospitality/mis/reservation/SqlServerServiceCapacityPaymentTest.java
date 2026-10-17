package com.hospitality.mis.reservation;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.reservation.HotelServiceBookingDatabase;
import com.hospitality.mis.service.billing.VnpayPaymentService;
import com.hospitality.mis.service.reservation.HotelServiceBookingService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

/** Real SQL commands and signed provider callbacks, including parallel shared-pool booking. */
@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}",
 "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
 "spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate",
 "hotel.payment.vnpay.tmn-code=CAPTEST","hotel.payment.vnpay.hash-secret=capacity-test-secret"})
class SqlServerServiceCapacityPaymentTest {
 @Autowired JdbcTemplate jdbc;
 @Autowired HotelServiceBookingDatabase db;
 @Autowired HotelServiceBookingService bookings;
 @Autowired VnpayPaymentService payments;
 @Autowired com.hospitality.mis.service.billing.BillingService billing;
 long guest,owner,reservation,invoice;
 LocalDateTime now,start;
 @BeforeEach void seed(){
  now=businessNow();start=now.plusHours(1).withNano(0);
  jdbc.update("INSERT LoaiPhong(maLoaiPhong,ten,giaTheoNgay) VALUES('CP-TYPE',N'Capacity test',100000)");
  jdbc.update("INSERT Phong(maPhong,maLoaiPhong,trangThai) VALUES('CP-ROOM','CP-TYPE',N'Đang có khách')");
  guest=jdbc.queryForObject("INSERT KhachLuuTru(hoVaTen,soDienThoai,soGiayToTuyThan) OUTPUT INSERTED.maKhachLuuTru VALUES(N'Capacity guest','0997123456','CAPGUEST')",Long.class);
  owner=jdbc.queryForObject("INSERT TaiKhoanKhachHang(maKhachLuuTru,soDienThoai,matKhau) OUTPUT INSERTED.maTaiKhoanKhachHang VALUES(?,'0997123456','unused')",Long.class,guest);
  reservation=jdbc.queryForObject("INSERT PhieuDatPhong(maKhachLuuTru,maTaiKhoanKhachHang,trangThai,hinhThucThue,trangThaiThanhToanCoc) OUTPUT INSERTED.maPhieuDatPhong VALUES(?,?,N'Đã nhận phòng',N'Theo giờ',N'Đã thanh toán')",Long.class,guest,owner);
  jdbc.update("INSERT ChiTietDatPhong(maPhieuDatPhong,maPhong,thoiDiemNhanPhong,thoiDiemTraPhong,thoiDiemTraPhongBanDau,soLuongKhach,trangThai) VALUES(?,'CP-ROOM',?,?,?,2,N'Đang có khách')",reservation,now.minusHours(2),now.plusDays(3),now.plusDays(3));
  jdbc.update("UPDATE PhieuDatPhong SET thoiDiemNhanPhongThucTe=? WHERE maPhieuDatPhong=?",now.minusHours(2),reservation);
  invoice=jdbc.queryForObject("INSERT HoaDon(maPhieuDatPhong,tongTienPhong,soTienPhaiTra,trangThai) OUTPUT INSERTED.maHoaDon VALUES(?,100000,100000,N'Chưa thanh toán')",Long.class,reservation);
  jdbc.update("INSERT DichVu(maDichVu,ten,gia,donViTinh,danhMuc,soLuongTonKho,laTaiNguyen,thoiLuongPhut,donViTaiNguyen) VALUES('CP-STD',N'Giặt thường',100000,N'kg',N'Giặt ủi',2,1,120,N'máy'),('CP-EXP',N'Giặt nhanh',150000,N'kg',N'Giặt ủi',0,1,60,N'máy')");
  jdbc.update("UPDATE DichVu SET maNguonTaiNguyen='CP-STD' WHERE maDichVu='CP-EXP'");
  jdbc.update("INSERT NhanVien(maNhanVien,hoVaTen,matKhau,vaiTro,soDienThoai) VALUES('CP-DESK',N'Desk test','unused',N'Lễ tân','0997123457')");
  customer();
 }
 @AfterEach void cleanup(){
  SecurityContextHolder.clearContext();
  jdbc.update("DELETE ButToanTaiChinh WHERE ghiChu=N'SERVICE_PREPAYMENT' OR maNguoiThucHien='CP-DESK'");
  jdbc.update("DELETE BienLai WHERE maHoaDon=?",invoice);
  jdbc.update("DELETE GiaoDichThanhToan WHERE maHoaDon=?",invoice);
  jdbc.update("DELETE BienDongKhoDichVu WHERE maDichVu IN('CP-STD','CP-EXP')");
  jdbc.update("DELETE DatDichVuKhachSan WHERE maPhieuDatPhong=?",reservation);
  jdbc.update("DELETE HoaDon WHERE maHoaDon=?",invoice);
  jdbc.update("DELETE PhieuDatPhong WHERE maPhieuDatPhong=?",reservation);
  jdbc.update("DELETE TaiKhoanKhachHang WHERE maTaiKhoanKhachHang=?",owner);
  jdbc.update("DELETE KhachLuuTru WHERE maKhachLuuTru=?",guest);
  jdbc.update("DELETE NhatKyKiemSoat WHERE nguoiThucHien='CP-DESK'");jdbc.update("DELETE NhanVien WHERE maNhanVien='CP-DESK'");
  jdbc.update("DELETE Phong WHERE maPhong='CP-ROOM'");jdbc.update("DELETE LoaiPhong WHERE maLoaiPhong='CP-TYPE'");
  jdbc.update("UPDATE DichVu SET maNguonTaiNguyen=NULL WHERE maDichVu='CP-EXP'");jdbc.update("DELETE DichVu WHERE maDichVu IN('CP-STD','CP-EXP')");
 }
 @Test void sharedPoolCountsOneMachinePerBookingAndAllowsAdjacentSlot(){
  var first=book("CP-STD",5,start);book("CP-EXP",8,start.plusMinutes(30));
  assertThat(first.endsAt()).isEqualTo(start.plusMinutes(120));
  assertThat(first.paymentExpiresAt()).isBetween(now.plusMinutes(9),now.plusMinutes(11));
  assertThat(first.status()).isEqualTo("PENDING_PAYMENT");
  assertThat(available(start.plusMinutes(30))).isZero();
  assertThatThrownBy(()->book("CP-EXP",1,start.plusMinutes(45))).isInstanceOf(DomainException.class).extracting("code").isEqualTo("INSUFFICIENT_STOCK");
  assertThat(book("CP-EXP",1,start.plusMinutes(120)).status()).isEqualTo("PENDING_PAYMENT");
 }
 @Test void parallelBookingsAcrossTwoPackagesCannotOversell()throws Exception{
  var gate=new CountDownLatch(1);var results=new ArrayList<Future<String>>();
  try(var pool=Executors.newFixedThreadPool(3)){
   for(int n=0;n<3;n++){String service=n%2==0?"CP-STD":"CP-EXP";results.add(pool.submit(()->{gate.await();customer();try{return book(service,5,start).status();}catch(DomainException e){return e.getCode();}finally{SecurityContextHolder.clearContext();}}));}
   gate.countDown();var values=new ArrayList<String>();for(var f:results)values.add(f.get(30,TimeUnit.SECONDS));
   assertThat(values).containsExactlyInAnyOrder("PENDING_PAYMENT","PENDING_PAYMENT","INSUFFICIENT_STOCK");
  }
 }
 @Test void expiryReleasesCapacityAndLateSignedPaymentDoesNotTakeItBack()throws Exception{
  jdbc.update("UPDATE DichVu SET soLuongTonKho=1 WHERE maDichVu='CP-STD'");
  var first=book("CP-STD",1,start);db.preparePayment(first.id(),owner,now);
  jdbc.update("UPDATE DatDichVuKhachSan SET hanThanhToan=DATEADD(MINUTE,-1,CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time' AS DATETIME2(6))) WHERE maDatDichVuKhachSan=?",first.id());
  book("CP-EXP",1,start);
  assertThat(payments.processCallback(callback(first.id(),"10000000","late-1",true)).paymentSucceeded()).isFalse();
  assertThat(db.find(first.id()).paymentResponse()).isEqualTo("LATE");assertThat(available(start)).isZero();
  assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM GiaoDichThanhToan WHERE maHoaDon=?",Integer.class,invoice)).isZero();
 }
 @Test void signedPaymentReplayAndCustomerCancellationKeepOneCollectionAndNoCheckoutDoubleCharge()throws Exception{
  var first=book("CP-STD",2,start);db.preparePayment(first.id(),owner,now);
  assertThat(payments.processCallback(callback(first.id(),"1","payment-1",true)).paymentSucceeded()).isFalse();
  assertThat(payments.processCallback(callback(first.id(),"20000000","payment-1",false)).paymentSucceeded()).isFalse();
  var valid=callback(first.id(),"20000000","payment-1",true);
  assertThat(payments.processCallback(valid).paymentSucceeded()).isTrue();assertThat(payments.processCallback(valid).paymentSucceeded()).isTrue();
  assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM GiaoDichThanhToan WHERE maHoaDon=?",Integer.class,invoice)).isEqualTo(1);
  assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM BienLai WHERE maHoaDon=?",Integer.class,invoice)).isEqualTo(1);
  assertThat(db.usedTotal(reservation)).isEqualByComparingTo("200000");
  assertThat(bookings.cancelForCustomer(first.id()).status()).isEqualTo("CANCELLED");
  assertThat(db.usedTotal(reservation)).isEqualByComparingTo("200000");
  assertThat(jdbc.queryForObject("SELECT dbo.fnTinhTongTienDichVu(?)",java.math.BigDecimal.class,reservation)).isEqualByComparingTo("200000");
  SecurityContextHolder.getContext().setAuthentication(new org.springframework.security.authentication.TestingAuthenticationToken("CP-DESK","unused","ROLE_FRONT_DESK"));
  var checkout=billing.checkOut(reservation,businessNow(),com.hospitality.mis.entity.billing.PaymentMethod.CASH,"CP-DESK");
  assertThat(checkout.serviceTotal()).isEqualByComparingTo("200000");
  assertThat(checkout.payable()).isEqualByComparingTo(checkout.roomTotal().divide(java.math.BigDecimal.valueOf(1000)).setScale(0,java.math.RoundingMode.HALF_UP).multiply(java.math.BigDecimal.valueOf(1000)));
  assertThat(jdbc.queryForObject("SELECT soTienPhaiTra FROM HoaDon WHERE maHoaDon=?",java.math.BigDecimal.class,invoice)).isEqualByComparingTo(checkout.payable());
 }
 @Test void durationChangesPreserveExistingBookingEndAndCapacityCannotDropBelowHolds(){
  var first=book("CP-STD",1,start);book("CP-EXP",1,start);
  assertThatThrownBy(()->jdbc.update("EXEC uspCauHinhDichVu 'CP-EXP',1,180,'KITCHEN',N'test'")).isInstanceOf(org.springframework.dao.DataAccessException.class);
  jdbc.update("EXEC uspCauHinhDichVu 'CP-EXP',2,180,'KITCHEN',N'test'");
  assertThat(db.find(first.id()).endsAt()).isEqualTo(start.plusMinutes(120));
  assertThat(book("CP-EXP",1,start.plusHours(3)).endsAt()).isEqualTo(start.plusHours(6));
  assertThatThrownBy(()->db.preparePayment(first.id(),owner+999,now)).isInstanceOf(DomainException.class);
 }
 private HotelServiceBookingService.Response book(String id,int qty,LocalDateTime at){return bookings.bookForCustomer(new HotelServiceBookingService.Request(reservation,"CP-ROOM",id,at,qty,null,null),UUID.randomUUID().toString());}
 private static LocalDateTime businessNow(){return LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));}
 private long available(LocalDateTime at){return jdbc.queryForObject("SELECT conLai FROM fnKhaDungDichVu(?,?) WHERE maDichVu='CP-EXP'",Long.class,at,at.plusMinutes(1));}
 private void customer(){var jwt=Jwt.withTokenValue("capacity-test").header("alg","none").subject(""+owner).claim("principal_type","CUSTOMER").claim("principal_id",""+owner).build();SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt,List.of(new SimpleGrantedAuthority("ROLE_CUSTOMER")),""+owner));}
 private Map<String,String> callback(long id,String amount,String txn,boolean signed)throws Exception{
  var q=new TreeMap<String,String>();q.put("vnp_TxnRef","SVC-"+id);q.put("vnp_Amount",amount);q.put("vnp_TmnCode","CAPTEST");q.put("vnp_ResponseCode","00");q.put("vnp_TransactionStatus","00");q.put("vnp_TransactionNo",txn);
  String canonical=q.entrySet().stream().map(e->URLEncoder.encode(e.getKey(),StandardCharsets.UTF_8)+"="+URLEncoder.encode(e.getValue(),StandardCharsets.UTF_8)).reduce((a,b)->a+"&"+b).orElse("");
  var mac=Mac.getInstance("HmacSHA512");mac.init(new SecretKeySpec("capacity-test-secret".getBytes(StandardCharsets.UTF_8),"HmacSHA512"));q.put("vnp_SecureHash",signed?HexFormat.of().formatHex(mac.doFinal(canonical.getBytes(StandardCharsets.UTF_8))):"invalid");return q;
 }
}

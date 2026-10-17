package com.hospitality.mis.reservation;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.reservation.ReservationDtos;
import com.hospitality.mis.entity.billing.PaymentMethod;
import com.hospitality.mis.entity.reservation.DepositPaymentStatus;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import static org.assertj.core.api.Assertions.*;

/** Real SQL Server transactions exercise room allocation separately from actual cash receipt. */
class RoomDepositWorkflowTest extends ReservationSqlFixture {
    @Autowired com.hospitality.mis.dao.reservation.ReservationDatabase reservationDatabase;
    @Autowired com.hospitality.mis.dao.billing.DepositPaymentDatabase paymentDatabase;
    @Autowired com.hospitality.mis.dao.reservation.HotelServiceBookingDatabase serviceDatabase;
    @Autowired org.springframework.context.ApplicationEventPublisher events;
    private ReservationDtos.Response hold(LocalDateTime from, LocalDateTime to) {
        return service.create(new ReservationDtos.CreateRequest(guest,"HCT-FD",null,
                ReservationDtos.RentalType.PACKAGE,List.of(new ReservationDtos.RoomStay("HCT-R1",from,to)),key()),"HCT-FD");
    }
    private int paymentCount() { return jdbc.queryForObject("SELECT COUNT(*) FROM GiaoDichThanhToan t JOIN HoaDon h ON h.maHoaDon=t.maHoaDon JOIN PhieuDatPhong b ON b.maPhieuDatPhong=h.maPhieuDatPhong WHERE b.maKhachLuuTru=?",Integer.class,guest); }
    private boolean available(LocalDateTime from,LocalDateTime to,LocalDateTime at) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT dbo.fnKiemTraPhongTrong(N'HCT-R1',?,?,?,NULL)",Boolean.class,from,to,at));
    }
    @Test void creatingHoldDoesNotInventCashAndReceivingOnceSurvivesExpiryScan() {
        var pending=hold(now.plusDays(2),now.plusDays(3));
        assertThat(pending.status()).isEqualTo(ReservationStatus.PENDING_PAYMENT);
        assertThat(pending.depositPaymentStatus()).isEqualTo(DepositPaymentStatus.PENDING);
        assertThat(pending.depositPaymentExpiresAt()).isEqualTo(now.plusMinutes(10));
        assertThat(paymentCount()).isZero();
        assertThat(jdbc.queryForObject("SELECT trangThai FROM ChiTietDatPhong WHERE maPhieuDatPhong=?",String.class,pending.id())).isEqualTo("Giữ tạm phòng");
        assertThat(available(now.plusDays(2),now.plusDays(3),now)).isFalse();
        String receiptKey=key();
        var paid=service.receiveDeposit(pending.id(),"HCT-FD",receiptKey);
        assertThat(paid.status()).isEqualTo(ReservationStatus.DEPOSIT_PAID);
        assertThat(paid.depositPaymentStatus()).isEqualTo(DepositPaymentStatus.PAID);
        service.receiveDeposit(pending.id(),"HCT-FD",receiptKey);
        assertThat(paymentCount()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM BienLai b JOIN HoaDon h ON h.maHoaDon=b.maHoaDon WHERE h.maPhieuDatPhong=?",Integer.class,pending.id())).isEqualTo(1);
        jdbc.update("EXEC dbo.uspHetHanGiuCoc ?",now.plusMinutes(11));
        assertThat(service.get(pending.id()).status()).isEqualTo(ReservationStatus.DEPOSIT_PAID);
        assertThat(available(now.plusDays(2),now.plusDays(3),now.plusMinutes(11))).isFalse();
    }
    @Test void deadlineReleasesInventoryBeforeSweepAndRejectsStaleReceipt() {
        var pending=hold(now.plusDays(2),now.plusDays(3));
        clock(now.plusMinutes(10));
        assertThat(available(now.plusDays(2),now.plusDays(3),now.plusMinutes(10))).isTrue();
        assertThatThrownBy(()->service.receiveDeposit(pending.id(),"HCT-FD",key())).isInstanceOf(DomainException.class).hasMessageContaining("hết hạn");
        assertThat(paymentCount()).isZero();
        var replacement=hold(now.plusDays(2),now.plusDays(3));
        service.receiveDeposit(replacement.id(),"HCT-FD",key());
        jdbc.update("EXEC dbo.uspHetHanGiuCoc ?",now.plusMinutes(10));
        assertThat(service.get(pending.id()).depositPaymentStatus()).isEqualTo(DepositPaymentStatus.EXPIRED);
        assertThat(service.get(replacement.id()).status()).isEqualTo(ReservationStatus.DEPOSIT_PAID);
        assertThat(paymentCount()).isEqualTo(1);
    }
    @Test void simultaneousRequestsCannotBothHoldTheSameRoom() throws Exception {
        var gate=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            Callable<Boolean> attempt=()->{ actor("HCT-FD","FRONT_DESK");gate.await();try { hold(now.plusDays(2),now.plusDays(3));return true; } catch(DomainException conflict) { assertThat(conflict.getCode()).isEqualTo("OVERBOOKING");return false; } finally { org.springframework.security.core.context.SecurityContextHolder.clearContext(); } };
            var first=pool.submit(attempt);var second=pool.submit(attempt);gate.countDown();
            assertThat(List.of(first.get(30,TimeUnit.SECONDS),second.get(30,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
        }
        assertThat(paymentCount()).isZero();
    }
    @Test void noonCheckoutAllowsTwoPmBookingButCheckInWaitsForCheckoutAndCleaning() {
        var current=create(now.minusDays(1),24,false,"HCT-R1");
        service.checkIn(current.id(),new ReservationDtos.CheckInRequest(now.minusDays(1)),"HCT-FD",key());
        assertThatThrownBy(()->hold(now.minusMinutes(30),now.plusDays(1))).isInstanceOf(DomainException.class);
        var next=hold(now.plusHours(2),now.plusDays(1));
        service.receiveDeposit(next.id(),"HCT-FD",key());
        assertThat(jdbc.queryForObject("SELECT trangThai FROM Phong WHERE maPhong=N'HCT-R1'",String.class)).isEqualTo("Đang có khách");
        assertThatThrownBy(()->service.checkIn(next.id(),new ReservationDtos.CheckInRequest(now.plusHours(2)),"HCT-FD",key())).isInstanceOf(DomainException.class).hasMessageContaining("chưa sẵn sàng");
        service.checkOut(current.id(),new ReservationDtos.CheckOutRequest(now,PaymentMethod.CASH),"HCT-FD",key());
        assertThatThrownBy(()->service.checkIn(next.id(),new ReservationDtos.CheckInRequest(now.plusHours(2)),"HCT-FD",key())).isInstanceOf(DomainException.class).hasMessageContaining("chưa sẵn sàng");
        jdbc.update("UPDATE Phong SET trangThai=N'Sẵn sàng' WHERE maPhong=N'HCT-R1'");
        clock(now.plusHours(2));
        assertThat(service.checkIn(next.id(),new ReservationDtos.CheckInRequest(now.plusHours(2)),"HCT-FD",key()).status()).isEqualTo(ReservationStatus.CHECKED_IN);
    }
    @Test void draftRoomLineDoesNotClaimInventory() {
        jdbc.update("INSERT PhieuDatPhong(maKhachLuuTru,maNhanVien,khoaChongTrung) VALUES(?,N'HCT-FD',N'HCT-DRAFT')",guest);
        long id=jdbc.queryForObject("SELECT maPhieuDatPhong FROM PhieuDatPhong WHERE khoaChongTrung=N'HCT-DRAFT'",Long.class);
        jdbc.update("INSERT ChiTietDatPhong(maPhieuDatPhong,maPhong,thoiDiemNhanPhong,thoiDiemTraPhong,thoiDiemTraPhongBanDau) VALUES(?,N'HCT-R1',?,?,?)",id,now.plusDays(2),now.plusDays(3),now.plusDays(3));
        assertThat(jdbc.queryForObject("SELECT trangThai FROM ChiTietDatPhong WHERE maPhieuDatPhong=?",String.class,id)).isEqualTo("Bản nháp");
        assertThat(available(now.plusDays(2),now.plusDays(3),now)).isTrue();
    }
    @Test void confirmedBookingKeepsItsRoomPriceAfterCatalogPriceChanges() {
        var pending=hold(now.plusDays(2),now.plusDays(3));
        service.receiveDeposit(pending.id(),"HCT-FD",key());
        assertThat(jdbc.queryForObject("SELECT tienDatCoc FROM PhieuDatPhong WHERE maPhieuDatPhong=?",java.math.BigDecimal.class,pending.id()))
                .isEqualByComparingTo("1200000.00");

        jdbc.update("UPDATE LoaiPhong SET giaTheoNgay=4800000,giaTheoGio=200000 WHERE maLoaiPhong=N'HCT-T'");

        var quoted=jdbc.queryForMap("SELECT giaTheoNgay,tongTienPhongDuKien FROM vwDatPhongChiTiet WHERE maPhieuDatPhong=?",pending.id());
        assertThat((java.math.BigDecimal)quoted.get("giaTheoNgay")).isEqualByComparingTo("2400000.00");
        assertThat((java.math.BigDecimal)quoted.get("tongTienPhongDuKien")).isEqualByComparingTo("2400000.00");

        clock(now.plusDays(2));
        service.checkIn(pending.id(),new ReservationDtos.CheckInRequest(now.plusDays(2)),"HCT-FD",key());
        clock(now.plusDays(3));
        service.checkOut(pending.id(),new ReservationDtos.CheckOutRequest(now.plusDays(3),PaymentMethod.CASH),"HCT-FD",key());
        assertThat(jdbc.queryForObject("SELECT tongTienPhong FROM HoaDon WHERE maPhieuDatPhong=?",java.math.BigDecimal.class,pending.id()))
                .isEqualByComparingTo("2400000.00");
    }
    @Test void lateVerifiedOnlinePaymentCannotTakeAReplacementBookingAndIsVisibleForReview() throws Exception {
        jdbc.update("INSERT TaiKhoanKhachHang(maKhachLuuTru,soDienThoai,matKhau) VALUES(?,N'0901111112',N'fixture-only')",guest);
        long customer=jdbc.queryForObject("SELECT maTaiKhoanKhachHang FROM TaiKhoanKhachHang WHERE maKhachLuuTru=?",Long.class,guest);
        long online=reservationDatabase.create(guest,null,customer,ReservationDtos.RentalType.PACKAGE,null,key(),
                List.of(new ReservationDtos.RoomStay("HCT-R1",now.plusDays(2),now.plusDays(3))),"customer:"+customer,now,
                ReservationStatus.PENDING_PAYMENT,com.hospitality.mis.entity.reservation.CustomerPaymentMethod.VNPAY,
                "HCT-CODE",now.plusMinutes(10),null,"DIRECT");
        var attempt=paymentDatabase.create(online,customer,"HCT-LATE-"+key(),"customer:"+customer,now);
        clock(now.plusMinutes(11));
        var replacement=hold(now.plusDays(2),now.plusDays(3));
        service.receiveDeposit(replacement.id(),"HCT-FD",key());
        var gateway=new com.hospitality.mis.service.billing.VnpayPaymentService(paymentDatabase,serviceDatabase,events,
                "WORKFLOW","workflow-secret","https://sandbox.vnpayment.vn/paymentv2/vpcpay.html","http://localhost/return");
        org.springframework.test.util.ReflectionTestUtils.setField(gateway,"clock",java.time.Clock.fixed(
                now.plusMinutes(11).atZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).toInstant(),java.time.ZoneId.of("Asia/Ho_Chi_Minh")));
        var callback=new java.util.TreeMap<String,String>();
        callback.put("vnp_TmnCode","WORKFLOW");callback.put("vnp_TxnRef",attempt.merchantReference());
        callback.put("vnp_Amount",attempt.amount().multiply(java.math.BigDecimal.valueOf(100)).toBigIntegerExact().toString());
        callback.put("vnp_ResponseCode","00");callback.put("vnp_TransactionStatus","00");
        callback.put("vnp_TransactionNo","HCT-LATE-PAYMENT");callback.put("vnp_BankCode","NCB");callback.put("vnp_CardType","ATM");
        String canonical=callback.entrySet().stream().map(entry->java.net.URLEncoder.encode(entry.getKey(),java.nio.charset.StandardCharsets.US_ASCII)+"="+java.net.URLEncoder.encode(entry.getValue(),java.nio.charset.StandardCharsets.US_ASCII)).collect(java.util.stream.Collectors.joining("&"));
        var mac=javax.crypto.Mac.getInstance("HmacSHA512");mac.init(new javax.crypto.spec.SecretKeySpec("workflow-secret".getBytes(java.nio.charset.StandardCharsets.UTF_8),"HmacSHA512"));
        callback.put("vnp_SecureHash",java.util.HexFormat.of().formatHex(mac.doFinal(canonical.getBytes(java.nio.charset.StandardCharsets.UTF_8))));
        assertThat(gateway.processCallback(callback).paymentSucceeded()).isFalse();
        assertThat(gateway.processCallback(callback).paymentSucceeded()).isFalse();
        assertThat(paymentDatabase.find(attempt.merchantReference()).status()).isEqualTo(com.hospitality.mis.entity.billing.VnpayPaymentStatus.REQUIRES_REVIEW);
        assertThat(service.get(online).depositPaymentStatus()).isEqualTo(DepositPaymentStatus.PENDING);
        assertThat(service.get(replacement.id()).status()).isEqualTo(ReservationStatus.DEPOSIT_PAID);
        assertThat(paymentCount()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM HangDoiThongBao WHERE khoaChongLap=?",Integer.class,"VNPAY-REVIEW:"+attempt.id())).isEqualTo(1);
    }
}

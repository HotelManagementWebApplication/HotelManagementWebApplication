package com.hospitality.mis.billing;
import com.hospitality.mis.reservation.ReservationSqlFixture;
import com.hospitality.mis.dto.reservation.ReservationDtos;
import com.hospitality.mis.entity.billing.PaymentMethod;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class BillingP0CorrectnessTest extends ReservationSqlFixture {
    @Test void twoRoomsExtensionLateFeeServiceAndDepositAreCalculatedOnce(){
        var booking=create(now,24,false,"HCT-R1","HCT-R2");
        service.checkIn(booking.id(),new ReservationDtos.CheckInRequest(now),"HCT-FD",key());
        service.extend(booking.id(),new ReservationDtos.ExtendRequest(now.plusHours(26)),"HCT-FD",key());
        jdbc.update("INSERT DichVu(maDichVu,ten,gia) VALUES(N'HCT-S',N'Snapshot service',200)");
        jdbc.update("INSERT SuDungDichVu(maPhieuDatPhong,maDichVu,ngaySuDung,soLuong,donGia) VALUES(?,N'HCT-S','2031-01-01',2,100)",booking.id());
        var result=service.checkOut(booking.id(),new ReservationDtos.CheckOutRequest(now.plusHours(26).plusMinutes(21),PaymentMethod.CASH),"HCT-FD",key());
        assertThat(result.roomTotal()).isEqualByComparingTo("4800000");assertThat(result.extensionTotal()).isEqualByComparingTo("400000");
        assertThat(result.lateSurcharge()).isEqualByComparingTo("960000");assertThat(result.serviceTotal()).isEqualByComparingTo("200");
        assertThat(result.payable()).isEqualByComparingTo("3760000");
    }
    @Test void hourlyMultiRoomBookedTwentyFourHoursNeverCountsVipStay(){
        var booking=create(now,24,true,"HCT-R1","HCT-R2");
        service.checkIn(booking.id(),new ReservationDtos.CheckInRequest(now),"HCT-FD",key());
        service.checkOut(booking.id(),new ReservationDtos.CheckOutRequest(now.plusHours(20),PaymentMethod.CASH),"HCT-FD",key());
        assertThat(jdbc.queryForObject("SELECT soLanLuuTruHoanThanh FROM KhachLuuTru WHERE maKhachLuuTru=?",Integer.class,guest)).isZero();
    }
    @Test void packageCountsOneStayWithoutTwentyFourHourThreshold(){
        var booking=create(now,23,false,"HCT-R1");service.checkIn(booking.id(),new ReservationDtos.CheckInRequest(now),"HCT-FD",key());
        service.checkOut(booking.id(),new ReservationDtos.CheckOutRequest(now.plusHours(25),PaymentMethod.CASH),"HCT-FD",key());
        assertThat(jdbc.queryForObject("SELECT soLanLuuTruHoanThanh FROM KhachLuuTru WHERE maKhachLuuTru=?",Integer.class,guest)).isEqualTo(1);
    }
    @Test void approvedAdjustmentIsAppendOnlyAndReplaysWithoutConsumingAgain(){
        var booking=create(now.plusDays(4),24,false,"HCT-R1");var invoice=billing.getByReservation(booking.id());
        var approval=approvals.request("HCT-FD","BILLING_ADJUSTMENT",invoice.id().toString(),"delta=125000|reason=manual correction",new java.math.BigDecimal("125000"),"approved",key());
        actor("HCT-DIR","DIRECTOR");approvals.approve(approval.id(),"HCT-DIR");actor("HCT-FD","FRONT_DESK");
        String key="hct-adjust";var first=billing.adjust(invoice.id(),new java.math.BigDecimal("125000"),"manual correction","HCT-FD",key);
        assertThat(billing.adjust(invoice.id(),new java.math.BigDecimal("125000"),"manual correction","HCT-FD",key)).isEqualTo(first);
        assertThat(first.adjustmentTotal()).isEqualByComparingTo("125000");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM DieuChinhHoaDon WHERE maHoaDon=?",Integer.class,invoice.id())).isEqualTo(1);
        assertThatThrownBy(()->billing.adjust(invoice.id(),new java.math.BigDecimal("125001"),"manual correction","HCT-FD",key)).extracting("code").isEqualTo("IDEMPOTENCY_MISMATCH");
    }
}

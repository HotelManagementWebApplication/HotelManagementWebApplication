package com.hospitality.mis.reservation;

import com.hospitality.mis.dto.reservation.ReservationDtos;
import com.hospitality.mis.entity.billing.PaymentMethod;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

class ReservationServiceSqlTest extends ReservationSqlFixture {
    @Test void bookingKeepsSharedGuestAndDepositHasOnePaymentReceiptAndAudit(){
        var booking=create(now.plusDays(4),24,false,"HCT-R1");
        assertThat(booking.guestId()).isEqualTo(guest);assertThat(booking.employeeId()).isEqualTo("HCT-FD");
        var invoice=billing.getByReservation(booking.id());
        assertThat(invoice.deposit()).isEqualByComparingTo("1200000");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM GiaoDichThanhToan WHERE maHoaDon=?",Integer.class,invoice.id())).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM BienLai WHERE maHoaDon=?",Integer.class,invoice.id())).isEqualTo(1);
        assertThat(service.timeline(booking.id())).extracting(r->r.action()).contains("RESERVATION_CREATED","DEPOSIT_PAYMENT_RECORDED");
    }

    @Test void staggeredMultiRoomSubTwentyFourHourDetailsDoNotQualifyForVipCount(){
        var request = new ReservationDtos.CreateRequest(
            guest,
            "HCT-FD",
            BigDecimal.valueOf(100000L * (12 + 15) / 2),
            ReservationDtos.RentalType.HOURLY,
            List.of(
                new ReservationDtos.RoomStay("HCT-R1", now, now.plusHours(12)),
                new ReservationDtos.RoomStay("HCT-R2", now.plusHours(15), now.plusHours(30))
            ),
            key()
        );
        var booking = service.create(request, "HCT-FD");
        // Seed a checked-in split-stay snapshot: the booking-wide check-in command
        // cannot check in disjoint intervals together. The behavior under test is
        // the real checkout procedure's VIP calculation, not the check-in command.
        jdbc.update("UPDATE PhieuDatPhong SET trangThai=N'Đã nhận phòng',thoiDiemNhanPhongThucTe=? WHERE maPhieuDatPhong=?",now,booking.id());
        jdbc.update("UPDATE ChiTietDatPhong SET trangThai=N'Đang có khách' WHERE maPhieuDatPhong=?",booking.id());
        jdbc.update("UPDATE Phong SET trangThai=N'Đang có khách' WHERE maPhong IN(N'HCT-R1',N'HCT-R2')");
        service.checkOut(booking.id(), new ReservationDtos.CheckOutRequest(now.plusHours(30), PaymentMethod.CASH), "HCT-FD", key());
        assertThat(jdbc.queryForObject("SELECT soLanLuuTruHoanThanh FROM KhachLuuTru WHERE maKhachLuuTru=?", Integer.class, guest)).isZero();
    }

    @ParameterizedTest @ValueSource(ints={3,22,24,48,72})
    void hourlyBookingsNeverQualifyRegardlessOfDuration(int hours){
        var request = new ReservationDtos.CreateRequest(
            guest,
            "HCT-FD",
            BigDecimal.valueOf(100000L * (hours + 3) / 2),
            ReservationDtos.RentalType.HOURLY,
            List.of(
                new ReservationDtos.RoomStay("HCT-R1", now, now.plusHours(hours)),
                new ReservationDtos.RoomStay("HCT-R2", now, now.plusHours(3))
            ),
            key()
        );
        var booking = service.create(request, "HCT-FD");
        service.checkIn(booking.id(), new ReservationDtos.CheckInRequest(now), "HCT-FD", key());
        service.checkOut(booking.id(), new ReservationDtos.CheckOutRequest(now.plusHours(hours), PaymentMethod.CASH), "HCT-FD", key());
        assertThat(jdbc.queryForObject("SELECT soLanLuuTruHoanThanh FROM KhachLuuTru WHERE maKhachLuuTru=?", Integer.class, guest)).isZero();
    }

    @Test void standardPackageFromFourteenToNextDayNoonCountsOneStay(){
        var start=now.withHour(14);
        var booking=create(start,22,false,"HCT-R1");
        service.checkIn(booking.id(),new ReservationDtos.CheckInRequest(start),"HCT-FD",key());
        service.checkOut(booking.id(),new ReservationDtos.CheckOutRequest(start.plusHours(22),PaymentMethod.CASH),"HCT-FD",key());
        assertThat(jdbc.queryForObject("SELECT soLanLuuTruHoanThanh FROM KhachLuuTru WHERE maKhachLuuTru=?",Integer.class,guest)).isEqualTo(1);
    }

    @ParameterizedTest @ValueSource(ints={22,46,70})
    void multiRoomMultiNightPackagesAndCheckoutReplayStillCountOneBooking(int hours){
        var start=now.withHour(14);
        var booking=create(start,hours,false,"HCT-R1","HCT-R2");
        service.checkIn(booking.id(),new ReservationDtos.CheckInRequest(start),"HCT-FD",key());
        var request=new ReservationDtos.CheckOutRequest(start.plusHours(hours),PaymentMethod.CASH);
        var checkoutKey=key();
        service.checkOut(booking.id(),request,"HCT-FD",checkoutKey);
        service.checkOut(booking.id(),request,"HCT-FD",checkoutKey);
        assertThat(jdbc.queryForObject("SELECT soLanLuuTruHoanThanh FROM KhachLuuTru WHERE maKhachLuuTru=?",Integer.class,guest)).isEqualTo(1);
    }

    @Test void lateArrivalAndEarlyDepartureDoNotChangeConfirmedPackageProduct(){
        var start=now.withHour(14);
        var booking=create(start,22,false,"HCT-R1");
        service.checkIn(booking.id(),new ReservationDtos.CheckInRequest(start.plusHours(2)),"HCT-FD",key());
        service.checkOut(booking.id(),new ReservationDtos.CheckOutRequest(start.plusHours(20),PaymentMethod.CASH),"HCT-FD",key());
        assertThat(jdbc.queryForObject("SELECT soLanLuuTruHoanThanh FROM KhachLuuTru WHERE maKhachLuuTru=?",Integer.class,guest)).isEqualTo(1);
    }

    @Test void tenthCompletedStandardPackagePromotesGuestToSilver(){
        jdbc.update("UPDATE KhachLuuTru SET soLanLuuTruHoanThanh=9 WHERE maKhachLuuTru=?",guest);
        var start=now.withHour(14);
        var booking=create(start,22,false,"HCT-R1");
        assertThat(jdbc.queryForObject("SELECT soLanLuuTruHoanThanh FROM KhachLuuTru WHERE maKhachLuuTru=?",Integer.class,guest)).isEqualTo(9);
        service.checkIn(booking.id(),new ReservationDtos.CheckInRequest(start),"HCT-FD",key());
        assertThat(jdbc.queryForObject("SELECT soLanLuuTruHoanThanh FROM KhachLuuTru WHERE maKhachLuuTru=?",Integer.class,guest)).isEqualTo(9);
        service.checkOut(booking.id(),new ReservationDtos.CheckOutRequest(start.plusHours(22),PaymentMethod.CASH),"HCT-FD",key());
        assertThat(jdbc.queryForObject("SELECT soLanLuuTruHoanThanh FROM KhachLuuTru WHERE maKhachLuuTru=?",Integer.class,guest)).isEqualTo(10);
        assertThat(jdbc.queryForObject("SELECT hangThanhVien FROM KhachLuuTru WHERE maKhachLuuTru=?",String.class,guest)).isEqualTo("Bạc");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM LichSuHangThanhVien WHERE maKhachLuuTru=? AND lyDo=N'COMPLETED_STAY'",Integer.class,guest)).isEqualTo(1);
    }
}

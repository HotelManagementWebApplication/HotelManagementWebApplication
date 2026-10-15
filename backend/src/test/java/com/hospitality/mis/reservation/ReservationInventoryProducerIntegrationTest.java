package com.hospitality.mis.reservation;
import com.hospitality.mis.dto.reservation.ReservationDtos;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class ReservationInventoryProducerIntegrationTest extends ReservationSqlFixture {
    @org.springframework.beans.factory.annotation.Autowired
    com.hospitality.mis.service.reservation.HotelServiceBookingService serviceBookings;

    @Test void newResourceCatalogUsesTheSameBookingPolicyFromFrontDeskWithoutLosingStock() {
        var booking=create(now,24,false,"HCT-R1");
        service.checkIn(booking.id(),new ReservationDtos.CheckInRequest(now),"HCT-FD",key());
        jdbc.update("INSERT DichVu(maDichVu,ten,gia,soLuongTonKho,danhMuc) VALUES(N'HCT-S',N'Tài nguyên mới',100,0,N'Giải trí')");
        jdbc.update("INSERT CauHinhLichDichVu(maDichVu,congSuat,donViKhaDung,soPhutMoiLuot,cachTinh,truTonKhiSuDung) VALUES(N'HCT-S',1,N'sân',60,N'Theo thời lượng',0)");
        var original=org.springframework.test.util.ReflectionTestUtils.getField(serviceBookings,"clock");
        try {
            org.springframework.test.util.ReflectionTestUtils.setField(serviceBookings,"clock",java.time.Clock.fixed(now.atZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).toInstant(),java.time.ZoneId.of("Asia/Ho_Chi_Minh")));
            service.addService(booking.id(),new ReservationDtos.AddServiceRequest("HCT-S",2,now),"HCT-FD",key());
            assertThat(jdbc.queryForObject("SELECT soLuongTonKho FROM DichVu WHERE maDichVu=N'HCT-S'",Integer.class)).isZero();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM BienDongKhoDichVu WHERE maDichVu=N'HCT-S'",Integer.class)).isZero();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM DatDichVuKhachSan WHERE maPhieuDatPhong=? AND trangThai=N'Đã sử dụng'",Integer.class,booking.id())).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM SuDungDichVu WHERE maPhieuDatPhong=?",Integer.class,booking.id())).isZero();
        } finally {
            org.springframework.test.util.ReflectionTestUtils.setField(serviceBookings,"clock",original);
            jdbc.update("DELETE DatDichVuKhachSan WHERE maDichVu=N'HCT-S'");
            jdbc.update("DELETE CauHinhLichDichVu WHERE maDichVu=N'HCT-S'");
        }
    }
    @Test void replayWritesOneServiceSnapshotAndIssueAndInsufficientStockRollsBack(){
        var booking=create(now,24,false,"HCT-R1");service.checkIn(booking.id(),new ReservationDtos.CheckInRequest(now),"HCT-FD",key());
        jdbc.update("INSERT DichVu(maDichVu,ten,gia,soLuongTonKho) VALUES(N'HCT-S',N'Minibar',10,5)");
        var request=new ReservationDtos.AddServiceRequest("HCT-S",2,now);String key=key();
        var first=service.addService(booking.id(),request,"HCT-FD",key);
        assertThat(service.addService(booking.id(),request,"HCT-FD",key)).isEqualTo(first);
        assertThat(jdbc.queryForObject("SELECT soLuongTonKho FROM DichVu WHERE maDichVu=N'HCT-S'",Integer.class)).isEqualTo(3);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM BienDongKhoDichVu WHERE maDichVu=N'HCT-S' AND loai=N'Xuất kho'",Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT soLuong FROM SuDungDichVu WHERE maPhieuDatPhong=?",Integer.class,booking.id())).isEqualTo(2);
        assertThatThrownBy(()->service.addService(booking.id(),new ReservationDtos.AddServiceRequest("HCT-S",4,now),"HCT-FD",key())).extracting("code").isEqualTo("INSUFFICIENT_STOCK");
        assertThat(jdbc.queryForObject("SELECT soLuongTonKho FROM DichVu WHERE maDichVu=N'HCT-S'",Integer.class)).isEqualTo(3);
    }
}

package com.hospitality.mis.reservation;
import com.hospitality.mis.dto.reservation.ReservationDtos;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class ReservationInventoryProducerIntegrationTest extends ReservationSqlFixture {
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

package com.hospitality.mis.reservation;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class ReservationSearchIntegrationTest extends ReservationSqlFixture {
    @Test void filtersBeforePaginationAndOrdersByBookedTimeThenIdentity(){
        for(int i=0;i<107;i++){
            String status=i==0||i==106?"Đã xác nhận":"Bản nháp";
            jdbc.update("INSERT PhieuDatPhong(maKhachLuuTru,maNhanVien,trangThai,thoiDiemDat) VALUES(?,N'HCT-FD',?,?)",guest,status,now.plusMinutes(i));
            long id=jdbc.queryForObject("SELECT MAX(maPhieuDatPhong) FROM PhieuDatPhong WHERE maNhanVien=N'HCT-FD'",Long.class);
            jdbc.update("INSERT ChiTietDatPhong(maPhieuDatPhong,maPhong,thoiDiemNhanPhong,thoiDiemTraPhong,thoiDiemTraPhongBanDau) VALUES(?,N'HCT-R1',?,?,?)",id,now.plusDays(i),now.plusDays(i+1),now.plusDays(i+1));
        }
        var page=service.list(ReservationStatus.CONFIRMED,guest,1,1);
        assertThat(page.totalElements()).isEqualTo(2);assertThat(page.items()).hasSize(1);
        assertThat(page.items().get(0).bookedAt()).isEqualTo(now);
        assertThat(service.list(null,guest,1,20).items()).hasSize(20);
        actor("other","STAFF");assertThat(service.list(null,guest,0,20).totalElements()).isZero();
    }
}

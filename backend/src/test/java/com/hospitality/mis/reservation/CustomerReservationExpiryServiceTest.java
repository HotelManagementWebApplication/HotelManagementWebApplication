package com.hospitality.mis.reservation;

import com.hospitality.mis.service.reservation.CustomerReservationExpiryService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
class CustomerReservationExpiryServiceTest {
    @Autowired CustomerReservationExpiryService service;
    @Autowired JdbcTemplate jdbc;
    @BeforeEach void seed(){cleanup();jdbc.update("INSERT KhachLuuTru(hoVaTen,soDienThoai,soGiayToTuyThan) VALUES(N'EXP guest',N'0966000901',N'096600000001')");}
    @AfterEach void clear(){cleanup();}
    @Test void expiredExtensionRestoresScheduleDepositAttemptAndAudit(){
        long id=reservation("Đã xác nhận","EXP-extension");
        LocalDateTime oldIn=LocalDateTime.of(2026,10,10,14,0),oldOut=LocalDateTime.of(2026,10,12,12,0),extended=LocalDateTime.of(2026,10,14,12,0);
        room(id,"EXP-A",oldIn,extended);
        jdbc.update("UPDATE ChiTietDatPhong SET thoiDiemTraPhongBanDau=? WHERE maPhieuDatPhong=?",oldOut,id);
        jdbc.update("UPDATE PhieuDatPhong SET tienDatCoc=3600000,trangThaiThanhToanCoc=N'Chờ thanh toán',thoiDiemHetHanThanhToanCoc='2026-10-01',loaiThayDoiDangCho=N'Gia hạn',thoiDiemNhanPhongTruocThayDoi=?,thoiDiemTraPhongTruocThayDoi=?,tienDatCocTruocThayDoi=1800000,tienDatCocBoSung=1800000,maThanhToanDatCoc=N'EXP-CODE' WHERE maPhieuDatPhong=?",oldIn,oldOut,id);
        attempt(id,"EXP-ATTEMPT");
        service.expireHolds();
        assertThat(jdbc.queryForObject("SELECT tienDatCoc FROM PhieuDatPhong WHERE maPhieuDatPhong=?",BigDecimal.class,id)).isEqualByComparingTo("1800000");
        assertThat(jdbc.queryForObject("SELECT trangThaiThanhToanCoc FROM PhieuDatPhong WHERE maPhieuDatPhong=?",String.class,id)).isEqualTo("Đã thanh toán");
        assertThat(jdbc.queryForObject("SELECT thoiDiemTraPhong FROM ChiTietDatPhong WHERE maPhieuDatPhong=?",java.sql.Timestamp.class,id).toLocalDateTime()).isEqualTo(oldOut);
        assertThat(jdbc.queryForObject("SELECT trangThai FROM YeuCauThanhToanVnpay WHERE maPhieuDatPhong=?",String.class,id)).isEqualTo("Đã hết hạn");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE hanhDong=N'CUSTOMER_EXTENSION_PAYMENT_EXPIRED' AND maDoiTuong=CONVERT(NVARCHAR(100),?)",Integer.class,id)).isEqualTo(1);
    }
    @Test void expiredDraftCancelsHoldAndAttemptTogether(){
        long id=reservation("Bản nháp","EXP-draft");room(id,"EXP-B",LocalDateTime.of(2026,10,10,14,0),LocalDateTime.of(2026,10,12,12,0));
        jdbc.update("UPDATE PhieuDatPhong SET trangThaiThanhToanCoc=N'Chờ thanh toán',thoiDiemHetHanThanhToanCoc='2026-10-01' WHERE maPhieuDatPhong=?",id);attempt(id,"EXP-DRAFT-ATTEMPT");
        service.expireHolds();
        assertThat(jdbc.queryForMap("SELECT trangThai,trangThaiThanhToanCoc FROM PhieuDatPhong WHERE maPhieuDatPhong=?",id)).containsEntry("trangThai","Đã hủy").containsEntry("trangThaiThanhToanCoc","Đã hết hạn");
        assertThat(jdbc.queryForObject("SELECT trangThai FROM ChiTietDatPhong WHERE maPhieuDatPhong=?",String.class,id)).isEqualTo("Đã hủy");
    }
    private long reservation(String status,String key){Long guest=jdbc.queryForObject("SELECT maKhachLuuTru FROM KhachLuuTru WHERE soDienThoai=N'0966000901'",Long.class);jdbc.update("INSERT PhieuDatPhong(maKhachLuuTru,trangThai,hinhThucThue,khoaChongTrung) VALUES(?,?,N'Theo gói',?)",guest,status,key);return jdbc.queryForObject("SELECT maPhieuDatPhong FROM PhieuDatPhong WHERE khoaChongTrung=?",Long.class,key);}
    private void room(long reservation,String room,LocalDateTime from,LocalDateTime to){if(jdbc.queryForObject("SELECT COUNT(*) FROM LoaiPhong WHERE maLoaiPhong=N'EXP'",Integer.class)==0)jdbc.update("INSERT LoaiPhong(maLoaiPhong,ten,giaTheoNgay) VALUES(N'EXP',N'Expiry',100)");jdbc.update("INSERT Phong(maPhong,maLoaiPhong) VALUES(?,N'EXP')",room);jdbc.update("INSERT ChiTietDatPhong(maPhieuDatPhong,maPhong,thoiDiemNhanPhong,thoiDiemTraPhong,thoiDiemTraPhongBanDau,trangThai,soLuongKhach) VALUES(?,?,?,?,?,N'Đã giữ phòng',1)",reservation,room,from,to,to);}
    private void attempt(long reservation,String reference){jdbc.update("INSERT YeuCauThanhToanVnpay(maPhieuDatPhong,maThamChieuMerchant,soTien,trangThai,thoiDiemTao,thoiDiemHetHan) VALUES(?,?,100,N'Chờ thanh toán','2026-09-30','2026-10-01')",reservation,reference);}
    private void cleanup(){jdbc.update("DELETE NhatKyKiemSoat WHERE loaiDoiTuong=N'RESERVATION' AND maDoiTuong IN(SELECT CONVERT(NVARCHAR(100),maPhieuDatPhong) FROM PhieuDatPhong WHERE khoaChongTrung LIKE N'EXP-%')");jdbc.update("DELETE YeuCauThanhToanVnpay WHERE maPhieuDatPhong IN(SELECT maPhieuDatPhong FROM PhieuDatPhong WHERE khoaChongTrung LIKE N'EXP-%')");jdbc.update("DELETE ChiTietDatPhong WHERE maPhieuDatPhong IN(SELECT maPhieuDatPhong FROM PhieuDatPhong WHERE khoaChongTrung LIKE N'EXP-%')");jdbc.update("DELETE PhieuDatPhong WHERE khoaChongTrung LIKE N'EXP-%'");jdbc.update("DELETE Phong WHERE maPhong LIKE N'EXP-%'");jdbc.update("DELETE LoaiPhong WHERE maLoaiPhong=N'EXP'");jdbc.update("DELETE KhachLuuTru WHERE soDienThoai=N'0966000901'");}
}

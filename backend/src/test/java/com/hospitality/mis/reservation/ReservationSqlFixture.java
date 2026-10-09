package com.hospitality.mis.reservation;

import com.hospitality.mis.dto.reservation.ReservationDtos;
import com.hospitality.mis.service.reservation.ReservationService;
import com.hospitality.mis.service.billing.BillingService;
import com.hospitality.mis.service.governance.ApprovalService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

/** Committed, isolated fixtures: rejected procedures may roll back their own transaction. */
@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
@AutoConfigureMockMvc
public abstract class ReservationSqlFixture {
    @Autowired protected JdbcTemplate jdbc;
    @Autowired protected ReservationService service;
    @Autowired protected BillingService billing;
    @Autowired protected ApprovalService approvals;
    protected long guest;
    protected final LocalDateTime now=LocalDateTime.of(2031,1,1,12,0);
    private Object originalClock;
    @BeforeEach void seedSql(){
        cleanupSql();
        originalClock=ReflectionTestUtils.getField(service,"clock");
        clock(now);actor("HCT-FD","FRONT_DESK");
        jdbc.update("INSERT NhanVien(maNhanVien,hoVaTen,matKhau,vaiTro,soDienThoai) VALUES(N'HCT-FD',N'Hardcut test',N'test',N'Lễ tân',N'0901111111')");
        jdbc.update("INSERT KhachLuuTru(hoVaTen,soDienThoai,soGiayToTuyThan) VALUES(N'Hardcut guest',N'0901111112',N'HCT-ID')");
        guest=jdbc.queryForObject("SELECT maKhachLuuTru FROM KhachLuuTru WHERE soGiayToTuyThan=N'HCT-ID'",Long.class);
        jdbc.update("INSERT LoaiPhong(maLoaiPhong,ten,giaTheoNgay,giaTheoGio) VALUES(N'HCT-T',N'Hardcut room',2400000,100000)");
        jdbc.update("INSERT Phong(maPhong,maLoaiPhong,trangThai) VALUES(N'HCT-R1',N'HCT-T',N'Sẵn sàng'),(N'HCT-R2',N'HCT-T',N'Sẵn sàng')");
    }
    @AfterEach void finishSql(){
        if(originalClock!=null)ReflectionTestUtils.setField(service,"clock",originalClock);
        cleanupSql();SecurityContextHolder.clearContext();
    }
    private void cleanupSql(){
        jdbc.update("DELETE ButToanTaiChinh WHERE maNguoiThucHien LIKE N'HCT-%' OR (loaiNguon=N'PAYMENT_TRANSACTION' AND maNguon IN(SELECT CONVERT(NVARCHAR(100),maGiaoDichThanhToan) FROM GiaoDichThanhToan WHERE maHoaDon IN(SELECT maHoaDon FROM HoaDon WHERE maPhieuDatPhong IN(SELECT maPhieuDatPhong FROM PhieuDatPhong WHERE maKhachLuuTru IN(SELECT maKhachLuuTru FROM KhachLuuTru WHERE soGiayToTuyThan=N'HCT-ID'))))) OR (loaiNguon=N'RECEIPT' AND maNguon IN(SELECT CONVERT(NVARCHAR(100),maBienLai) FROM BienLai WHERE maHoaDon IN(SELECT maHoaDon FROM HoaDon WHERE maPhieuDatPhong IN(SELECT maPhieuDatPhong FROM PhieuDatPhong WHERE maKhachLuuTru IN(SELECT maKhachLuuTru FROM KhachLuuTru WHERE soGiayToTuyThan=N'HCT-ID')))))");
        jdbc.update("DELETE BienLai WHERE maHoaDon IN(SELECT maHoaDon FROM HoaDon WHERE maPhieuDatPhong IN(SELECT maPhieuDatPhong FROM PhieuDatPhong WHERE maKhachLuuTru IN(SELECT maKhachLuuTru FROM KhachLuuTru WHERE soGiayToTuyThan=N'HCT-ID')))");
        jdbc.update("DELETE GiaoDichThanhToan WHERE maHoaDon IN(SELECT maHoaDon FROM HoaDon WHERE maPhieuDatPhong IN(SELECT maPhieuDatPhong FROM PhieuDatPhong WHERE maKhachLuuTru IN(SELECT maKhachLuuTru FROM KhachLuuTru WHERE soGiayToTuyThan=N'HCT-ID')))");
        jdbc.update("DELETE DieuChinhHoaDon WHERE maHoaDon IN(SELECT maHoaDon FROM HoaDon WHERE maPhieuDatPhong IN(SELECT maPhieuDatPhong FROM PhieuDatPhong WHERE maKhachLuuTru IN(SELECT maKhachLuuTru FROM KhachLuuTru WHERE soGiayToTuyThan=N'HCT-ID')))");
        jdbc.update("DELETE HoaDon WHERE maPhieuDatPhong IN(SELECT maPhieuDatPhong FROM PhieuDatPhong WHERE maKhachLuuTru IN(SELECT maKhachLuuTru FROM KhachLuuTru WHERE soGiayToTuyThan=N'HCT-ID'))");
        jdbc.update("DELETE SuDungDichVu WHERE maPhieuDatPhong IN(SELECT maPhieuDatPhong FROM PhieuDatPhong WHERE maKhachLuuTru IN(SELECT maKhachLuuTru FROM KhachLuuTru WHERE soGiayToTuyThan=N'HCT-ID'))");
        jdbc.update("DELETE BienDongKhoDichVu WHERE maDichVu=N'HCT-S'");
        jdbc.update("DELETE PhieuDatPhong WHERE maKhachLuuTru IN(SELECT maKhachLuuTru FROM KhachLuuTru WHERE soGiayToTuyThan=N'HCT-ID')");
        jdbc.update("DELETE DichVu WHERE maDichVu=N'HCT-S'");
        jdbc.update("DELETE Phong WHERE maLoaiPhong=N'HCT-T'");
        jdbc.update("DELETE LoaiPhong WHERE maLoaiPhong=N'HCT-T'");
        jdbc.update("DELETE LichSuHangThanhVien WHERE maKhachLuuTru IN(SELECT maKhachLuuTru FROM KhachLuuTru WHERE soGiayToTuyThan=N'HCT-ID')");
        jdbc.update("DELETE KhachLuuTru WHERE soGiayToTuyThan=N'HCT-ID'");
        jdbc.update("DELETE BanGhiChongTrung WHERE nguoiThucHien LIKE N'HCT-%'");
        jdbc.update("DELETE NhatKyKiemSoat WHERE nguoiThucHien LIKE N'HCT-%'");
        jdbc.update("DELETE YeuCauPheDuyet WHERE nguoiYeuCau LIKE N'HCT-%'");
        jdbc.update("DELETE NhanVien WHERE maNhanVien=N'HCT-FD'");
    }
    protected void clock(LocalDateTime time){ReflectionTestUtils.setField(service,"clock",Clock.fixed(time.atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant(),ZoneId.of("Asia/Ho_Chi_Minh")));}
    protected static void actor(String name,String role){SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(name,"", "ROLE_"+role));}
    protected ReservationDtos.Response create(LocalDateTime start,int hours,boolean hourly,String...rooms){
        BigDecimal deposit=BigDecimal.valueOf(2400000L*rooms.length*(long)Math.ceil(hours/24.0)/2);
        if(hourly)deposit=BigDecimal.valueOf(100000L*Math.max(3,hours)*rooms.length/2);
        return service.create(new ReservationDtos.CreateRequest(guest,"HCT-FD",deposit,hourly?ReservationDtos.RentalType.HOURLY:ReservationDtos.RentalType.PACKAGE,
            Arrays.stream(rooms).map(r->new ReservationDtos.RoomStay(r,start,start.plusHours(hours))).toList(),key()),"HCT-FD");
    }
    protected static String key(){return UUID.randomUUID().toString();}
}

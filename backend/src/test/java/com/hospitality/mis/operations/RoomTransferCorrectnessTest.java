package com.hospitality.mis.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.operations.RoomTransferDtos;
import com.hospitality.mis.service.operations.RoomTransferService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import java.time.LocalDateTime;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
class RoomTransferCorrectnessTest {
    @Autowired RoomTransferService service;
    @Autowired JdbcTemplate jdbc;
    private final LocalDateTime from=LocalDateTime.now().minusHours(2),to=LocalDateTime.now().plusDays(2);
    @BeforeEach void seed(){
        cleanup();actor();
        jdbc.update("INSERT LoaiPhong(maLoaiPhong,ten,giaTheoNgay) VALUES(N'RTX',N'Transfer',100)");
        jdbc.update("INSERT Phong(maPhong,maLoaiPhong,trangThai) VALUES(N'RTX-A',N'RTX',N'Đang có khách'),(N'RTX-B',N'RTX',N'Sẵn sàng'),(N'RTX-C',N'RTX',N'Sẵn sàng')");
        jdbc.update("INSERT KhachLuuTru(hoVaTen,soDienThoai,soGiayToTuyThan) VALUES(N'RTX guest',N'0977000901',N'097700000001')");
        Long guest=jdbc.queryForObject("SELECT maKhachLuuTru FROM KhachLuuTru WHERE soDienThoai=N'0977000901'",Long.class);
        jdbc.update("INSERT NhanVien(maNhanVien,hoVaTen,matKhau,vaiTro,soDienThoai) VALUES(N'RTX-op',N'RTX operator',N'x',N'Lễ tân',N'0977000902')");
        jdbc.update("INSERT PhieuDatPhong(maKhachLuuTru,maNhanVien,trangThai,hinhThucThue,khoaChongTrung,thoiDiemNhanPhongThucTe) VALUES(?,N'RTX-op',N'Đã nhận phòng',N'Theo gói',N'RTX-book',?)",guest,from);
        Long reservation=id();
        jdbc.update("INSERT ChiTietDatPhong(maPhieuDatPhong,maPhong,thoiDiemNhanPhong,thoiDiemTraPhong,thoiDiemTraPhongBanDau,trangThai,soLuongKhach) VALUES(?,?,?,?,?,N'Đang có khách',2)",reservation,"RTX-A",from,to,to);
    }
    @AfterEach void clear(){cleanup();SecurityContextHolder.clearContext();}
    @Test void transferAndReplayAreAtomic(){
        var request=new RoomTransferDtos.CreateRequest("RTX-A","RTX-B",null,"upgrade");
        var first=service.transfer(id(),request,"RTX-op","RTX-key");
        assertThat(service.transfer(id(),request,"RTX-op","RTX-key")).isEqualTo(first);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM ChuyenPhong WHERE maPhieuDatPhong=?",Integer.class,id())).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT trangThai FROM Phong WHERE maPhong=N'RTX-A'",String.class)).isEqualTo("Đang dọn phòng");
        assertThat(jdbc.queryForObject("SELECT trangThai FROM Phong WHERE maPhong=N'RTX-B'",String.class)).isEqualTo("Đang có khách");
    }
    @Test void invalidDestinationRollsBackSource(){
        jdbc.update("UPDATE Phong SET trangThai=N'Đang dọn phòng' WHERE maPhong=N'RTX-B'");
        code(()->service.transfer(id(),new RoomTransferDtos.CreateRequest("RTX-A","RTX-B",null,"bad"),"RTX-op","RTX-bad"),"ROOM_NOT_AVAILABLE");
        assertThat(jdbc.queryForObject("SELECT trangThai FROM Phong WHERE maPhong=N'RTX-A'",String.class)).isEqualTo("Đang có khách");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM ChuyenPhong WHERE maPhieuDatPhong=?",Integer.class,id())).isZero();
    }
    @Test void overlappingDestinationIsRejected(){
        jdbc.update("INSERT PhieuDatPhong(maKhachLuuTru,maNhanVien,trangThai,hinhThucThue,khoaChongTrung) SELECT maKhachLuuTru,N'RTX-op',N'Đã xác nhận',N'Theo gói',N'RTX-other' FROM PhieuDatPhong WHERE maPhieuDatPhong=?",id());
        Long other=jdbc.queryForObject("SELECT maPhieuDatPhong FROM PhieuDatPhong WHERE khoaChongTrung=N'RTX-other'",Long.class);
        jdbc.update("INSERT ChiTietDatPhong(maPhieuDatPhong,maPhong,thoiDiemNhanPhong,thoiDiemTraPhong,thoiDiemTraPhongBanDau,trangThai,soLuongKhach) VALUES(?,?,?,?,?,N'Đã giữ phòng',1)",other,"RTX-B",LocalDateTime.now().plusHours(1),to,to);
        code(()->service.transfer(id(),new RoomTransferDtos.CreateRequest("RTX-A","RTX-B",null,"overlap"),"RTX-op","RTX-overlap"),"OVERBOOKING");
    }
    @Test void concurrentDifferentKeysProduceOneTransfer()throws Exception{
        var gate=new CountDownLatch(1);try(var pool=Executors.newFixedThreadPool(2)){
            var a=pool.submit(()->attempt("RTX-a",gate));var b=pool.submit(()->attempt("RTX-b",gate));gate.countDown();
            assertThat(java.util.List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS))).contains("OK");
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM ChuyenPhong WHERE maPhieuDatPhong=?",Integer.class,id())).isEqualTo(1);
        }
    }
    private String attempt(String key,CountDownLatch gate)throws Exception{gate.await();actor();try{service.transfer(id(),new RoomTransferDtos.CreateRequest("RTX-A","RTX-B",null,"race"),"RTX-op",key);return "OK";}catch(DomainException e){return e.getCode();}finally{SecurityContextHolder.clearContext();}}
    private void actor(){SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("RTX-op","x","ROLE_FRONT_DESK"));}
    private Long id(){return jdbc.queryForObject("SELECT maPhieuDatPhong FROM PhieuDatPhong WHERE khoaChongTrung=N'RTX-book'",Long.class);}
    private void code(Runnable operation,String expected){assertThatThrownBy(operation::run).isInstanceOf(DomainException.class).extracting("code").isEqualTo(expected);}
    private void cleanup(){
        jdbc.update("DELETE BanGhiChongTrung WHERE nguoiThucHien=N'RTX-op'");
        jdbc.update("DELETE NhatKyKiemSoat WHERE nguoiThucHien=N'RTX-op'");
        jdbc.update("DELETE ChuyenPhong WHERE maPhieuDatPhong IN(SELECT maPhieuDatPhong FROM PhieuDatPhong WHERE khoaChongTrung LIKE N'RTX-%')");
        jdbc.update("DELETE ChiTietDatPhong WHERE maPhieuDatPhong IN(SELECT maPhieuDatPhong FROM PhieuDatPhong WHERE khoaChongTrung LIKE N'RTX-%')");
        jdbc.update("DELETE PhieuDatPhong WHERE khoaChongTrung LIKE N'RTX-%'");
        jdbc.update("DELETE KhachLuuTru WHERE soDienThoai=N'0977000901'");
        jdbc.update("DELETE Phong WHERE maPhong LIKE N'RTX-%'");
        jdbc.update("DELETE LoaiPhong WHERE maLoaiPhong=N'RTX'");
        jdbc.update("DELETE NhanVien WHERE maNhanVien=N'RTX-op'");
    }
}

package com.hospitality.mis.room;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.room.RoomDatabase;
import com.hospitality.mis.entity.room.RoomStatus;
import com.hospitality.mis.service.room.RoomService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
class RoomServiceTest {
    @Autowired RoomService service;
    @Autowired RoomDatabase rooms;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager manager;
    long reservation;
    @BeforeEach void seed(){
        cleanup();
        jdbc.update("INSERT LoaiPhong(maLoaiPhong,ten,giaTheoNgay) VALUES(N'RSP-T',N'Room service type',2400)");
        jdbc.update("INSERT Phong(maPhong,maLoaiPhong,ten,tang) VALUES(N'RSP-01',N'RSP-T',N'Room 101',1),(N'RSP-02',N'RSP-T',N'Room 102',2)");
        actor("RSP-manager","MANAGER");
    }
    @AfterEach void cleanup(){
        jdbc.update("DELETE NhatKyKiemSoat WHERE loaiDoiTuong=N'ROOM' AND maDoiTuong LIKE N'RSP-%'");
        jdbc.update("DELETE PhieuDatPhong WHERE maKhachLuuTru IN(SELECT maKhachLuuTru FROM KhachLuuTru WHERE soGiayToTuyThan=N'RSP-GUEST')");
        jdbc.update("DELETE KhachLuuTru WHERE soGiayToTuyThan=N'RSP-GUEST'");
        jdbc.update("DELETE Phong WHERE maPhong LIKE N'RSP-%'");jdbc.update("DELETE LoaiPhong WHERE maLoaiPhong=N'RSP-T'");SecurityContextHolder.clearContext();
    }
    @Test void searchMapsCanonicalRoomAndFiltersInStableOrder(){
        var result=service.search("RSP-T",RoomStatus.READY);
        assertThat(result).extracting(r->r.id()).containsExactly("RSP-01","RSP-02");var row=result.getFirst();
        assertThat(row.name()).isEqualTo("Room 101");assertThat(row.roomTypeName()).isEqualTo("Room service type");assertThat(row.dailyPrice()).isEqualByComparingTo("2400");assertThat(row.floor()).isEqualTo(1);
    }
    @Test void availabilityCombinesPhysicalStateAndHalfOpenOverlap(){
        LocalDateTime from=LocalDateTime.now().plusDays(5).truncatedTo(java.time.temporal.ChronoUnit.MICROS),to=from.plusDays(1);booking(from,to);
        jdbc.update("UPDATE Phong SET trangThai=N'Đang dọn phòng' WHERE maPhong=N'RSP-02'");
        assertThat(service.availability(from,to,"RSP-T")).extracting(r->r.available()).containsExactly(false,false);
        assertThat(service.availability(to,to.plusHours(1),"RSP-T")).extracting(r->r.available()).containsExactly(true,false);
    }
    @Test void intervalValidationAndMissingRoomHaveStableErrors(){
        var now=LocalDateTime.now();code(()->service.availability(now,now,null),"INVALID_INTERVAL");
        code(()->service.availability(null,now,null),"INVALID_INTERVAL");code(()->service.updateStatus("RSP-none",RoomStatus.MAINTENANCE,"RSP-manager"),"ROOM_NOT_FOUND");
    }
    @Test void technicalMaintenanceUsesSqlVersionAndAudit(){
        actor("RSP-tech","TECHNICAL");var row=service.updateStatus("RSP-01",RoomStatus.MAINTENANCE,"RSP-tech");
        assertThat(row.status()).isEqualTo(RoomStatus.MAINTENANCE);assertThat(rooms.find("RSP-01").orElseThrow().version()).isEqualTo(1);
        assertThat(jdbc.queryForMap("SELECT nguoiThucHien,duLieuTruoc,duLieuSau FROM NhatKyKiemSoat WHERE loaiDoiTuong=N'ROOM' AND maDoiTuong=N'RSP-01'")).containsEntry("nguoiThucHien","RSP-tech").containsEntry("duLieuTruoc","available").containsEntry("duLieuSau","maintenance");
    }
    @Test void managerCanStartMaintenanceAndSameStateDoesNotWriteTwice(){
        service.updateStatus("RSP-01",RoomStatus.MAINTENANCE,"RSP-manager");service.updateStatus("RSP-01",RoomStatus.MAINTENANCE,"RSP-manager");
        assertThat(rooms.find("RSP-01").orElseThrow().version()).isEqualTo(1);assertThat(audits()).isEqualTo(1);
    }
    @Test void invalidStatusAndClientActorAreRejectedBeforeMutation(){
        code(()->service.updateStatus("RSP-01",null,"RSP-manager"),"INVALID_ROOM_STATUS");
        code(()->service.updateStatus("RSP-01",RoomStatus.RETURNED,"RSP-manager"),"INVALID_ROOM_STATUS");
        code(()->service.updateStatus("RSP-01",RoomStatus.MAINTENANCE,"other"),"ACTOR_MISMATCH");
        SecurityContextHolder.clearContext();code(()->service.updateStatus("RSP-01",RoomStatus.MAINTENANCE,"RSP-manager"),"ACTOR_REQUIRED");assertThat(audits()).isZero();
    }
    @Test void occupiedAndUnsupportedTransitionsNeverPatchReady(){
        jdbc.update("UPDATE Phong SET trangThai=N'Đang có khách' WHERE maPhong=N'RSP-01'");
        code(()->service.updateStatus("RSP-01",RoomStatus.READY,"RSP-manager"),"INVALID_ROOM_TRANSITION");
        code(()->service.updateStatus("RSP-02",RoomStatus.CLEANING,"RSP-manager"),"INVALID_ROOM_TRANSITION");assertThat(audits()).isZero();
    }
    @Test void housekeepingCannotStartOrReleaseMaintenanceAndTechnicalMustUseReleaseCommand(){
        actor("RSP-hk","HOUSEKEEPING");code(()->service.updateStatus("RSP-01",RoomStatus.MAINTENANCE,"RSP-hk"),"ROOM_STATUS_FORBIDDEN");
        jdbc.update("UPDATE Phong SET trangThai=N'Đang bảo trì' WHERE maPhong=N'RSP-01'");
        code(()->service.updateStatus("RSP-01",RoomStatus.READY,"RSP-hk"),"ROOM_STATUS_FORBIDDEN");
        actor("RSP-tech","TECHNICAL");code(()->service.updateStatus("RSP-01",RoomStatus.READY,"RSP-tech"),"ROOM_RELEASE_COMMAND_REQUIRED");
    }
    @Test void readyReleaseUsesOneMicrosecondOverlapProbe(){
        jdbc.update("UPDATE Phong SET trangThai=N'Đang bảo trì' WHERE maPhong=N'RSP-01'");
        booking(LocalDateTime.now().minusHours(1),LocalDateTime.now().plusHours(1));
        code(()->service.updateStatus("RSP-01",RoomStatus.READY,"RSP-manager"),"ROOM_NOT_AVAILABLE");
        assertThat(rooms.find("RSP-01").orElseThrow().status()).isEqualTo(RoomStatus.MAINTENANCE);
        jdbc.update("UPDATE PhieuDatPhong SET trangThai=N'Đã hủy' WHERE maPhieuDatPhong=?",reservation);
        assertThat(service.updateStatus("RSP-01",RoomStatus.READY,"RSP-manager").status()).isEqualTo(RoomStatus.READY);
    }
    @Test void outerRollbackDoesNotPersistStatusVersionOrAudit(){
        assertThatThrownBy(()->new TransactionTemplate(manager).execute(status->{service.updateStatus("RSP-01",RoomStatus.MAINTENANCE,"RSP-manager");throw new IllegalStateException("rollback");})).isInstanceOf(IllegalStateException.class);
        assertThat(rooms.find("RSP-01").orElseThrow().status()).isEqualTo(RoomStatus.READY);assertThat(rooms.find("RSP-01").orElseThrow().version()).isZero();assertThat(audits()).isZero();
    }
    @Test void sqlStatusCommandRejectsStaleVersion(){
        var original=rooms.find("RSP-01").orElseThrow();service.updateStatus("RSP-01",RoomStatus.MAINTENANCE,"RSP-manager");
        code(()->new TransactionTemplate(manager).executeWithoutResult(status->rooms.status(original,RoomStatus.READY,false,true,LocalDateTime.now())),"VERSION_CONFLICT");
    }
    @Test void concurrentSameStatusRecordsOnlyOneTransition()throws Exception{
        var pool=Executors.newFixedThreadPool(2);var gate=new CountDownLatch(1);
        try{var first=pool.submit(()->transition(gate));var second=pool.submit(()->transition(gate));gate.countDown();assertThat(first.get(20,TimeUnit.SECONDS)).isEqualTo(RoomStatus.MAINTENANCE);assertThat(second.get(20,TimeUnit.SECONDS)).isEqualTo(RoomStatus.MAINTENANCE);}finally{pool.shutdownNow();}
        assertThat(audits()).isEqualTo(1);assertThat(rooms.find("RSP-01").orElseThrow().version()).isEqualTo(1);
    }
    private RoomStatus transition(CountDownLatch gate)throws Exception{gate.await();actor("RSP-manager","MANAGER");try{return service.updateStatus("RSP-01",RoomStatus.MAINTENANCE,"RSP-manager").status();}finally{SecurityContextHolder.clearContext();}}
    private void booking(LocalDateTime from,LocalDateTime to){
        Long guest=jdbc.queryForObject("INSERT KhachLuuTru(hoVaTen,soDienThoai,soGiayToTuyThan) OUTPUT INSERTED.maKhachLuuTru VALUES(N'Room service guest',N'0909090651',N'RSP-GUEST')",Long.class);
        reservation=jdbc.queryForObject("INSERT PhieuDatPhong(maKhachLuuTru,trangThai) OUTPUT INSERTED.maPhieuDatPhong VALUES(?,N'Đã xác nhận')",Long.class,guest);
        jdbc.update("INSERT ChiTietDatPhong(maPhieuDatPhong,maPhong,thoiDiemNhanPhong,thoiDiemTraPhong,thoiDiemTraPhongBanDau,trangThai,soLuongKhach) VALUES(?,N'RSP-01',?,?,?,N'Đã giữ phòng',1)",reservation,from,to,to);
    }
    private int audits(){return jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE loaiDoiTuong=N'ROOM' AND maDoiTuong LIKE N'RSP-%'",Integer.class);}
    private void actor(String id,String role){SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(id,"test","ROLE_"+role));}
    private void code(Runnable operation,String code){assertThatThrownBy(operation::run).isInstanceOf(DomainException.class).extracting("code").isEqualTo(code);}
}

package com.hospitality.mis.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.operations.EquipmentIncidentDatabase;
import com.hospitality.mis.dto.operations.EquipmentIncidentDtos;
import com.hospitality.mis.entity.operations.IncidentHandoffStatus;
import com.hospitality.mis.entity.operations.IncidentSeverity;
import com.hospitality.mis.service.operations.EquipmentIncidentService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import java.util.List;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
class SqlServerEquipmentIncidentTest {
    private static final String ACTOR="EQI-HK";
    @Autowired JdbcTemplate jdbc;
    @Autowired EquipmentIncidentService service;
    @Autowired EquipmentIncidentDatabase database;
    @Autowired PlatformTransactionManager transactions;
    long reservation;
    long equipment;
    @BeforeEach void seed(){
        cleanup();
        jdbc.update("INSERT NhanVien(maNhanVien,hoVaTen,matKhau,vaiTro,soDienThoai) VALUES(N'EQI-FD',N'Incident test',N'not-a-password',N'Lễ tân',N'0909090931')");
        jdbc.update("INSERT KhachLuuTru(hoVaTen,soDienThoai,soGiayToTuyThan) VALUES(N'Incident guest',N'0909090932',N'EQI-ID')");
        Long guest=jdbc.queryForObject("SELECT maKhachLuuTru FROM KhachLuuTru WHERE soDienThoai=N'0909090932'",Long.class);
        jdbc.update("INSERT LoaiPhong(maLoaiPhong,ten,giaTheoNgay) VALUES(N'EQI-T',N'Incident room',100000)");
        jdbc.update("INSERT Phong(maPhong,maLoaiPhong,trangThai) VALUES(N'EQI-R',N'EQI-T',N'Đang có khách'),(N'EQI-OTHER',N'EQI-T',N'Sẵn sàng')");
        jdbc.update("INSERT PhieuDatPhong(maKhachLuuTru,maNhanVien,trangThai) VALUES(?,N'EQI-FD',N'Đã nhận phòng')",guest);
        reservation=jdbc.queryForObject("SELECT maPhieuDatPhong FROM PhieuDatPhong WHERE maNhanVien=N'EQI-FD'",Long.class);
        jdbc.update("INSERT ChiTietDatPhong(maPhieuDatPhong,maPhong,thoiDiemNhanPhong,thoiDiemTraPhong,thoiDiemTraPhongBanDau,trangThai) VALUES(?,N'EQI-R','2035-01-10T14:00:00','2035-01-11T12:00:00','2035-01-11T12:00:00',N'Đang có khách')",reservation);
        jdbc.update("INSERT ThietBiPhong(maPhong,ten,giaTriBanDau,ngayMua,soLuong) VALUES(N'EQI-R',N'TV',1000,?,2)",LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).minusYears(1));
        equipment=jdbc.queryForObject("SELECT maThietBiPhong FROM ThietBiPhong WHERE maPhong=N'EQI-R'",Long.class);
        actor(ACTOR,"HOUSEKEEPING");
    }
    @AfterEach void cleanup(){
        jdbc.update("DELETE HangDoiThongBao WHERE noiDung LIKE N'%\"room_id\":\"EQI-%'");
        jdbc.update("DELETE SuCoThietBi WHERE maPhong IN(N'EQI-R',N'EQI-OTHER')");
        jdbc.update("DELETE BanGhiChongTrung WHERE nguoiThucHien LIKE N'EQI-%'");
        jdbc.update("DELETE NhatKyKiemSoat WHERE nguoiThucHien LIKE N'EQI-%'");
        jdbc.update("DELETE ThietBiPhong WHERE maPhong IN(N'EQI-R',N'EQI-OTHER')");
        jdbc.update("DELETE PhieuDatPhong WHERE maNhanVien=N'EQI-FD'");
        jdbc.update("DELETE Phong WHERE maPhong IN(N'EQI-R',N'EQI-OTHER')");
        jdbc.update("DELETE LoaiPhong WHERE maLoaiPhong=N'EQI-T'");
        jdbc.update("DELETE KhachLuuTru WHERE soDienThoai=N'0909090932'");
        jdbc.update("DELETE NhanVien WHERE maNhanVien=N'EQI-FD'");
        SecurityContextHolder.clearContext();
    }
    @Test void registrySnapshotCompensationAuditAndThreeRecipientRouting(){
        var incident=service.record(reservation,request("TV",equipment,1,IncidentSeverity.HIGH),ACTOR,"eqi-record");
        assertThat(incident.compensation()).isEqualByComparingTo("1500.00");
        assertThat(incident.reservationId()).isEqualTo(reservation);
        assertThat(incident.equipmentName()).isEqualTo("TV");
        assertThat(jdbc.queryForObject("SELECT duLieuSau FROM NhatKyKiemSoat WHERE nguoiThucHien=?",String.class,ACTOR)).isEqualTo("1500.00");
        assertThat(jdbc.queryForList("SELECT vaiTroNguoiNhan FROM HangDoiThongBao WHERE noiDung LIKE N'%\"room_id\":\"EQI-R\"%' ORDER BY maThongBao",String.class)).containsExactly("Lễ tân","Kỹ thuật","Quản lý");
        assertThat(service.find("EQI-R",reservation,IncidentHandoffStatus.OPEN)).containsExactly(incident);
        jdbc.update("UPDATE ThietBiPhong SET giaTriBanDau=9000,ten=N'Changed' WHERE maThietBiPhong=?",equipment);
        assertThat(service.find("EQI-R",reservation,null)).containsExactly(incident);
    }
    @Test void pricingTwoYearAndLeapDayBoundariesMatchThePublishedPolicy(){
        assertThat(jdbc.queryForObject("SELECT dbo.fnTinhBoiThuongThietBi(1000,'2024-02-29',1,'2026-02-28')",java.math.BigDecimal.class)).isEqualByComparingTo("1500.00");
        assertThat(jdbc.queryForObject("SELECT dbo.fnTinhBoiThuongThietBi(1000,'2024-02-29',2,'2026-03-01')",java.math.BigDecimal.class)).isEqualByComparingTo("4000.00");
        assertThat(jdbc.queryForObject("SELECT dbo.fnTinhBoiThuongThietBi(1000,'2035-01-01',1,'2034-01-01')",java.math.BigDecimal.class)).isNull();
        jdbc.update("UPDATE ThietBiPhong SET ngayMua=? WHERE maThietBiPhong=?",LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(1),equipment);
        code(()->service.record(reservation,request("TV",equipment,1,null),ACTOR,"eqi-future"),"INVALID_EQUIPMENT_DATE");
        noWrites();
    }
    @Test void stateMembershipRegistryAndQuantityFailuresHaveNoPartialWrite(){
        code(()->service.record(Long.MAX_VALUE,request("TV",equipment,1,null),ACTOR,"eqi-not-found"),"RESERVATION_NOT_FOUND");
        code(()->service.record(reservation,new EquipmentIncidentDtos.CreateRequest("EQI-OTHER","TV",equipment,1,null),ACTOR,"eqi-foreign"),"ROOM_NOT_IN_RESERVATION");
        code(()->service.record(reservation,request("TV",Long.MAX_VALUE,1,null),ACTOR,"eqi-unknown"),"EQUIPMENT_NOT_FOUND");
        code(()->service.record(reservation,request("TV",equipment,3,null),ACTOR,"eqi-qty"),"INVALID_EQUIPMENT_QUANTITY");
        jdbc.update("UPDATE PhieuDatPhong SET trangThai=N'Đã xác nhận' WHERE maPhieuDatPhong=?",reservation);
        code(()->service.record(reservation,request("TV",equipment,1,null),ACTOR,"eqi-state"),"INVALID_STATE");
        noWrites();
    }
    @Test void actorMismatchAndMissingActorAreRejectedBeforeDatabaseMutation(){
        code(()->service.record(reservation,request("TV",equipment,1,null),"other","eqi-mismatch"),"ACTOR_MISMATCH");
        SecurityContextHolder.clearContext();
        code(()->service.record(reservation,request("TV",equipment,1,null),ACTOR,"eqi-no-actor"),"ACTOR_REQUIRED");
        noWrites();
    }
    @Test void exactCaseInsensitiveNameResolutionDoesNotHideDuplicatesOrTrailingSpaces(){
        assertThat(service.record(reservation,request(" tv ",null,1,null),ACTOR,"eqi-name").equipmentName()).isEqualTo("TV");
        jdbc.update("INSERT ThietBiPhong(maPhong,ten,giaTriBanDau,ngayMua,soLuong) VALUES(N'EQI-R',N'tv',1000,'2020-01-01',2)");
        code(()->service.record(reservation,request("TV",null,1,null),ACTOR,"eqi-ambiguous"),"EQUIPMENT_NOT_FOUND");
        jdbc.update("UPDATE ThietBiPhong SET ten=N'TV ' WHERE maThietBiPhong=?",equipment);
        assertThat(service.record(reservation,request("TV",null,1,null),ACTOR,"eqi-exact").equipmentName()).isEqualTo("tv");
    }
    @Test void standaloneRoomIncidentSupportsNullReservationUnknownRegistryAndJsonEscaping(){
        var request=new EquipmentIncidentDtos.RoomIncidentRequest("EQI-OTHER","\t Door \"lock\" \t",null,null,IncidentSeverity.HIGH,"Pin yếu");
        var result=service.recordRoomIncident(request,ACTOR,"eqi-room");
        assertThat(result.reservationId()).isNull();assertThat(result.equipmentName()).isEqualTo("Door \"lock\"");
        assertThat(result.compensation()).isEqualTo(java.math.BigDecimal.ZERO);assertThat(result.handoffNote()).isEqualTo("Pin yếu");
        assertThat(jdbc.queryForObject("SELECT ISJSON(noiDung) FROM HangDoiThongBao WHERE khoaChongLap=?",Integer.class,"room-incident-"+result.id())).isEqualTo(1);
        assertThat(service.recordRoomIncident(request,ACTOR,"eqi-room")).isEqualTo(result);
    }
    @Test void handoffKeepsResolveRoleAndStateMachineAndStableReplay(){
        var incident=service.record(reservation,request("TV",equipment,1,null),ACTOR,"eqi-handoff-record");
        code(()->service.handoff(incident.id(),new EquipmentIncidentDtos.HandoffRequest(IncidentHandoffStatus.RESOLVED,"no"),ACTOR,"eqi-denied"),"INCIDENT_HANDOFF_FORBIDDEN");
        actor("EQI-TECH","TECHNICAL");
        code(()->service.handoff(incident.id(),new EquipmentIncidentDtos.HandoffRequest(IncidentHandoffStatus.RESOLVED,"too soon"),"EQI-TECH","eqi-state-handoff"),"INVALID_INCIDENT_HANDOFF");
        var acknowledged=service.handoff(incident.id(),new EquipmentIncidentDtos.HandoffRequest(IncidentHandoffStatus.ACKNOWLEDGED,"received"),"EQI-TECH","eqi-ack");
        service.handoff(incident.id(),new EquipmentIncidentDtos.HandoffRequest(IncidentHandoffStatus.RESOLVED,"repaired"),"EQI-TECH","eqi-resolve");
        assertThat(service.handoff(incident.id(),new EquipmentIncidentDtos.HandoffRequest(IncidentHandoffStatus.ACKNOWLEDGED,"received"),"EQI-TECH","eqi-ack")).isEqualTo(acknowledged);
        assertThat(service.find("EQI-R",reservation,IncidentHandoffStatus.RESOLVED)).singleElement().extracting(EquipmentIncidentDtos.Response::handoffNote).isEqualTo("repaired");
        assertThat(service.find("EQI-R",reservation,IncidentHandoffStatus.OPEN)).isEmpty();
    }
    @Test void durableReplaySurvivesRegistryChangesAndANewServiceInstance(){
        var request=request("TV",equipment,1,null);var original=service.record(reservation,request,ACTOR,"eqi-replay");
        jdbc.update("UPDATE ThietBiPhong SET dangHoatDong=0 WHERE maThietBiPhong=?",equipment);
        var restarted=new EquipmentIncidentService(database,Clock.system(ZoneId.of("Asia/Ho_Chi_Minh")));
        EquipmentIncidentDtos.Response replay=new TransactionTemplate(transactions).execute(tx->restarted.record(reservation,request,ACTOR,"eqi-replay"));
        assertThat(replay).isEqualTo(original);
        code(()->service.record(reservation,request("other",equipment,1,null),ACTOR,"eqi-replay"),"IDEMPOTENCY_KEY_CONFLICT");
        actor("EQI-OTHER-ACTOR","HOUSEKEEPING");
        code(()->service.record(reservation,request,"EQI-OTHER-ACTOR","eqi-replay"),"IDEMPOTENCY_KEY_CONFLICT");
    }
    @Test void outerRollbackAndInvalidStorageRollBackIncidentAuditOutboxAndSnapshot(){
        new TransactionTemplate(transactions).executeWithoutResult(tx->{service.record(reservation,request("TV",equipment,1,IncidentSeverity.HIGH),ACTOR,"eqi-outer");tx.setRollbackOnly();});
        noWrites();
        assertThatThrownBy(()->service.recordRoomIncident(new EquipmentIncidentDtos.RoomIncidentRequest("EQI-OTHER","door",null,1,IncidentSeverity.HIGH,"x".repeat(501)),ACTOR,"eqi-invalid")).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        noWrites();
    }
    @Test void twoConnectionsWithOneKeyWriteOneIncidentAndThreeEvents()throws Exception{
        var results=race(false);assertThat(results.get(0)).isEqualTo(results.get(1));assertCounts(1,3,1);
    }
    @Test void twoConnectionsWithConflictingPayloadHaveOneWinner()throws Exception{
        assertThat(race(true)).contains("IDEMPOTENCY_KEY_CONFLICT");assertCounts(1,3,1);
    }
    private List<Object> race(boolean conflict)throws Exception{
        var ready=new CountDownLatch(2);var start=new CountDownLatch(1);
        try(var executor=Executors.newFixedThreadPool(2)){
            var a=executor.submit(()->compete(1,ready,start));var b=executor.submit(()->compete(conflict?2:1,ready,start));
            assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue();start.countDown();return List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS));
        }
    }
    private Object compete(int quantity,CountDownLatch ready,CountDownLatch start)throws Exception{
        actor(ACTOR,"HOUSEKEEPING");try{ready.countDown();assertThat(start.await(10,TimeUnit.SECONDS)).isTrue();return service.record(reservation,request("TV",equipment,quantity,IncidentSeverity.HIGH),ACTOR,"eqi-race");}
        catch(DomainException error){return error.getCode();}finally{SecurityContextHolder.clearContext();}
    }
    private EquipmentIncidentDtos.CreateRequest request(String name,Long id,int quantity,IncidentSeverity severity){return new EquipmentIncidentDtos.CreateRequest("EQI-R",name,id,quantity,severity);}
    private static void actor(String name,String role){SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(name,"test","ROLE_"+role));}
    private void code(Runnable command,String code){assertThatThrownBy(command::run).isInstanceOf(DomainException.class).extracting("code").isEqualTo(code);}
    private void noWrites(){assertCounts(0,0,0);assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM BanGhiChongTrung WHERE nguoiThucHien LIKE N'EQI-%'",Integer.class)).isZero();}
    private void assertCounts(int incidents,int events,int audits){
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM SuCoThietBi WHERE maPhong IN(N'EQI-R',N'EQI-OTHER')",Integer.class)).isEqualTo(incidents);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM HangDoiThongBao WHERE noiDung LIKE N'%\"room_id\":\"EQI-%'",Integer.class)).isEqualTo(events);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE nguoiThucHien LIKE N'EQI-%'",Integer.class)).isEqualTo(audits);
    }
}

package com.hospitality.mis.room;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.room.RoomTypeAdminDtos;
import com.hospitality.mis.entity.room.RoomTypeCatalogStatus;
import com.hospitality.mis.service.room.RoomTypeCatalogService;
import com.hospitality.mis.service.governance.ApprovalService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
class SqlServerRoomTypeCommandsTest {
    @Autowired RoomTypeCatalogService service;
    @Autowired ApprovalService approvals;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager manager;
    @BeforeEach void seed(){cleanup();actor("RTC-tech","TECHNICAL");}
    @AfterEach void cleanup(){
        jdbc.update("DELETE LichSuGiaLoaiPhong WHERE maLoaiPhong LIKE N'RTC-%'");
        jdbc.update("DELETE Phong WHERE maLoaiPhong LIKE N'RTC-%'");
        jdbc.update("UPDATE LoaiPhong SET maLoaiPhongGoc=NULL,maLoaiPhongThayThe=NULL WHERE maLoaiPhong LIKE N'RTC-%'");
        jdbc.update("DELETE LoaiPhong WHERE maLoaiPhong LIKE N'RTC-%'");
        jdbc.update("DELETE NhatKyKiemSoat WHERE nguoiThucHien LIKE N'RTC-%'");
        jdbc.update("DELETE BanGhiChongTrung WHERE nguoiThucHien LIKE N'RTC-%'");
        jdbc.update("DELETE YeuCauPheDuyet WHERE maDoiTuong LIKE N'RTC-%'");SecurityContextHolder.clearContext();
    }
    @Test void draftProjectsNormalizedMetadataAndDerivedHourlyPriceAndDurableReplay(){
        var request=new RoomTypeAdminDtos.Request(" RTC-01 "," RTC Deluxe ",new BigDecimal("2400")," details ",new BigDecimal("30")," ",BigDecimal.ZERO," King ");
        var first=service.create(request,"RTC-tech","RTC-create");
        assertThat(first.name()).isEqualTo("RTC Deluxe");assertThat(first.hourlyPrice()).isEqualByComparingTo("100");assertThat(first.view()).isNull();assertThat(first.bedType()).isEqualTo("King");assertThat(first.catalogStatus()).isEqualTo(RoomTypeCatalogStatus.DRAFT);
        assertThat(service.create(request,"RTC-tech","RTC-create")).isEqualTo(first);assertThat(service.get("RTC-01")).isEqualTo(first);
        code(()->service.create(request,"RTC-tech","RTC-another"),"ROOM_TYPE_EXISTS");
    }
    @Test void rejectUpdateAndActiveImmutabilityUsePersistedCatalogState(){
        var request=request("RTC-01","100");service.create(request,"RTC-tech","RTC-create");service.markRejected("RTC-01","RTC-tech");
        assertThat(service.get("RTC-01").catalogStatus()).isEqualTo(RoomTypeCatalogStatus.REJECTED);
        var updated=service.update("RTC-01",request("RTC-01","200"),"RTC-tech","RTC-update");assertThat(updated.catalogStatus()).isEqualTo(RoomTypeCatalogStatus.DRAFT);assertThat(updated.approvedBy()).isNull();
        approve("RTC-01","RTC-submit","RTC-approve");service.activate("RTC-01","RTC-manager","RTC-active");
        code(()->service.update("RTC-01",request("RTC-01","300"),"RTC-manager","RTC-active-edit"),"ROOM_TYPE_ACTIVE_IMMUTABLE");
        service.markRejected("RTC-01","RTC-manager");assertThat(service.get("RTC-01").catalogStatus()).isEqualTo(RoomTypeCatalogStatus.ACTIVE);
    }
    @Test void invalidRevisionSourceMissingTypeAndIdMismatchHaveStableErrors(){
        code(()->service.get("RTC-none"),"ROOM_TYPE_NOT_FOUND");service.create(request("RTC-01","100"),"RTC-tech","RTC-create");
        code(()->service.createRevision("RTC-01",request("RTC-02","200"),"RTC-tech","RTC-revision"),"ROOM_TYPE_REVISION_SOURCE_INVALID");
        code(()->service.update("RTC-01",request("RTC-02","200"),"RTC-tech","RTC-edit"),"ROOM_TYPE_ID_MISMATCH");
    }
    @Test void oversizedDraftAndOuterRollbackLeaveNoTypeAuditOrDurableClaim(){
        var longName=new RoomTypeAdminDtos.Request("RTC-01","x".repeat(51),new BigDecimal("100"),null);
        assertThatThrownBy(()->service.create(longName,"RTC-tech","RTC-overflow")).isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThatThrownBy(()->new TransactionTemplate(manager).execute(status->{service.create(request("RTC-02","100"),"RTC-tech","RTC-rollback");throw new IllegalStateException("rollback");})).isInstanceOf(IllegalStateException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM LoaiPhong WHERE maLoaiPhong LIKE N'RTC-%'",Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM BanGhiChongTrung WHERE nguoiThucHien LIKE N'RTC-%'",Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE nguoiThucHien LIKE N'RTC-%'",Integer.class)).isZero();
    }
    @Test void invalidSourceAfterApprovalConsumptionRestoresApprovalAndDoesNotMoveRoom(){
        service.create(request("RTC-01","100"),"RTC-tech","RTC-create");approve("RTC-01","RTC-submit","RTC-approve");service.activate("RTC-01","RTC-manager","RTC-active");
        jdbc.update("INSERT Phong(maPhong,maLoaiPhong) VALUES(N'RTC-room',N'RTC-01')");
        actor("RTC-tech","TECHNICAL");service.createRevision("RTC-01",request("RTC-02","200"),"RTC-tech","RTC-revision");
        long approval=approve("RTC-02","RTC-rev-submit","RTC-rev-approve");
        jdbc.update("UPDATE LoaiPhong SET trangThaiDanhMuc=N'Ngừng kinh doanh' WHERE maLoaiPhong=N'RTC-01'");
        code(()->service.activate("RTC-02","RTC-manager","RTC-rev-active"),"ROOM_TYPE_REVISION_SOURCE_INVALID");
        assertThat(jdbc.queryForObject("SELECT trangThai FROM YeuCauPheDuyet WHERE maYeuCauPheDuyet=?",String.class,approval)).isEqualTo("Đã phê duyệt");
        assertThat(jdbc.queryForObject("SELECT thoiDiemSuDung FROM YeuCauPheDuyet WHERE maYeuCauPheDuyet=?",Object.class,approval)).isNull();
        assertThat(jdbc.queryForObject("SELECT maLoaiPhong FROM Phong WHERE maPhong=N'RTC-room'",String.class)).isEqualTo("RTC-01");assertThat(service.priceHistory("RTC-02")).isEmpty();
    }
    @Test void concurrentCreationOfSameIdCommitsOnlyOneDraft()throws Exception{
        var results=concurrent(()->createAttempt("RTC-a"),()->createAttempt("RTC-b"));assertThat(results).containsExactlyInAnyOrder("OK","ROOM_TYPE_EXISTS");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM LoaiPhong WHERE maLoaiPhong=N'RTC-01'",Integer.class)).isEqualTo(1);
    }
    @Test void sameActivationKeyReplaysWithoutDoubleHistoryOrConsume()throws Exception{
        service.create(request("RTC-01","100"),"RTC-tech","RTC-create");approve("RTC-01","RTC-submit","RTC-approve");
        assertThat(concurrent(()->activateAttempt("RTC-active"),()->activateAttempt("RTC-active"))).containsExactly("OK","OK");assertThat(service.priceHistory("RTC-01")).hasSize(1);
    }
    @Test void differentActivationKeysCannotConsumeOneApprovalTwice()throws Exception{
        service.create(request("RTC-01","100"),"RTC-tech","RTC-create");approve("RTC-01","RTC-submit","RTC-approve");
        assertThat(concurrent(()->activateAttempt("RTC-active-a"),()->activateAttempt("RTC-active-b"))).containsExactlyInAnyOrder("OK","APPROVAL_REQUIRED");assertThat(service.priceHistory("RTC-01")).hasSize(1);
    }
    private RoomTypeAdminDtos.Request request(String id,String price){return new RoomTypeAdminDtos.Request(id,"RTC Type",new BigDecimal(price),"description");}
    private long approve(String id,String requestKey,String decisionKey){actor("RTC-tech","TECHNICAL");var pending=service.submit(id,"RTC-tech",requestKey);actor("RTC-manager","MANAGER");approvals.approve(pending.id(),"RTC-manager",decisionKey);return pending.id();}
    private String createAttempt(String key){actor("RTC-tech","TECHNICAL");try{service.create(request("RTC-01","100"),"RTC-tech",key);return "OK";}catch(DomainException error){return error.getCode();}finally{SecurityContextHolder.clearContext();}}
    private String activateAttempt(String key){actor("RTC-manager","MANAGER");try{service.activate("RTC-01","RTC-manager",key);return "OK";}catch(DomainException error){return error.getCode();}finally{SecurityContextHolder.clearContext();}}
    private void actor(String id,String role){SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(id,"test","ROLE_"+role));}
    private void code(Runnable operation,String code){assertThatThrownBy(operation::run).isInstanceOf(DomainException.class).extracting("code").isEqualTo(code);}
    private List<String> concurrent(Callable<String> first,Callable<String> second)throws Exception{
        var gate=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
        try{var a=pool.submit(()->{gate.await();return first.call();});var b=pool.submit(()->{gate.await();return second.call();});gate.countDown();return List.of(a.get(25,TimeUnit.SECONDS),b.get(25,TimeUnit.SECONDS));}finally{pool.shutdownNow();}
    }
}

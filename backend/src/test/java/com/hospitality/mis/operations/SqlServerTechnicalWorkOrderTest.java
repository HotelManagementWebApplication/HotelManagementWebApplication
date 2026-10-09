package com.hospitality.mis.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.operations.TechnicalWorkOrderDatabase;
import com.hospitality.mis.dto.operations.TechnicalWorkOrderDtos;
import com.hospitality.mis.service.operations.TechnicalWorkOrderService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Clock;
import java.util.List;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
class SqlServerTechnicalWorkOrderTest {
    private static final String WORKER="TKC-W",MANAGER="TKC-M",OTHER="TKC-X",ROOM="TKC-R";
    @Autowired JdbcTemplate jdbc;
    @Autowired TechnicalWorkOrderService technical;
    @Autowired TechnicalWorkOrderDatabase database;
    @Autowired Clock clock;
    @Autowired PlatformTransactionManager transactions;
    @Autowired com.hospitality.mis.service.operations.HousekeepingChecklistService checklists;
    @BeforeEach void seed(){cleanup();jdbc.update("INSERT LoaiPhong(maLoaiPhong,ten,giaTheoNgay) VALUES(N'TKC-T',N'Technical commands',100000)");jdbc.update("INSERT Phong(maPhong,maLoaiPhong) VALUES(?,N'TKC-T')",ROOM);actor(WORKER,"ROLE_TECHNICAL");}
    @AfterEach void cleanup(){
        jdbc.update("DELETE PhieuCongViecKyThuat WHERE maPhong=?",ROOM);
        jdbc.update("DELETE KetQuaChecklistBuongPhong WHERE maNhiemVuBuongPhong IN(SELECT maNhiemVuBuongPhong FROM NhiemVuBuongPhong WHERE maPhong=?)",ROOM);
        jdbc.update("DELETE NhiemVuBuongPhong WHERE maPhong=?",ROOM);
        jdbc.update("DELETE MauChecklistBuongPhong WHERE ten=N'TKC readiness item'");
        jdbc.update("DELETE Phong WHERE maPhong=?",ROOM);jdbc.update("DELETE LoaiPhong WHERE maLoaiPhong=N'TKC-T'");
        jdbc.update("DELETE BanGhiChongTrung WHERE khoaChongTrung LIKE N'tkc-%'");jdbc.update("DELETE NhatKyKiemSoat WHERE nguoiThucHien IN(?,?,?)",WORKER,MANAGER,OTHER);SecurityContextHolder.clearContext();
    }
    @Test void originalSnapshotReplaysAcrossServiceInstancesAndConflictsAreRejected(){
        var first=create("tkc-replay");update(first.id(),"ACKNOWLEDGED",null,"tkc-ack");
        assertThat(new TechnicalWorkOrderService(database,clock).create(request(),WORKER,"tkc-replay")).isEqualTo(first);
        code(()->technical.create(new TechnicalWorkOrderDtos.CreateRequest(ROOM,null,null,"LOW",null,null),WORKER,"tkc-replay"),"IDEMPOTENCY_KEY_CONFLICT");
        actor(OTHER,"ROLE_TECHNICAL");code(()->technical.create(request(),OTHER,"tkc-replay"),"IDEMPOTENCY_KEY_CONFLICT");
        assertThat(audits()).isEqualTo(2);assertThat(orders()).isEqualTo(1);
    }
    @Test void samePrincipalCannotCreateAndAcceptEvenWithManagementRole(){
        actor(MANAGER,"ROLE_MANAGER");
        var order=technical.create(new TechnicalWorkOrderDtos.CreateRequest(ROOM,null,WORKER,"HIGH",null,null),MANAGER,"tkc-manager-create");
        actor(WORKER,"ROLE_TECHNICAL");waiting(order.id());actor(MANAGER,"ROLE_MANAGER");
        code(()->technical.accept(order.id(),new TechnicalWorkOrderDtos.AcceptanceRequest("verified"),MANAGER,"tkc-self-accept"),"TECHNICAL_SELF_ACCEPTANCE_FORBIDDEN");
        actor(OTHER,"ROLE_DIRECTOR");assertThat(technical.accept(order.id(),new TechnicalWorkOrderDtos.AcceptanceRequest("verified"),OTHER,"tkc-other-accept").acceptedBy()).isEqualTo(OTHER);
        actor(WORKER,"ROLE_TECHNICAL");code(()->update(order.id(),"IN_PROGRESS",null,"tkc-closed"),"TECHNICAL_WORK_ORDER_CLOSED");
    }
    @Test void databaseFailureRollsBackRoomOrderAcceptanceAuditAndKey(){
        assertThatThrownBy(()->technical.create(new TechnicalWorkOrderDtos.CreateRequest(ROOM,null,null,"HIGH",null,"x".repeat(1001)),WORKER,"tkc-long-create")).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThat(orders()).isZero();assertThat(roomStatus()).isEqualTo("Sẵn sàng");assertThat(audits()).isZero();assertThat(claims("tkc-long-create")).isZero();
        var order=create("tkc-failure-create");waiting(order.id());actor(MANAGER,"ROLE_MANAGER");
        assertThatThrownBy(()->technical.accept(order.id(),new TechnicalWorkOrderDtos.AcceptanceRequest("x".repeat(501)),MANAGER,"tkc-long-accept")).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThat(technical.list(ROOM,null).getFirst().status()).isEqualTo("WAITING_ACCEPTANCE");assertThat(claims("tkc-long-accept")).isZero();assertThat(audits()).isEqualTo(4);
    }
    @Test void rollbackRemovesCreatedOrderRoomVersionAuditAndKey(){
        new TransactionTemplate(transactions).executeWithoutResult(tx->{create("tkc-rollback");tx.setRollbackOnly();});
        assertThat(orders()).isZero();assertThat(roomStatus()).isEqualTo("Sẵn sàng");assertThat(jdbc.queryForObject("SELECT phienBan FROM Phong WHERE maPhong=?",Long.class,ROOM)).isZero();assertThat(audits()).isZero();assertThat(claims("tkc-rollback")).isZero();
    }
    @Test void twoConnectionsReplayCreateAndUpdateWithoutDuplicateAudit()throws Exception{
        var created=race(WORKER,"ROLE_TECHNICAL",()->create("tkc-race-create"),()->create("tkc-race-create"));assertThat(created).containsExactly("SUCCESS","SUCCESS");assertThat(orders()).isEqualTo(1);assertThat(audits()).isEqualTo(1);
        long id=technical.list(ROOM,null).getFirst().id();assertThat(race(WORKER,"ROLE_TECHNICAL",()->update(id,"ACKNOWLEDGED",null,"tkc-race-update"),()->update(id,"ACKNOWLEDGED",null,"tkc-race-update"))).containsOnly("SUCCESS");assertThat(audits()).isEqualTo(2);
    }
    @Test void twoConnectionsWithDifferentKeysAcceptOnlyOnce()throws Exception{
        var order=create("tkc-accept-create");waiting(order.id());
        var results=race(MANAGER,"ROLE_MANAGER",()->accept(order.id(),"tkc-accept-a"),()->accept(order.id(),"tkc-accept-b"));
        assertThat(results).containsExactlyInAnyOrder("SUCCESS","INVALID_TECHNICAL_TRANSITION");assertThat(audits()).isEqualTo(5);
    }
    @Test void releaseChecksOtherOrdersBeforeReadinessAndTwoConnectionsReleaseOnlyOnce()throws Exception{
        var order=create("tkc-release-create");waiting(order.id());actor(MANAGER,"ROLE_MANAGER");accept(order.id(),"tkc-release-accept");actor(WORKER,"ROLE_TECHNICAL");
        var other=create("tkc-other-order");code(()->technical.release(order.id(),WORKER,"tkc-release-blocked"),"TECHNICAL_WORK_ORDER_NOT_READY");
        jdbc.update("DELETE PhieuCongViecKyThuat WHERE maPhieuCongViecKyThuat=?",other.id());
        jdbc.update("INSERT NhiemVuBuongPhong(maPhong,nguoiDuocPhanCong,trangThai,daHoanThanhChecklist,thoiDiemCapNhat) VALUES(?,?,N'Chờ kỹ thuật',1,SYSDATETIME())",ROOM,WORKER);
        assertThat(race(WORKER,"ROLE_TECHNICAL",()->technical.release(order.id(),WORKER,"tkc-release-a"),()->technical.release(order.id(),WORKER,"tkc-release-b"))).containsExactlyInAnyOrder("SUCCESS","TECHNICAL_ACCEPTANCE_REQUIRED");
        assertThat(roomStatus()).isEqualTo("Sẵn sàng");assertThat(audits()).isEqualTo(7);
    }
    @Test void readinessWriterWaitsForReleaseTransactionToCommit()throws Exception{
        var order=create("tkc-lock-create");waiting(order.id());actor(MANAGER,"ROLE_MANAGER");accept(order.id(),"tkc-lock-accept");actor(WORKER,"ROLE_TECHNICAL");
        Long task=jdbc.queryForObject("INSERT NhiemVuBuongPhong(maPhong,nguoiDuocPhanCong,trangThai,daHoanThanhChecklist,thoiDiemCapNhat) OUTPUT inserted.maNhiemVuBuongPhong VALUES(?,?,N'Chờ kỹ thuật',1,SYSDATETIME())",Long.class,ROOM,WORKER);
        jdbc.update("INSERT MauChecklistBuongPhong(ten) VALUES(N'TKC readiness item')");
        var writerStarted=new CountDownLatch(1);var result=new java.util.concurrent.atomic.AtomicReference<Future<?>>();
        try(var executor=Executors.newSingleThreadExecutor()){
            new TransactionTemplate(transactions).executeWithoutResult(tx->{
                technical.release(order.id(),WORKER,"tkc-lock-release");
                result.set(executor.submit(()->{actor(WORKER,"ROLE_HOUSEKEEPING");try{writerStarted.countDown();checklists.addResult(task,new com.hospitality.mis.dto.operations.HousekeepingChecklistDtos.ResultRequest("TKC readiness item",false,null),WORKER);}finally{SecurityContextHolder.clearContext();}}));
                try{assertThat(writerStarted.await(10,TimeUnit.SECONDS)).isTrue();assertThatThrownBy(()->result.get().get(500,TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);}catch(InterruptedException e){Thread.currentThread().interrupt();throw new AssertionError(e);}
                assertThat(jdbc.queryForObject("SELECT daHoanThanhChecklist FROM NhiemVuBuongPhong WHERE maNhiemVuBuongPhong=?",Boolean.class,task)).isTrue();
            });
            result.get().get(20,TimeUnit.SECONDS);
        }
        assertThat(jdbc.queryForObject("SELECT daHoanThanhChecklist FROM NhiemVuBuongPhong WHERE maNhiemVuBuongPhong=?",Boolean.class,task)).isFalse();
    }
    private List<String> race(String user,String role,Runnable first,Runnable second)throws Exception{
        var ready=new CountDownLatch(2);var start=new CountDownLatch(1);
        try(var executor=Executors.newFixedThreadPool(2)){
            var futures=List.of(first,second).stream().map(action->executor.submit(()->{actor(user,role);try{ready.countDown();if(!start.await(10,TimeUnit.SECONDS))throw new AssertionError("start timeout");action.run();return "SUCCESS";}catch(DomainException e){return e.getCode();}finally{SecurityContextHolder.clearContext();}})).toList();
            assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue();start.countDown();return List.of(futures.get(0).get(20,TimeUnit.SECONDS),futures.get(1).get(20,TimeUnit.SECONDS));
        }
    }
    private void waiting(Long id){update(id,"ACKNOWLEDGED",null,"tkc-ack-"+id);update(id,"IN_PROGRESS",null,"tkc-progress-"+id);update(id,"WAITING_ACCEPTANCE","fixed","tkc-wait-"+id);}
    private void accept(Long id,String key){technical.accept(id,new TechnicalWorkOrderDtos.AcceptanceRequest("verified"),MANAGER,key);}
    private TechnicalWorkOrderDtos.CreateRequest request(){return new TechnicalWorkOrderDtos.CreateRequest(ROOM,null,null,"HIGH",null,null);}
    private TechnicalWorkOrderDtos.Response create(String key){return technical.create(request(),WORKER,key);}
    private TechnicalWorkOrderDtos.Response update(Long id,String status,String note,String key){return technical.update(id,new TechnicalWorkOrderDtos.UpdateRequest(status,note,null,null),WORKER,key);}
    private int orders(){return jdbc.queryForObject("SELECT COUNT(*) FROM PhieuCongViecKyThuat WHERE maPhong=?",Integer.class,ROOM);}
    private int claims(String key){return jdbc.queryForObject("SELECT COUNT(*) FROM BanGhiChongTrung WHERE khoaChongTrung=?",Integer.class,key);}
    private int audits(){return jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE nguoiThucHien IN(?,?,?)",Integer.class,MANAGER,WORKER,OTHER);}
    private String roomStatus(){return jdbc.queryForObject("SELECT trangThai FROM Phong WHERE maPhong=?",String.class,ROOM);}
    private static void actor(String actor,String role){SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(actor,"",role));}
    private void code(Runnable action,String code){assertThatThrownBy(action::run).isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(code));}
}

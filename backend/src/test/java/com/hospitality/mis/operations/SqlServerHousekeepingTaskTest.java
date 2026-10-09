package com.hospitality.mis.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.operations.HousekeepingTaskDatabase;
import com.hospitality.mis.dto.operations.HousekeepingDtos;
import com.hospitality.mis.dto.operations.HousekeepingChecklistDtos;
import com.hospitality.mis.entity.operations.HousekeepingTaskStatus;
import com.hospitality.mis.service.operations.HousekeepingService;
import com.hospitality.mis.service.operations.HousekeepingChecklistService;
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
class SqlServerHousekeepingTaskTest {
    private static final String MANAGER="HKC-M",WORKER="HKC-W",OTHER="HKC-X",ROOM="HKC-R";
    @Autowired JdbcTemplate jdbc;
    @Autowired HousekeepingService housekeeping;
    @Autowired HousekeepingChecklistService checklists;
    @Autowired HousekeepingTaskDatabase database;
    @Autowired Clock clock;
    @Autowired PlatformTransactionManager transactions;
    @BeforeEach void seed(){
        cleanup();jdbc.update("INSERT LoaiPhong(maLoaiPhong,ten,giaTheoNgay) VALUES(N'HKC-T',N'Housekeeping commands',100000)");
        jdbc.update("INSERT Phong(maPhong,maLoaiPhong) VALUES(?,N'HKC-T')",ROOM);
        jdbc.update("INSERT MauChecklistBuongPhong(ten) VALUES(N'HKC mandatory')");actor(MANAGER,"ROLE_MANAGER");
    }
    @AfterEach void cleanup(){
        jdbc.update("DELETE PhieuCongViecKyThuat WHERE maPhong=?",ROOM);
        jdbc.update("DELETE KiemTraBuongPhong WHERE maNhiemVuBuongPhong IN(SELECT maNhiemVuBuongPhong FROM NhiemVuBuongPhong WHERE maPhong=?)",ROOM);
        jdbc.update("DELETE KetQuaChecklistBuongPhong WHERE maNhiemVuBuongPhong IN(SELECT maNhiemVuBuongPhong FROM NhiemVuBuongPhong WHERE maPhong=?)",ROOM);
        jdbc.update("DELETE NhiemVuBuongPhong WHERE maPhong=?",ROOM);
        jdbc.update("DELETE MauChecklistBuongPhong WHERE ten=N'HKC mandatory'");
        jdbc.update("DELETE Phong WHERE maPhong=?",ROOM);jdbc.update("DELETE LoaiPhong WHERE maLoaiPhong=N'HKC-T'");
        jdbc.update("DELETE BanGhiChongTrung WHERE khoaChongTrung LIKE N'hkc-%'");
        jdbc.update("DELETE NhatKyKiemSoat WHERE nguoiThucHien IN(?,?,?)",MANAGER,WORKER,OTHER);SecurityContextHolder.clearContext();
    }
    @Test void lifecycleAndPersistedReadinessRespectMaintenanceAndLatestChecklist(){
        var task=create("hkc-create");assertThat(task.assignee()).isEqualTo(WORKER);assertThat(task.note()).isNull();assertThat(roomStatus()).isEqualTo("Đang dọn phòng");assertThat(version()).isEqualTo(1);
        update(task.id(),"IN_PROGRESS","hkc-progress");update(task.id(),"CLEANED","hkc-cleaned");
        code(()->update(task.id(),"READY","hkc-no-checklist"),"HOUSEKEEPING_CHECKLIST_REQUIRED");
        for(var template:checklists.templates())checklists.addResult(task.id(),new HousekeepingChecklistDtos.ResultRequest(template.name(),true,null),MANAGER);
        jdbc.update("UPDATE Phong SET trangThai=N'Đang bảo trì' WHERE maPhong=?",ROOM);
        code(()->update(task.id(),"READY","hkc-maintenance"),"ROOM_MAINTENANCE_LOCKED");assertThat(claims("hkc-maintenance")).isZero();
        jdbc.update("UPDATE Phong SET trangThai=N'Đang dọn phòng' WHERE maPhong=?",ROOM);
        assertThat(update(task.id(),"READY","hkc-ready").status()).isEqualTo("READY");assertThat(roomStatus()).isEqualTo("Sẵn sàng");assertThat(version()).isEqualTo(2);
        code(()->update(task.id(),"IN_PROGRESS","hkc-reopen"),"INVALID_HOUSEKEEPING_TRANSITION");
    }
    @Test void durableReplayReturnsOriginalSnapshotAcrossServiceInstancesAndRoleScope(){
        var first=create("hkc-replay");update(first.id(),"IN_PROGRESS","hkc-mutate");
        var newInstance=new HousekeepingService(database,clock);
        assertThat(newInstance.create(request(),MANAGER,"hkc-replay")).isEqualTo(first);
        code(()->housekeeping.create(new HousekeepingDtos.CreateRequest(ROOM,WORKER,"changed"),MANAGER,"hkc-replay"),"IDEMPOTENCY_KEY_CONFLICT");
        actor(OTHER,"ROLE_MANAGER");code(()->housekeeping.create(request(),OTHER,"hkc-replay"),"IDEMPOTENCY_KEY_CONFLICT");
        assertThat(claims("hkc-replay")).isEqualTo(1);assertThat(taskCount()).isEqualTo(1);
    }
    @Test void ownershipAndAssignmentCannotCrossWorkerScope(){
        var task=create("hkc-scope-create");actor(OTHER,"ROLE_HOUSEKEEPING");
        code(()->housekeeping.update(task.id(),new HousekeepingDtos.UpdateRequest("IN_PROGRESS",null,null),OTHER,"hkc-scope-other"),"HOUSEKEEPING_TASK_SCOPE_FORBIDDEN");
        assertThat(housekeeping.list(ROOM,null,null,OTHER)).isEmpty();
        code(()->housekeeping.list(ROOM,WORKER,null,OTHER),"HOUSEKEEPING_TASK_SCOPE_FORBIDDEN");
        actor(WORKER,"ROLE_HOUSEKEEPING");
        code(()->housekeeping.create(request(),WORKER,"hkc-worker-create"),"HOUSEKEEPING_ASSIGNMENT_FORBIDDEN");
        code(()->housekeeping.update(task.id(),new HousekeepingDtos.UpdateRequest("IN_PROGRESS",null,OTHER),WORKER,"hkc-worker-assign"),"HOUSEKEEPING_ASSIGNMENT_FORBIDDEN");
        assertThat(housekeeping.list(ROOM,null,null,WORKER)).extracting(HousekeepingDtos.Response::id).containsExactly(task.id());
        actor(MANAGER,"ROLE_MANAGER");
        var updated=housekeeping.update(task.id(),new HousekeepingDtos.UpdateRequest("IN_PROGRESS","new note",OTHER),MANAGER,"hkc-manager-assign");
        assertThat(updated.assignee()).isEqualTo(OTHER);assertThat(updated.note()).isEqualTo("new note");
    }
    @Test void assignedHousekeeperCannotAcceptReadyAtServiceOrSqlBoundary(){
        var task=create("hkc-ready-denied-create");
        update(task.id(),"IN_PROGRESS","hkc-ready-denied-progress");
        update(task.id(),"CLEANED","hkc-ready-denied-cleaned");
        for(var template:checklists.templates())checklists.addResult(task.id(),new HousekeepingChecklistDtos.ResultRequest(template.name(),true,null),MANAGER);

        actor(WORKER,"ROLE_HOUSEKEEPING");
        int auditCount=audits();long roomVersion=version();
        code(()->housekeeping.update(task.id(),new HousekeepingDtos.UpdateRequest("READY",null,null),WORKER,"hkc-ready-denied-service"),"HOUSEKEEPING_ACCEPTANCE_FORBIDDEN");
        code(()->database.update(task.id(),new HousekeepingDtos.UpdateRequest("READY",null,null),HousekeepingTaskStatus.READY,WORKER,false,"hkc-ready-denied-sql","hash",java.time.LocalDateTime.now(clock)),"HOUSEKEEPING_ACCEPTANCE_FORBIDDEN");

        assertThat(jdbc.queryForObject("SELECT trangThai FROM NhiemVuBuongPhong WHERE maNhiemVuBuongPhong=?",String.class,task.id())).isEqualTo("Đã dọn xong");
        assertThat(roomStatus()).isEqualTo("Đang dọn phòng");assertThat(version()).isEqualTo(roomVersion);assertThat(audits()).isEqualTo(auditCount);
        assertThat(claims("hkc-ready-denied-service")).isZero();assertThat(claims("hkc-ready-denied-sql")).isZero();
    }
    @Test void invalidStateDatabaseFailureAndNotFoundLeaveNoClaimOrPartialUpdate(){
        code(()->housekeeping.create(new HousekeepingDtos.CreateRequest("missing",WORKER,null),MANAGER,"hkc-missing-room"),"ROOM_NOT_FOUND");
        assertThatThrownBy(()->housekeeping.create(new HousekeepingDtos.CreateRequest(ROOM,WORKER,"x".repeat(501)),MANAGER,"hkc-too-long")).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThat(taskCount()).isZero();assertThat(roomStatus()).isEqualTo("Sẵn sàng");assertThat(version()).isZero();assertThat(audits()).isZero();assertThat(claims("hkc-too-long")).isZero();
        var task=create("hkc-errors-create");
        code(()->update(task.id(),"READY","hkc-skip"),"INVALID_HOUSEKEEPING_TRANSITION");code(()->update(-1L,"IN_PROGRESS","hkc-missing-task"),"HOUSEKEEPING_TASK_NOT_FOUND");
        code(()->update(task.id(),"bad","hkc-invalid"),"INVALID_HOUSEKEEPING_STATUS");
        assertThatThrownBy(()->housekeeping.update(task.id(),new HousekeepingDtos.UpdateRequest("IN_PROGRESS",null,"x".repeat(11)),MANAGER,"hkc-long-assignee")).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThat(housekeeping.list(ROOM,null,null,MANAGER).getFirst().status()).isEqualTo("NEEDS_CLEANING");assertThat(audits()).isEqualTo(1);assertThat(claims("hkc-long-assignee")).isZero();
    }
    @Test void occupiedAndMaintenanceRoomsRequireAcceptedRepairs(){
        jdbc.update("UPDATE Phong SET trangThai=N'Đang có khách' WHERE maPhong=?",ROOM);code(()->create("hkc-occupied"),"ROOM_OCCUPIED");
        jdbc.update("UPDATE Phong SET trangThai=N'Đang bảo trì' WHERE maPhong=?",ROOM);code(()->create("hkc-locked"),"ROOM_MAINTENANCE_LOCKED");
        jdbc.update("INSERT PhieuCongViecKyThuat(maPhong,nguoiDuocPhanCong,doUuTien,trangThai,nguoiTao,thoiDiemTao,thoiDiemCapNhat) VALUES(?,?,N'Cao',N'Đã hoàn thành',?,SYSDATETIME(),SYSDATETIME())",ROOM,WORKER,MANAGER);
        assertThat(create("hkc-post-repair").status()).isEqualTo("NEEDS_CLEANING");assertThat(roomStatus()).isEqualTo("Đang dọn phòng");
    }
    @Test void outerRollbackRemovesTaskRoomVersionAuditAndDurableResult(){
        new TransactionTemplate(transactions).executeWithoutResult(tx->{create("hkc-rollback");tx.setRollbackOnly();});
        assertThat(taskCount()).isZero();assertThat(roomStatus()).isEqualTo("Sẵn sàng");assertThat(version()).isZero();assertThat(audits()).isZero();assertThat(claims("hkc-rollback")).isZero();
    }
    @Test void twoConnectionsSameKeyExecuteCreateAndUpdateOnlyOnce()throws Exception{
        var created=race(()->create("hkc-race-create"),()->create("hkc-race-create"));assertThat(created.get(0)).isEqualTo(created.get(1));assertThat(taskCount()).isEqualTo(1);assertThat(audits()).isEqualTo(1);
        long task=created.getFirst().id();var updated=race(()->update(task,"IN_PROGRESS","hkc-race-update"),()->update(task,"IN_PROGRESS","hkc-race-update"));
        assertThat(updated.get(0)).isEqualTo(updated.get(1));assertThat(audits()).isEqualTo(2);assertThat(version()).isEqualTo(1);
    }
    private List<HousekeepingDtos.Response> race(Callable<HousekeepingDtos.Response> first,Callable<HousekeepingDtos.Response> second)throws Exception{
        var ready=new CountDownLatch(2);var start=new CountDownLatch(1);
        try(var executor=Executors.newFixedThreadPool(2)){
            var futures=List.of(first,second).stream().map(action->executor.submit(()->{actor(MANAGER,"ROLE_MANAGER");try{ready.countDown();if(!start.await(10,TimeUnit.SECONDS))throw new AssertionError("start timeout");return action.call();}finally{SecurityContextHolder.clearContext();}})).toList();
            assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue();start.countDown();return List.of(futures.get(0).get(20,TimeUnit.SECONDS),futures.get(1).get(20,TimeUnit.SECONDS));
        }
    }
    private HousekeepingDtos.CreateRequest request(){return new HousekeepingDtos.CreateRequest(ROOM,WORKER,null);}
    private HousekeepingDtos.Response create(String key){return housekeeping.create(request(),MANAGER,key);}
    private HousekeepingDtos.Response update(Long task,String status,String key){return housekeeping.update(task,new HousekeepingDtos.UpdateRequest(status,null,null),MANAGER,key);}
    private int taskCount(){return jdbc.queryForObject("SELECT COUNT(*) FROM NhiemVuBuongPhong WHERE maPhong=?",Integer.class,ROOM);}
    private int claims(String key){return jdbc.queryForObject("SELECT COUNT(*) FROM BanGhiChongTrung WHERE khoaChongTrung=?",Integer.class,key);}
    private int audits(){return jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE nguoiThucHien IN(?,?,?)",Integer.class,MANAGER,WORKER,OTHER);}
    private long version(){return jdbc.queryForObject("SELECT phienBan FROM Phong WHERE maPhong=?",Long.class,ROOM);}
    private String roomStatus(){return jdbc.queryForObject("SELECT trangThai FROM Phong WHERE maPhong=?",String.class,ROOM);}
    private static void actor(String actor,String role){SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(actor,"",role));}
    private void code(Runnable action,String code){assertThatThrownBy(action::run).isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(code));}
}

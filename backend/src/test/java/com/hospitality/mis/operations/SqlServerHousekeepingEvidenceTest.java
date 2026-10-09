package com.hospitality.mis.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.operations.HousekeepingEvidenceDatabase;
import com.hospitality.mis.dto.operations.HousekeepingChecklistDtos;
import com.hospitality.mis.dto.operations.HousekeepingInspectionDtos;
import com.hospitality.mis.entity.operations.HousekeepingInspection;
import com.hospitality.mis.service.operations.HousekeepingChecklistService;
import com.hospitality.mis.service.operations.HousekeepingInspectionService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
class SqlServerHousekeepingEvidenceTest {
    private static final String WORKER="HKE-W",MANAGER="HKE-M",OTHER="HKE-X",FIRST="HKE checklist 1",SECOND="HKE checklist 2";
    @Autowired JdbcTemplate jdbc;
    @Autowired HousekeepingChecklistService checklists;
    @Autowired HousekeepingInspectionService inspections;
    @Autowired HousekeepingEvidenceDatabase database;
    @Autowired PlatformTransactionManager transactions;
    private Long task;
    @BeforeEach void seed(){
        cleanup();
        jdbc.update("INSERT LoaiPhong(maLoaiPhong,ten,giaTheoNgay) VALUES(N'HKE-T',N'Housekeeping evidence',100000)");
        jdbc.update("INSERT Phong(maPhong,maLoaiPhong) VALUES(N'HKE-R',N'HKE-T')");
        task=jdbc.queryForObject("INSERT NhiemVuBuongPhong(maPhong,nguoiDuocPhanCong,trangThai,thoiDiemCapNhat) OUTPUT inserted.maNhiemVuBuongPhong VALUES(N'HKE-R',?,N'Đang thực hiện',SYSDATETIME())",Long.class,WORKER);
        jdbc.update("INSERT MauChecklistBuongPhong(ten) VALUES(?),(?)",FIRST,SECOND);
        // Other active templates are unrelated fixtures but still required by the
        // production readiness contract. Seed their passed results for this task.
        jdbc.update("INSERT KetQuaChecklistBuongPhong(maNhiemVuBuongPhong,hangMuc,datYeuCau,nguoiHoanThanh,thoiDiemHoanThanh) SELECT ?,ten,1,?,SYSDATETIME() FROM MauChecklistBuongPhong WHERE dangHoatDong=1 AND ten NOT IN (?,?)",task,WORKER,FIRST,SECOND);
        actor(WORKER,"ROLE_HOUSEKEEPING");
    }
    @AfterEach void cleanup(){
        jdbc.update("DELETE KiemTraBuongPhong WHERE maNhiemVuBuongPhong IN(SELECT maNhiemVuBuongPhong FROM NhiemVuBuongPhong WHERE maPhong=N'HKE-R')");
        jdbc.update("DELETE KetQuaChecklistBuongPhong WHERE maNhiemVuBuongPhong IN(SELECT maNhiemVuBuongPhong FROM NhiemVuBuongPhong WHERE maPhong=N'HKE-R')");
        jdbc.update("DELETE NhiemVuBuongPhong WHERE maPhong=N'HKE-R'");
        jdbc.update("DELETE MauChecklistBuongPhong WHERE ten LIKE N'HKE %'");
        jdbc.update("DELETE Phong WHERE maPhong=N'HKE-R'");jdbc.update("DELETE LoaiPhong WHERE maLoaiPhong=N'HKE-T'");
        jdbc.update("DELETE NhatKyKiemSoat WHERE nguoiThucHien IN(?,?,?)",WORKER,MANAGER,OTHER);SecurityContextHolder.clearContext();
    }
    @Test void templateProjectionCreationAndDatabaseFailuresKeepAuditAtomic(){
        actor(MANAGER,"ROLE_MANAGER");
        var template=checklists.createTemplate(new HousekeepingChecklistDtos.TemplateRequest(" HKE new "),MANAGER);
        assertThat(template.id()).isPositive();assertThat(template.name()).isEqualTo("HKE new");assertThat(template.active()).isTrue();
        assertThat(checklists.templates()).contains(template);
        jdbc.update("UPDATE MauChecklistBuongPhong SET dangHoatDong=0 WHERE maMauChecklist=?",template.id());
        assertThat(checklists.templates()).doesNotContain(template);
        assertThatThrownBy(()->checklists.createTemplate(new HousekeepingChecklistDtos.TemplateRequest("HKE new"),MANAGER)).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThatThrownBy(()->checklists.createTemplate(new HousekeepingChecklistDtos.TemplateRequest("HKE "+"x".repeat(101)),MANAGER)).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        code(()->checklists.createTemplate(new HousekeepingChecklistDtos.TemplateRequest(" "),MANAGER),"HOUSEKEEPING_CHECKLIST_TEMPLATE_REQUIRED");
        assertThat(audits()).isEqualTo(1);
    }
    @Test void latestResultForEveryActiveTemplateControlsCompleteFlag(){
        add(FIRST,true);assertThat(complete()).isFalse();
        var second=add(SECOND,true);assertThat(complete()).isTrue();assertThat(second.item()).isEqualTo(SECOND);assertThat(second.completedBy()).isEqualTo(WORKER);assertThat(second.note()).isNull();
        add(FIRST,false);assertThat(complete()).isFalse();
        var latest=add(FIRST,true);assertThat(complete()).isTrue();
        assertThat(checklists.results(task)).filteredOn(r->r.item().startsWith("HKE ")).extracting(HousekeepingChecklistDtos.ResultResponse::id).isSorted();
        assertThat(checklists.results(task).getLast()).isEqualTo(latest);assertThat(audits()).isEqualTo(4);
        jdbc.update("UPDATE MauChecklistBuongPhong SET dangHoatDong=0 WHERE ten=?",FIRST);
        code(()->add(FIRST,true),"HOUSEKEEPING_CHECKLIST_ITEM_NOT_ACTIVE");
        code(()->add(SECOND.toLowerCase(),true),"HOUSEKEEPING_CHECKLIST_ITEM_NOT_ACTIVE");assertThat(audits()).isEqualTo(4);
    }
    @Test void inspectionDtoEnumsTrimNullsAndHistoryOrderArePreserved(){
        var first=inspections.add(task,inspection(" water ",HousekeepingInspection.ItemCondition.REFILLED),WORKER);
        var second=inspections.add(task,new HousekeepingInspectionDtos.Request(HousekeepingInspection.InspectionType.ROOM_ASSET,"safe",0,HousekeepingInspection.ItemCondition.MISSING,"inspect"),WORKER);
        assertThat(first.item()).isEqualTo("water");assertThat(first.itemCondition()).isEqualTo(HousekeepingInspection.ItemCondition.REFILLED);assertThat(first.note()).isNull();
        assertThat(first.completedBy()).isEqualTo(WORKER);assertThat(first.taskId()).isEqualTo(task);
        var auditTime=jdbc.queryForObject("SELECT thoiDiemTao FROM NhatKyKiemSoat WHERE nguoiThucHien=? AND duLieuSau=N'MINIBAR:water'",(r,n)->r.getObject(1,java.time.OffsetDateTime.class),WORKER);
        assertThat(auditTime.toInstant()).isEqualTo(first.completedAt().atZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());
        assertThat(inspections.list(task)).containsExactly(second,first);
        assertThat(jdbc.queryForObject("SELECT duLieuSau FROM NhatKyKiemSoat WHERE nguoiThucHien=? AND duLieuSau=N'MINIBAR:water'",String.class,WORKER)).isEqualTo("MINIBAR:water");
        assertThat(audits()).isEqualTo(2);
    }
    @Test void anotherWorkerCannotReadOrWriteEitherKindOfEvidence(){
        actor(OTHER,"ROLE_HOUSEKEEPING");
        code(()->checklists.addResult(task,result(FIRST,true),OTHER),"HOUSEKEEPING_TASK_SCOPE_FORBIDDEN");
        code(()->inspections.add(task,inspection("water",HousekeepingInspection.ItemCondition.OK),OTHER),"HOUSEKEEPING_TASK_SCOPE_FORBIDDEN");
        code(()->checklists.results(task),"HOUSEKEEPING_TASK_SCOPE_FORBIDDEN");code(()->inspections.list(task),"HOUSEKEEPING_TASK_SCOPE_FORBIDDEN");
        code(()->checklists.addResult(task,result(FIRST,true),WORKER),"ACTOR_MISMATCH");assertThat(audits()).isZero();
        actor(MANAGER,"ROLE_MANAGER");assertThat(inspections.add(task,inspection("water",HousekeepingInspection.ItemCondition.OK),MANAGER).completedBy()).isEqualTo(MANAGER);
        assertThat(checklists.results(task)).isNotNull();assertThat(audits()).isEqualTo(1);
    }
    @Test void closedMissingAndInvalidRequestsProduceNoEvidenceOrAudit(){
        code(()->checklists.addResult(-1L,result(FIRST,true),WORKER),"HOUSEKEEPING_TASK_NOT_FOUND");code(()->inspections.list(-1L),"HOUSEKEEPING_TASK_NOT_FOUND");
        code(()->checklists.addResult(task,new HousekeepingChecklistDtos.ResultRequest(" ",true,null),WORKER),"INVALID_REQUEST");
        code(()->inspections.add(task,new HousekeepingInspectionDtos.Request(HousekeepingInspection.InspectionType.MINIBAR,"water",-1,HousekeepingInspection.ItemCondition.OK,null),WORKER),"INVALID_REQUEST");
        jdbc.update("UPDATE NhiemVuBuongPhong SET trangThai=N'Sẵn sàng' WHERE maNhiemVuBuongPhong=?",task);
        code(()->add(FIRST,true),"HOUSEKEEPING_TASK_CLOSED");code(()->inspections.add(task,inspection("water",HousekeepingInspection.ItemCondition.OK),WORKER),"HOUSEKEEPING_TASK_CLOSED");
        assertThat(inspections.list(task)).isEmpty();assertThat(audits()).isZero();
    }
    @Test void databaseErrorDoesNotSaveResultOrChangeCompletionOrAudit(){
        int before=checklists.results(task).size();
        assertThatThrownBy(()->checklists.addResult(task,new HousekeepingChecklistDtos.ResultRequest(FIRST,true,"x".repeat(501)),WORKER)).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThatThrownBy(()->inspections.add(task,inspection("x".repeat(101),HousekeepingInspection.ItemCondition.OK),WORKER)).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThat(checklists.results(task)).hasSize(before);assertThat(complete()).isFalse();assertThat(inspections.list(task)).isEmpty();assertThat(audits()).isZero();
    }
    @Test void ambientRollbackUndoesResultsFlagInspectionAndAudit(){
        int before=checklists.results(task).size();
        new TransactionTemplate(transactions).executeWithoutResult(tx->{add(FIRST,true);add(SECOND,true);inspections.add(task,inspection("water",HousekeepingInspection.ItemCondition.OK),WORKER);assertThat(complete()).isTrue();tx.setRollbackOnly();});
        assertThat(complete()).isFalse();assertThat(checklists.results(task)).hasSize(before);assertThat(inspections.list(task)).isEmpty();assertThat(audits()).isZero();
    }
    @Test void procedureRechecksAssignmentAndStateAfterEarlierRead(){
        database.requireAccess(task,WORKER,false,true);
        jdbc.update("UPDATE NhiemVuBuongPhong SET nguoiDuocPhanCong=? WHERE maNhiemVuBuongPhong=?",OTHER,task);
        code(()->database.addResult(task,result(FIRST,true),WORKER,false,LocalDateTime.now()),"HOUSEKEEPING_TASK_SCOPE_FORBIDDEN");
        code(()->database.addInspection(task,inspection("water",HousekeepingInspection.ItemCondition.OK),WORKER,false,LocalDateTime.now()),"HOUSEKEEPING_TASK_SCOPE_FORBIDDEN");
        jdbc.update("UPDATE NhiemVuBuongPhong SET nguoiDuocPhanCong=?,trangThai=N'Sẵn sàng' WHERE maNhiemVuBuongPhong=?",WORKER,task);
        code(()->database.addResult(task,result(FIRST,true),WORKER,false,LocalDateTime.now()),"HOUSEKEEPING_TASK_CLOSED");assertThat(audits()).isZero();
    }
    @Test void concurrentDifferentItemsDoNotLoseCompletedFlag()throws Exception{
        race(()->add(FIRST,true),()->add(SECOND,true));assertThat(complete()).isTrue();assertThat(audits()).isEqualTo(2);
    }
    @Test void concurrentOppositeResultsUseLatestIdentityNotLostUpdate()throws Exception{
        add(SECOND,true);race(()->add(FIRST,true),()->add(FIRST,false));
        boolean latest=jdbc.queryForObject("SELECT TOP(1) datYeuCau FROM KetQuaChecklistBuongPhong WHERE maNhiemVuBuongPhong=? AND hangMuc=? ORDER BY maKetQuaChecklist DESC",Boolean.class,task,FIRST);
        assertThat(complete()).isEqualTo(latest);assertThat(audits()).isEqualTo(3);
    }
    private void race(Runnable first,Runnable second)throws Exception{
        var ready=new CountDownLatch(2);var start=new CountDownLatch(1);
        try(var executor=Executors.newFixedThreadPool(2)){
            var actions=List.of(first,second);var futures=actions.stream().map(action->executor.submit(()->{actor(WORKER,"ROLE_HOUSEKEEPING");try{ready.countDown();if(!start.await(10,TimeUnit.SECONDS))throw new AssertionError("start timeout");action.run();return true;}finally{SecurityContextHolder.clearContext();}})).toList();
            assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue();start.countDown();for(var future:futures)assertThat(future.get(20,TimeUnit.SECONDS)).isTrue();
        }
    }
    private HousekeepingChecklistDtos.ResultRequest result(String item,boolean passed){return new HousekeepingChecklistDtos.ResultRequest(item,passed,null);}
    private HousekeepingChecklistDtos.ResultResponse add(String item,boolean passed){return checklists.addResult(task,result(item,passed),WORKER);}
    private HousekeepingInspectionDtos.Request inspection(String item,HousekeepingInspection.ItemCondition condition){return new HousekeepingInspectionDtos.Request(HousekeepingInspection.InspectionType.MINIBAR,item,1,condition,null);}
    private boolean complete(){return jdbc.queryForObject("SELECT daHoanThanhChecklist FROM NhiemVuBuongPhong WHERE maNhiemVuBuongPhong=?",Boolean.class,task);}
    private int audits(){return jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE nguoiThucHien IN(?,?,?)",Integer.class,WORKER,MANAGER,OTHER);}
    private static void actor(String actor,String role){SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(actor,"",role));}
    private void code(Runnable action,String code){assertThatThrownBy(action::run).isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(code));}
}

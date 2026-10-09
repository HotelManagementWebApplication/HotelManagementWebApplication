package com.hospitality.mis.governance;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.governance.ApprovalDtos;
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
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
class ApprovalServiceTest {
    @Autowired ApprovalService service;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager manager;
    @BeforeEach @AfterEach void cleanup(){
        jdbc.update("DELETE BanGhiChongTrung WHERE nguoiThucHien LIKE N'APV-%'");
        jdbc.update("DELETE NhatKyKiemSoat WHERE nguoiThucHien LIKE N'APV-%' OR maDoiTuong IN(SELECT CONVERT(NVARCHAR(100),maYeuCauPheDuyet) FROM YeuCauPheDuyet WHERE nguoiYeuCau LIKE N'APV-%') AND loaiDoiTuong=N'APPROVAL'");
        jdbc.update("DELETE YeuCauPheDuyet WHERE nguoiYeuCau LIKE N'APV-%'");
        SecurityContextHolder.clearContext();
    }
    ApprovalDtos.Response request(String action){actor("APV-requester","FRONT_DESK");return service.request("APV-requester",action,"APV-target","{\"price\":10}",new BigDecimal("10"),"reason","APV-"+action);}
    @Test void expiredPendingCannotBeApprovedAndListExpiresItWithOneAudit(){
        var request=request("PRICE_OVERRIDE");jdbc.update("UPDATE YeuCauPheDuyet SET thoiDiemHetHan=DATEADD(SECOND,-1,SYSDATETIMEOFFSET()) WHERE maYeuCauPheDuyet=?",request.id());
        actor("APV-manager","MANAGER");code(()->service.approve(request.id(),"APV-manager"),"APPROVAL_EXPIRED");
        assertThat(status(request.id())).isEqualTo("Chờ phê duyệt");
        assertThat(service.list("EXPIRED")).anyMatch(row->row.id().equals(request.id()));
        service.list("EXPIRED");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE hanhDong=N'APPROVAL_EXPIRED' AND loaiDoiTuong=N'APPROVAL' AND maDoiTuong=?",Integer.class,request.id().toString())).isEqualTo(1);
    }
    @Test void requesterCannotApproveOrRejectOwnRequest(){
        var request=request("PRICE_OVERRIDE");code(()->service.approve(request.id(),"APV-requester"),"SELF_APPROVAL_FORBIDDEN");code(()->service.reject(request.id(),"APV-requester"),"SELF_APPROVAL_FORBIDDEN");assertThat(status(request.id())).isEqualTo("Chờ phê duyệt");
    }
    @Test void exactBindingRejectsWrongActionTargetPayloadAmountAndRequester(){
        var request=request("PRICE_OVERRIDE");actor("APV-manager","MANAGER");service.approve(request.id(),"APV-manager");
        actor("APV-requester","FRONT_DESK");
        code(()->service.consumeApproved("BILLING_ADJUSTMENT","APV-target",request.payload(),request.amount(),"APV-requester"),"APPROVAL_REQUIRED");
        code(()->service.consumeApproved("PRICE_OVERRIDE","other",request.payload(),request.amount(),"APV-requester"),"APPROVAL_REQUIRED");
        code(()->service.consumeApproved("PRICE_OVERRIDE","APV-target","other",request.amount(),"APV-requester"),"APPROVAL_REQUIRED");
        code(()->service.consumeApproved("PRICE_OVERRIDE","APV-target",request.payload(),new BigDecimal("11"),"APV-requester"),"APPROVAL_REQUIRED");
        actor("APV-other","FRONT_DESK");code(()->service.consumeApproved("PRICE_OVERRIDE","APV-target",request.payload(),request.amount(),"APV-other"),"APPROVAL_REQUIRED");
        assertThat(status(request.id())).isEqualTo("Đã phê duyệt");
    }
    @Test void requesterConsumeIsOnceOnlyAndReadOnlyRequireDoesNotConsume(){
        var request=request("PRICE_OVERRIDE");actor("APV-manager","MANAGER");service.approve(request.id(),"APV-manager");
        actor("APV-requester","FRONT_DESK");service.requireApproved(request.action(),request.targetId(),request.payload(),request.amount(),"APV-requester");
        assertThat(status(request.id())).isEqualTo("Đã phê duyệt");
        var consumed=service.consumeApproved(request.action(),request.targetId(),request.payload(),request.amount(),"APV-requester");
        assertThat(consumed.status()).isEqualTo("CONSUMED");assertThat(consumed.consumedAt()).isNotNull();
        code(()->service.consumeApproved(request.action(),request.targetId(),request.payload(),request.amount(),"APV-requester"),"APPROVAL_REQUIRED");
    }
    @Test void onlyDirectorCanApproveOrRejectRefund(){
        var request=request("PAYMENT_REFUND");actor("APV-manager","MANAGER");code(()->service.approve(request.id(),"APV-manager"),"DIRECTOR_APPROVAL_REQUIRED");code(()->service.reject(request.id(),"APV-manager"),"DIRECTOR_APPROVAL_REQUIRED");
        actor("APV-director","DIRECTOR");assertThat(service.approve(request.id(),"APV-director").status()).isEqualTo("APPROVED");
    }
    @Test void durableReplayReturnsCurrentDecisionAndConflictingKeysFail(){
        var request=request("PRICE_OVERRIDE");
        assertThat(service.request("APV-requester",request.action(),request.targetId(),request.payload(),new BigDecimal("10"),"reason","APV-PRICE_OVERRIDE").id()).isEqualTo(request.id());
        code(()->service.request("APV-requester",request.action(),request.targetId(),"other",request.amount(),"reason","APV-PRICE_OVERRIDE"),"IDEMPOTENCY_KEY_CONFLICT");
        actor("APV-manager","MANAGER");var approved=service.approve(request.id(),"APV-manager","APV-approve");assertThat(service.approve(request.id(),"APV-manager","APV-approve")).isEqualTo(approved);
        code(()->service.reject(request.id(),"APV-manager","APV-reject"),"APPROVAL_ALREADY_DECIDED");
    }
    @Test void consumeAndTargetMutationRollbackTogether(){
        var request=request("ROOM_TYPE_ACTIVATE");actor("APV-manager","MANAGER");service.approve(request.id(),"APV-manager");
        new TransactionTemplate(manager).executeWithoutResult(tx->{service.consumeApprovedByApprover(request.action(),request.targetId(),request.payload(),request.amount(),"APV-manager");tx.setRollbackOnly();});
        assertThat(status(request.id())).isEqualTo("Đã phê duyệt");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE hanhDong=N'APPROVAL_CONSUMED' AND maDoiTuong=?",Integer.class,request.id().toString())).isZero();
        assertThat(service.consumeApprovedByApprover(request.action(),request.targetId(),request.payload(),request.amount(),"APV-manager").status()).isEqualTo("CONSUMED");
    }
    @Test void storageFailureRollsBackRequestAuditAndClaim(){
        actor("APV-requester","FRONT_DESK");
        assertThatThrownBy(()->service.request("APV-requester","PRICE_OVERRIDE","APV-target","{}",null,"x".repeat(501),"APV-too-long")).isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM YeuCauPheDuyet WHERE nguoiYeuCau=N'APV-requester'",Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM BanGhiChongTrung WHERE nguoiThucHien=N'APV-requester'",Integer.class)).isZero();
    }
    @Test void validationAndMissingApprovalErrorsDoNotWrite(){
        actor("APV-requester","FRONT_DESK");
        code(()->service.request("APV-requester","NOT_SUPPORTED","target","{}",null,"reason","key"),"UNSUPPORTED_APPROVAL");
        code(()->service.request("APV-requester","PRICE_OVERRIDE","target","{}",new BigDecimal("-1"),"reason","key"),"INVALID_APPROVAL_REQUEST");
        code(()->service.approve(Long.MAX_VALUE,"APV-requester"),"APPROVAL_NOT_FOUND");
        code(()->service.consumeApproved("PRICE_OVERRIDE","target","APV-requester"),"APPROVAL_PAYLOAD_REQUIRED");
    }
    @Test void twoConcurrentDecisionsHaveOneWinner()throws Exception{
        var request=request("PRICE_OVERRIDE");CountDownLatch ready=new CountDownLatch(2),start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)){
            var a=pool.submit(()->decide(request.id(),"APV-manager-a",ready,start));var b=pool.submit(()->decide(request.id(),"APV-manager-b",ready,start));
            assertThat(ready.await(5,TimeUnit.SECONDS)).isTrue();start.countDown();
            assertThat(java.util.List.of(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder("APPROVED","APPROVAL_ALREADY_DECIDED");
        }
    }
    String decide(Long id,String actor,CountDownLatch ready,CountDownLatch start)throws Exception{
        actor(actor,"MANAGER");ready.countDown();assertThat(start.await(5,TimeUnit.SECONDS)).isTrue();
        try{return service.approve(id,actor,"APV-"+actor).status();}catch(DomainException failure){return failure.getCode();}finally{SecurityContextHolder.clearContext();}
    }
    String status(Long id){return jdbc.queryForObject("SELECT trangThai FROM YeuCauPheDuyet WHERE maYeuCauPheDuyet=?",String.class,id);}
    static void actor(String id,String role){SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(id,"n/a","ROLE_"+role));}
    static void code(Runnable call,String code){assertThatThrownBy(call::run).isInstanceOf(DomainException.class).extracting("code").isEqualTo(code);}
}

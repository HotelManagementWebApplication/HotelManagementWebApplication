package com.hospitality.mis.governance;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.governance.*;
import com.hospitality.mis.entity.governance.ApprovalRequest;
import com.hospitality.mis.service.governance.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
class DurableIdempotencyServiceTest {
    @Autowired DurableIdempotencyService service;
    @Autowired IdempotencyDatabase database;
    @Autowired ObjectMapper mapper;
    @Autowired Clock clock;
    @Autowired ApprovalRepository approvals;
    @Autowired PlatformTransactionManager manager;
    @Autowired JdbcTemplate jdbc;
    @BeforeEach @AfterEach void clean(){
        jdbc.update("DELETE YeuCauPheDuyet WHERE nguoiYeuCau=N'IDC-requester'");
        jdbc.update("DELETE BanGhiChongTrung WHERE nguoiThucHien LIKE N'IDC-%'");
    }
    TransactionTemplate tx(){return new TransactionTemplate(manager);}
    @Test void bulkClearDoesNotDetachCompletion(){
        Instant now=Instant.now();String fingerprint=ApprovalService.fingerprintFor("150000.00");
        var approval=new ApprovalRequest("IDC-requester","ROOM_TYPE_ACTIVATE","IDC-TYPE","150000.00",fingerprint,null,"regression",now.plusSeconds(3600),"IDC-clear",now);
        approval.approve("IDC-manager",now);Long id=approvals.saveAndFlush(approval).getId();AtomicInteger runs=new AtomicInteger();
        TestResponse first=tx().execute(status->service.execute("IDC-clear","same","IDC-manager","hash",TestResponse.class,()->{
            runs.incrementAndGet();
            assertThat(approvals.consumeApprovedForActivationIfCurrent(id,"ROOM_TYPE_ACTIVATE","IDC-TYPE",fingerprint,null,now,now,"IDC-manager")).isEqualTo(1);
            return new TestResponse(1,"activated");
        }));
        TestResponse replay=tx().execute(status->service.execute("IDC-clear","same","IDC-manager","hash",TestResponse.class,()->{throw new AssertionError("must replay");}));
        assertThat(replay).isEqualTo(first);assertThat(runs).hasValue(1);
        assertThat(jdbc.queryForObject("SELECT trangThai FROM BanGhiChongTrung WHERE phamViLenh=N'IDC-clear'",String.class)).isEqualTo("Đã hoàn tất");
    }
    @Test void replaySurvivesANewServiceInstanceAndRejectsActorPayloadOrResultType(){
        TestResponse first=tx().execute(status->service.execute("IDC-test","same","IDC-a","hash",TestResponse.class,()->new TestResponse(1,"ok")));
        var restarted=new DurableIdempotencyService(database,mapper,clock);
        TestResponse replay=tx().execute(status->restarted.execute("IDC-test","same","IDC-a","hash",TestResponse.class,()->{throw new AssertionError("must replay");}));
        assertThat(replay).isEqualTo(first);
        assertThatThrownBy(()->tx().execute(status->service.execute("IDC-test","same","IDC-b","hash",TestResponse.class,()->first))).isInstanceOf(DomainException.class);
        assertThatThrownBy(()->tx().execute(status->service.execute("IDC-test","same","IDC-a","other",TestResponse.class,()->first))).isInstanceOf(DomainException.class);
        assertThatThrownBy(()->tx().execute(status->service.execute("IDC-test","same","IDC-a","hash",OtherResponse.class,()->new OtherResponse("bad")))).isInstanceOf(DomainException.class);
    }
    @Test void businessFailureAndOuterRollbackRemoveClaimAndAllowRetry(){
        assertThatThrownBy(()->tx().execute(status->service.execute("IDC-failure","same","IDC-a","hash",TestResponse.class,()->{throw new IllegalStateException("business failure");}))).isInstanceOf(IllegalStateException.class);
        tx().executeWithoutResult(status->{service.execute("IDC-failure","same","IDC-a","hash",TestResponse.class,()->new TestResponse(1,"rollback"));status.setRollbackOnly();});
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM BanGhiChongTrung WHERE phamViLenh=N'IDC-failure'",Integer.class)).isZero();
        TestResponse retry=tx().execute(status->service.execute("IDC-failure","same","IDC-a","hash",TestResponse.class,()->new TestResponse(2,"retry")));
        assertThat(retry.value()).isEqualTo(2);
    }
    @Test void concurrentNewKeyRunsOnlyOnceOnTwoDatabaseConnections()throws Exception{
        AtomicInteger runs=new AtomicInteger();CountDownLatch ready=new CountDownLatch(2),start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)){
            Callable<TestResponse> call=()->{ready.countDown();assertThat(start.await(5,TimeUnit.SECONDS)).isTrue();return tx().execute(status->service.execute("IDC-concurrent","new","IDC-a","hash",TestResponse.class,()->new TestResponse(runs.incrementAndGet(),"ok")));};
            var a=pool.submit(call);var b=pool.submit(call);assertThat(ready.await(5,TimeUnit.SECONDS)).isTrue();start.countDown();
            assertThat(a.get(15,TimeUnit.SECONDS)).isEqualTo(new TestResponse(1,"ok"));assertThat(b.get(15,TimeUnit.SECONDS)).isEqualTo(new TestResponse(1,"ok"));
        }
        assertThat(runs).hasValue(1);
    }
    @Test void missingInfrastructureFailsClosedWithoutRunningBusinessCommand(){
        AtomicInteger runs=new AtomicInteger();short bucket=(short)Math.floorMod(("IDC-missing"+'\u0000'+"same").hashCode(),64);
        tx().executeWithoutResult(status->{
            jdbc.update("DELETE NhomKhoaChongTrung WHERE maNhomKhoa=?",bucket);
            assertThatThrownBy(()->service.execute("IDC-missing","same","IDC-a","hash",TestResponse.class,()->new TestResponse(runs.incrementAndGet(),"bad"))).isInstanceOf(org.springframework.dao.DataAccessException.class);
            status.setRollbackOnly();
        });
        assertThat(runs).hasValue(0);assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM NhomKhoaChongTrung",Integer.class)).isEqualTo(64);
    }
    @Test void aggregateReplayChecksItsMarkerAndDoesNotExecuteCommandTwice(){
        AtomicInteger runs=new AtomicInteger();
        TestResponse first=tx().execute(status->service.executeWithReplay("IDC-loader","same","IDC-a","hash",()->new TestResponse(runs.incrementAndGet(),"first"),()->{throw new AssertionError();}));
        TestResponse second=tx().execute(status->service.executeWithReplay("IDC-loader","same","IDC-a","hash",()->{throw new AssertionError();},()->new TestResponse(99,"reloaded")));
        assertThat(first.value()).isEqualTo(1);assertThat(second.value()).isEqualTo(99);assertThat(runs).hasValue(1);
    }
    @Test void oversizedResponseBeyondFourKilobytesIsStoredAndReplayedIntact(){
        String message="x".repeat(8000);TestResponse first=tx().execute(status->service.execute("IDC-large","same","IDC-a","hash",TestResponse.class,()->new TestResponse(1,message)));
        TestResponse second=tx().execute(status->service.execute("IDC-large","same","IDC-a","hash",TestResponse.class,()->{throw new AssertionError();}));
        assertThat(second).isEqualTo(first);
    }
    public record TestResponse(int value,String message){}
    public record OtherResponse(String message){}
}

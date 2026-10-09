package com.hospitality.mis.inventory;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.operations.InventoryMovementDtos;
import com.hospitality.mis.service.operations.InventoryMovementService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/** SQL Server proof: competing ISSUE commands serialize on the service row lock. */
@SpringBootTest(properties = {
        "spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}",
        "spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=true", "spring.jpa.hibernate.ddl-auto=validate"
})
class SqlServerInventoryConcurrencyTest {
    private static final String SERVICE_ID = "CINV01";
    private static final String ACTOR = "cinv01";

    @Autowired JdbcTemplate jdbc;
    @Autowired InventoryMovementService inventory;
    @Autowired com.fasterxml.jackson.databind.ObjectMapper mapper;

    @BeforeEach
    void seed() {
        cleanup();
        jdbc.update("insert into DichVu(maDichVu, ten, gia, donViTinh, soLuongTonKho, nguongAnToan, dangHoatDong) values (?,?,?,?,?,?,?)",
                SERVICE_ID, "Concurrency minibar", new BigDecimal("10000"), "đơn vị", 1, 0, true);
    }

    @AfterEach
    void cleanup() {
        jdbc.update("delete from BanGhiChongTrung where phamViLenh = ? and nguoiThucHien = ?",
                "inventory-movement", ACTOR);
        jdbc.update("delete from BienDongKhoDichVu where maDichVu = ?", SERVICE_ID);
        jdbc.update("delete from DichVu where maDichVu = ?", SERVICE_ID);
        jdbc.update("delete from NhatKyKiemSoat where nguoiThucHien = ?", ACTOR);
    }

    @Test
    void competingIssueCommandsCannotDriveStockBelowZero() throws Exception {
        var requestA = request("issue-a");
        var requestB = request("issue-b");
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> issueWhenReleased(requestA, ready, start));
            var second = executor.submit(() -> issueWhenReleased(requestB, ready, start));
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            assertThat(List.of(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder("SUCCESS", "INSUFFICIENT_STOCK");
        }
        assertThat(jdbc.queryForObject("select soLuongTonKho from DichVu where maDichVu = ?", Integer.class, SERVICE_ID)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from BienDongKhoDichVu where maDichVu = ?", Integer.class, SERVICE_ID)).isEqualTo(1);
    }

    @Test
    void replaySurvivesNewServiceInstanceAndRejectsChangedPayloadOrActor() {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(ACTOR,"","ROLE_KITCHEN"));
        try {
            var request=new InventoryMovementDtos.CreateRequest(SERVICE_ID,com.hospitality.mis.entity.operations.InventoryMovement.MovementType.RECEIVE,2,"delivery");
            var first=inventory.record(request,ACTOR,"durable-replay");
            var restarted=new InventoryMovementService(new com.hospitality.mis.dao.operations.ServiceInventoryDatabase(jdbc,mapper),java.time.Clock.system(java.time.ZoneId.of("Asia/Ho_Chi_Minh")));
            assertThat(restarted.record(request,ACTOR,"durable-replay")).isEqualTo(first);
            org.assertj.core.api.Assertions.assertThatThrownBy(()->inventory.record(new InventoryMovementDtos.CreateRequest(SERVICE_ID,request.type(),3,request.reason()),ACTOR,"durable-replay"))
                .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo("IDEMPOTENCY_KEY_CONFLICT"));
            SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("other","","ROLE_KITCHEN"));
            org.assertj.core.api.Assertions.assertThatThrownBy(()->inventory.record(request,"other","durable-replay"))
                .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo("IDEMPOTENCY_KEY_CONFLICT"));
            assertThat(jdbc.queryForObject("SELECT soLuongTonKho FROM DichVu WHERE maDichVu=?",Integer.class,SERVICE_ID)).isEqualTo(3);
            assertThat(inventory.list(SERVICE_ID)).hasSize(1);
        } finally {SecurityContextHolder.clearContext();}
    }

    @Test
    void failedCommandHasNoMovementAuditOrClaimAndSignedAdjustIsReported() {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(ACTOR,"","ROLE_KITCHEN"));
        try {
            var tooMany=new InventoryMovementDtos.CreateRequest(SERVICE_ID,com.hospitality.mis.entity.operations.InventoryMovement.MovementType.ISSUE,2,"too many");
            org.assertj.core.api.Assertions.assertThatThrownBy(()->inventory.record(tooMany,ACTOR,"rollback"))
                .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo("INSUFFICIENT_STOCK"));
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM BanGhiChongTrung WHERE nguoiThucHien=?",Integer.class,ACTOR)).isZero();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE nguoiThucHien=?",Integer.class,ACTOR)).isZero();
            assertThat(inventory.list(SERVICE_ID)).isEmpty();
            inventory.record(new InventoryMovementDtos.CreateRequest(SERVICE_ID,com.hospitality.mis.entity.operations.InventoryMovement.MovementType.ADJUST,-1,"count"),ACTOR,"signed-adjust");
            assertThat(inventory.report(SERVICE_ID,null,null).adjusted()).isEqualTo(-1);
            assertThat(inventory.report(SERVICE_ID,null,null).netChange()).isEqualTo(-1);
            assertThat(jdbc.queryForObject("SELECT soLuongTonKho FROM DichVu WHERE maDichVu=?",Integer.class,SERVICE_ID)).isZero();
        } finally {SecurityContextHolder.clearContext();}
    }

    @Test
    void twoConnectionsWithSameKeyCommitOneCommandAndReturnSameResult() throws Exception {
        var ready=new CountDownLatch(2);var start=new CountDownLatch(1);
        try(var executor=Executors.newFixedThreadPool(2)) {
            var first=executor.submit(()->issueWhenReleased(request("issue-a"),ready,start));
            var second=executor.submit(()->issueWhenReleased(request("issue-a"),ready,start));
            assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue();start.countDown();
            assertThat(List.of(first.get(20,TimeUnit.SECONDS),second.get(20,TimeUnit.SECONDS))).containsOnly("SUCCESS");
        }
        assertThat(inventory.list(SERVICE_ID)).hasSize(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE nguoiThucHien=?",Integer.class,ACTOR)).isEqualTo(1);
    }

    private InventoryMovementDtos.CreateRequest request(String key) {
        return new InventoryMovementDtos.CreateRequest(SERVICE_ID,
                com.hospitality.mis.entity.operations.InventoryMovement.MovementType.ISSUE, 1, "concurrent issue " + key);
    }

    private String issueWhenReleased(InventoryMovementDtos.CreateRequest request, CountDownLatch ready, CountDownLatch start) throws Exception {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(ACTOR, "", "ROLE_KITCHEN"));
        try {
            ready.countDown();
            assertThat(start.await(10, TimeUnit.SECONDS)).isTrue();
            inventory.record(request, ACTOR, request.reason().substring(request.reason().length() - 7));
            return "SUCCESS";
        } catch (DomainException exception) {
            return exception.getCode();
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}

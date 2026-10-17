package com.hospitality.mis.governance;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.entity.governance.ApprovalRequest;
import com.hospitality.mis.service.governance.ApprovalService;
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

/** SQL Server proof that an approved mutation is consumed by one concurrent worker only. */
@SpringBootTest(properties = {
        "spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}",
        "spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
class SqlServerApprovalConcurrencyTest {
    @Autowired ApprovalService approvalService;
    @Autowired JdbcTemplate jdbc;
    private Long approvalId;

    @BeforeEach
    void seed() {
        cleanup();
        authenticate("kitchen", "KITCHEN");
        approvalId = approvalService.request("kitchen", "SERVICE_PRICE_CHANGE", "SQLSERVER-SERVICE",
                "150000.00", new BigDecimal("150000.00"), "SQL Server approval", "sqlserver-approval-1").id();
        authenticate("manager", "MANAGER");
        approvalService.approve(approvalId, "manager");
    }

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
        jdbc.update("delete from YeuCauPheDuyet where khoaLienKet like 'sqlserver-approval-%'");
        jdbc.update("delete from NhatKyKiemSoat where khoaLienKet like 'sqlserver-approval-%' or maDoiTuong = ?", String.valueOf(approvalId));
        jdbc.update("delete from BanGhiChongTrung where phamViLenh like 'approval-%'");
    }

    @Test
    void concurrentExactActivationConsumesOneApproval() throws Exception {
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> consumeWhenReleased(ready, start));
            var second = executor.submit(() -> consumeWhenReleased(ready, start));
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            assertThat(List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder("SUCCESS", "APPROVAL_REQUIRED");
            assertThat(jdbc.queryForObject("select trangThai from YeuCauPheDuyet where maYeuCauPheDuyet = ?", String.class, approvalId))
                    .isEqualTo("Đã sử dụng");
        }
    }

    private String consumeWhenReleased(CountDownLatch ready, CountDownLatch start) throws Exception {
        authenticate("manager", "MANAGER");
        ready.countDown();
        assertThat(start.await(10, TimeUnit.SECONDS)).isTrue();
        try {
        approvalService.consumeApprovedByApprover("SERVICE_PRICE_CHANGE", "SQLSERVER-SERVICE",
                    "150000.00", new BigDecimal("150000.00"), "manager");
            return "SUCCESS";
        } catch (DomainException exception) {
            return exception.getCode();
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private static void authenticate(String actor, String role) {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken(actor, "test", "ROLE_" + role));
    }
}

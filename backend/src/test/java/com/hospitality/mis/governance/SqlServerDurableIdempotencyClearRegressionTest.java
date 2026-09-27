package com.hospitality.mis.governance;

import com.hospitality.mis.dao.governance.ApprovalRepository;
import com.hospitality.mis.entity.governance.ApprovalRequest;
import com.hospitality.mis.service.governance.ApprovalService;
import com.hospitality.mis.service.governance.DurableIdempotencyService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/** The same real JPA clear/re-attach proof against an explicitly configured SQL Server schema. */
@SpringBootTest(properties = {
        "spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}",
        "spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
class SqlServerDurableIdempotencyClearRegressionTest {
    private static final String SCOPE = "sqlserver-clear-regression";
    private static final String KEY = "sqlserver-clear-regression";
    private static final String CORRELATION = "sqlserver-clear-regression-approval";

    @Autowired DurableIdempotencyService service;
    @Autowired ApprovalRepository approvals;
    @Autowired TransactionTemplate transactions;
    @Autowired JdbcTemplate jdbc;

    @AfterEach
    void cleanup() {
        jdbc.update("delete from BanGhiChongTrung where phamViLenh = ? and khoaChongTrung = ?",
                SCOPE, KEY);
        jdbc.update("delete from YeuCauPheDuyet where khoaLienKet = ?", CORRELATION);
    }

    @Test
    void approvalBulkClearStillCompletesAndReplaysDurableRecord() {
        String payload = "150000.00";
        String fingerprint = ApprovalService.fingerprintFor(payload);
        Instant now = Instant.now();
        ApprovalRequest approval = new ApprovalRequest("sqlserver-requester", "ROOM_TYPE_ACTIVATE",
                "SQLSERVER-TYPE-CLEAR", payload, fingerprint, null, "clear regression",
                now.plusSeconds(3600), CORRELATION, now);
        approval.approve("sqlserver-manager", now);
        ApprovalRequest savedApproval = approvals.saveAndFlush(approval);
        AtomicInteger executions = new AtomicInteger();

        Response first = transactions.execute(status -> service.execute(SCOPE, KEY, "sqlserver-manager",
                "sqlserver-clear-hash", Response.class, () -> {
                    executions.incrementAndGet();
                    Long approvalId = approvals.findApprovedForActivationId("ROOM_TYPE_ACTIVATE",
                            "SQLSERVER-TYPE-CLEAR", fingerprint, null).orElseThrow();
                    assertThat(approvals.consumeApprovedForActivationIfCurrent(approvalId,
                            "ROOM_TYPE_ACTIVATE", "SQLSERVER-TYPE-CLEAR", fingerprint, null,
                            now, now, "sqlserver-manager")).isEqualTo(1);
                    return new Response(savedApproval.getId().intValue(), "activated");
                }));

        assertThat(jdbc.queryForObject("select trangThai from BanGhiChongTrung "
                + "where phamViLenh = ? and khoaChongTrung = ?", String.class, SCOPE, KEY))
                .isEqualTo("Đã hoàn tất");
        assertThat(jdbc.queryForObject("select phanHoiJson from BanGhiChongTrung "
                + "where phamViLenh = ? and khoaChongTrung = ?", String.class, SCOPE, KEY))
                .contains("activated");

        Response replay = transactions.execute(status -> service.execute(SCOPE, KEY, "sqlserver-manager",
                "sqlserver-clear-hash", Response.class, () -> {
                    executions.incrementAndGet();
                    throw new AssertionError("replay must not execute the durable command body");
                }));

        assertThat(replay).isEqualTo(first);
        assertThat(executions).hasValue(1);
    }

    private record Response(int approvalId, String outcome) {}
}

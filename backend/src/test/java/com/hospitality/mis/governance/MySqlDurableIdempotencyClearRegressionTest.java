package com.hospitality.mis.governance;

import com.hospitality.mis.dao.governance.ApprovalRepository;
import com.hospitality.mis.entity.governance.ApprovalRequest;
import com.hospitality.mis.service.governance.ApprovalService;
import com.hospitality.mis.service.governance.DurableIdempotencyService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/** The same real JPA clear/re-attach proof against an explicitly configured MySQL schema. */
@SpringBootTest(properties = {
        "spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}",
        "spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
@EnabledIfEnvironmentVariable(named = "MIGRATION_TEST_DB_URL", matches = ".+")
class MySqlDurableIdempotencyClearRegressionTest {
    private static final String SCOPE = "mysql-clear-regression";
    private static final String KEY = "mysql-clear-regression";
    private static final String CORRELATION = "mysql-clear-regression-approval";

    @Autowired DurableIdempotencyService service;
    @Autowired ApprovalRepository approvals;
    @Autowired TransactionTemplate transactions;
    @Autowired JdbcTemplate jdbc;

    @AfterEach
    void cleanup() {
        jdbc.update("delete from idempotency_records where command_scope = ? and idempotency_key = ?",
                SCOPE, KEY);
        jdbc.update("delete from approval_requests where correlation_key = ?", CORRELATION);
    }

    @Test
    void approvalBulkClearStillCompletesAndReplaysDurableRecord() {
        String payload = "150000.00";
        String fingerprint = ApprovalService.fingerprintFor(payload);
        Instant now = Instant.now();
        ApprovalRequest approval = new ApprovalRequest("mysql-requester", "ROOM_TYPE_ACTIVATE",
                "MYSQL-TYPE-CLEAR", payload, fingerprint, null, "clear regression",
                now.plusSeconds(3600), CORRELATION, now);
        approval.approve("mysql-manager", now);
        ApprovalRequest savedApproval = approvals.saveAndFlush(approval);
        AtomicInteger executions = new AtomicInteger();

        Response first = transactions.execute(status -> service.execute(SCOPE, KEY, "mysql-manager",
                "mysql-clear-hash", Response.class, () -> {
                    executions.incrementAndGet();
                    Long approvalId = approvals.findApprovedForActivationId("ROOM_TYPE_ACTIVATE",
                            "MYSQL-TYPE-CLEAR", fingerprint, null).orElseThrow();
                    assertThat(approvals.consumeApprovedForActivationIfCurrent(approvalId,
                            "ROOM_TYPE_ACTIVATE", "MYSQL-TYPE-CLEAR", fingerprint, null,
                            now, now, "mysql-manager")).isEqualTo(1);
                    return new Response(savedApproval.getId().intValue(), "activated");
                }));

        assertThat(jdbc.queryForObject("select status from idempotency_records "
                + "where command_scope = ? and idempotency_key = ?", String.class, SCOPE, KEY))
                .isEqualTo("COMPLETED");
        assertThat(jdbc.queryForObject("select response_json from idempotency_records "
                + "where command_scope = ? and idempotency_key = ?", String.class, SCOPE, KEY))
                .contains("activated");

        Response replay = transactions.execute(status -> service.execute(SCOPE, KEY, "mysql-manager",
                "mysql-clear-hash", Response.class, () -> {
                    executions.incrementAndGet();
                    throw new AssertionError("replay must not execute the durable command body");
                }));

        assertThat(replay).isEqualTo(first);
        assertThat(executions).hasValue(1);
    }

    private record Response(int approvalId, String outcome) {}
}

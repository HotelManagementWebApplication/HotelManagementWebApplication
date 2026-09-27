package com.hospitality.mis.governance;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.governance.ApprovalRepository;
import com.hospitality.mis.dao.governance.IdempotencyRecordRepository;
import com.hospitality.mis.entity.governance.ApprovalRequest;
import com.hospitality.mis.service.governance.DurableIdempotencyService;
import com.hospitality.mis.service.governance.ApprovalService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:durable-idempotency;MODE=MSSQLServer;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa", "spring.datasource.password=",
        "spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"
})
class DurableIdempotencyServiceTest {
    @Autowired DurableIdempotencyService service;
    @Autowired IdempotencyRecordRepository records;
    @Autowired ApprovalRepository approvals;
    @Autowired TransactionTemplate transactions;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void clear() {
        approvals.deleteAllInBatch();
        records.deleteAll();
        for (int value = 0; value < 64; value++) {
            jdbc.update("MERGE INTO NhomKhoaChongTrung(maNhomKhoa) KEY(maNhomKhoa) VALUES (?)", value);
        }
    }

    @Test
    void approvalBulkClearStillCompletesAndReplaysDurableRecord() {
        String payload = "150000.00";
        String fingerprint = ApprovalService.fingerprintFor(payload);
        Instant now = Instant.now();
        ApprovalRequest approval = new ApprovalRequest("requester", "ROOM_TYPE_ACTIVATE", "TYPE-CLEAR",
                payload, fingerprint, null, "clear regression", now.plusSeconds(3600),
                "approval-clear-regression", now);
        approval.approve("manager", now);
        ApprovalRequest savedApproval = approvals.saveAndFlush(approval);
        AtomicInteger executions = new AtomicInteger();

        TestResponse first = transactions.execute(status -> service.execute("room-type-activate",
                "clear-regression", "manager", "hash-clear", TestResponse.class, () -> {
                    executions.incrementAndGet();
                    Long approvalId = approvals.findApprovedForActivationId("ROOM_TYPE_ACTIVATE", "TYPE-CLEAR",
                            fingerprint, null).orElseThrow();
                    assertThat(approvals.consumeApprovedForActivationIfCurrent(approvalId, "ROOM_TYPE_ACTIVATE",
                            "TYPE-CLEAR", fingerprint, null, now, now, "manager")).isEqualTo(1);
                    return new TestResponse(savedApproval.getId().intValue(), "activated");
                }));

        assertThat(jdbc.queryForObject("select trangThai from BanGhiChongTrung "
                + "where phamViLenh = ? and khoaChongTrung = ?", String.class,
                "room-type-activate", "clear-regression")).isEqualTo("Đã hoàn tất");
        assertThat(jdbc.queryForObject("select phanHoiJson from BanGhiChongTrung "
                + "where phamViLenh = ? and khoaChongTrung = ?", String.class,
                "room-type-activate", "clear-regression")).contains("activated");

        TestResponse replay = transactions.execute(status -> service.execute("room-type-activate",
                "clear-regression", "manager", "hash-clear", TestResponse.class, () -> {
                    executions.incrementAndGet();
                    throw new AssertionError("replay must not execute the durable command body");
                }));

        assertThat(replay).isEqualTo(first);
        assertThat(executions).hasValue(1);
    }

    @Test
    void committedResultIsReplayedWithoutRunningCommandAgain() {
        AtomicInteger executions = new AtomicInteger();
        TestResponse first = transactions.execute(status -> service.execute("test-command", "same-key", "actor-1",
                "hash-1", TestResponse.class, () -> new TestResponse(executions.incrementAndGet(), "ok")));
        TestResponse replay = transactions.execute(status -> service.execute("test-command", "same-key", "actor-1",
                "hash-1", TestResponse.class, () -> new TestResponse(executions.incrementAndGet(), "duplicate")));

        assertThat(first).isEqualTo(new TestResponse(1, "ok"));
        assertThat(replay).isEqualTo(first);
        assertThat(executions).hasValue(1);
        assertThat(records.count()).isEqualTo(1);
    }

    @Test
    void sameKeyCannotBeReusedForAnotherActorOrPayload() {
        transactions.executeWithoutResult(status -> service.execute("test-command", "same-key", "actor-1",
                "hash-1", TestResponse.class, () -> new TestResponse(1, "ok")));

        assertThatThrownBy(() -> transactions.execute(status -> service.execute("test-command", "same-key", "actor-2",
                "hash-2", TestResponse.class, () -> new TestResponse(2, "bad"))))
                .isInstanceOf(DomainException.class);
    }

    @Test
    void concurrentCallsWithTheSameNewKeyExecuteOnlyOnce() throws Exception {
        AtomicInteger executions = new AtomicInteger();
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var command = (java.util.concurrent.Callable<TestResponse>) () -> {
                ready.countDown();
                assertThat(start.await(5, TimeUnit.SECONDS)).isTrue();
                return transactions.execute(status -> service.execute("concurrent-command", "new-key", "actor-1",
                        "hash-1", TestResponse.class, () -> {
                            int value = executions.incrementAndGet();
                            try { Thread.sleep(100); } catch (InterruptedException exception) {
                                Thread.currentThread().interrupt();
                                throw new IllegalStateException(exception);
                            }
                            return new TestResponse(value, "ok");
                        }));
            };
            var first = executor.submit(command);
            var second = executor.submit(command);
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            assertThat(first.get(10, TimeUnit.SECONDS)).isEqualTo(new TestResponse(1, "ok"));
            assertThat(second.get(10, TimeUnit.SECONDS)).isEqualTo(new TestResponse(1, "ok"));
        }
        assertThat(executions).hasValue(1);
    }

    @Test
    void concurrentUniqueClaimWorksWithoutLockBucketRows() throws Exception {
        jdbc.update("delete from NhomKhoaChongTrung");
        long bucketsBefore = jdbc.queryForObject("select count(*) from NhomKhoaChongTrung", Long.class);
        assertThat(bucketsBefore).isZero();
        AtomicInteger executions = new AtomicInteger();
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var command = (java.util.concurrent.Callable<TestResponse>) () -> {
                ready.countDown();
                assertThat(start.await(5, TimeUnit.SECONDS)).isTrue();
                return transactions.execute(status -> service.execute("bucket-free-command", "same-key", "actor-1",
                        "hash-1", TestResponse.class, () -> {
                            int value = executions.incrementAndGet();
                            try { Thread.sleep(100); } catch (InterruptedException exception) {
                                Thread.currentThread().interrupt();
                                throw new IllegalStateException(exception);
                            }
                            return new TestResponse(value, "ok");
                        }));
            };
            var first = executor.submit(command);
            var second = executor.submit(command);
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            assertThat(first.get(10, TimeUnit.SECONDS)).isEqualTo(new TestResponse(1, "ok"));
            assertThat(second.get(10, TimeUnit.SECONDS)).isEqualTo(new TestResponse(1, "ok"));
        }
        assertThat(executions).hasValue(1);
        assertThat(jdbc.queryForObject("select count(*) from NhomKhoaChongTrung", Long.class))
                .isEqualTo(bucketsBefore);
    }

    public record TestResponse(int value, String message) {}
}

package com.hospitality.mis.governance;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.governance.ApprovalRepository;
import com.hospitality.mis.dao.governance.AuditLogRepository;
import com.hospitality.mis.dao.governance.IdempotencyRecordRepository;
import com.hospitality.mis.entity.governance.ApprovalRequest;
import com.hospitality.mis.service.governance.ApprovalService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Integration proof for exact approval binding, separated actors, expiry and single consumption. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:approval-behavior;MODE=MSSQLServer;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class ApprovalBehaviorIntegrationTest {
    @Autowired ApprovalService approvalService;
    @Autowired ApprovalRepository approvals;
    @Autowired AuditLogRepository audits;
    @Autowired IdempotencyRecordRepository idempotencyRecords;

    @BeforeEach
    void clean() {
        SecurityContextHolder.clearContext();
        idempotencyRecords.deleteAll();
        approvals.deleteAll();
        audits.deleteAll();
    }

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void exactApprovalCanBeActivatedByDifferentApproverOnlyOnce() {
        authenticate("kitchen", "KITCHEN");
        ApprovalRequest requested = approvalService.request("kitchen", "SERVICE_PRICE_CHANGE", "SERVICE01",
                "125000.00", new BigDecimal("125000.00"), "Seasonal price", "approval-service-1");

        assertThatThrownBy(() -> approvalService.approve(requested.getId(), "kitchen"))
                .isInstanceOf(DomainException.class)
                .extracting("code").isEqualTo("SELF_APPROVAL_FORBIDDEN");
        assertThat(approvals.findById(requested.getId()).orElseThrow().getStatus())
                .isEqualTo(ApprovalRequest.PENDING);

        authenticate("manager", "MANAGER");
        ApprovalRequest approved = approvalService.approve(requested.getId(), "manager");
        assertThat(approved.getApprover()).isEqualTo("manager");

        assertThatThrownBy(() -> approvalService.consumeApprovedByApprover("SERVICE_PRICE_CHANGE", "SERVICE01",
                "125001.00", new BigDecimal("125001.00"), "manager"))
                .isInstanceOf(DomainException.class)
                .extracting("code").isEqualTo("APPROVAL_REQUIRED");

        ApprovalRequest consumed = approvalService.consumeApprovedByApprover("SERVICE_PRICE_CHANGE", "SERVICE01",
                "125000.00", new BigDecimal("125000.00"), "manager");
        assertThat(consumed.getStatus()).isEqualTo(ApprovalRequest.CONSUMED);
        assertThat(consumed.getConsumedAt()).isNotNull();
        assertThatThrownBy(() -> approvalService.consumeApprovedByApprover("SERVICE_PRICE_CHANGE", "SERVICE01",
                "125000.00", new BigDecimal("125000.00"), "manager"))
                .isInstanceOf(DomainException.class)
                .extracting("code").isEqualTo("APPROVAL_REQUIRED");
    }

    @Test
    void refundApprovalCannotBeExecutedByDifferentRequesterWithoutApprovalIdBinding() {
        authenticate("front-desk", "FRONT_DESK");
        ApprovalRequest requested = approvalService.request("front-desk", "PAYMENT_REFUND", "77",
                "{\"invoice_id\":77,\"idempotency_key\":\"refund-1\",\"method\":\"CASH\",\"type\":\"REFUND\",\"reference\":\"customer-request\"}",
                new BigDecimal("10.00"), "Customer refund", "approval-refund-1");

        authenticate("director", "DIRECTOR");
        ApprovalRequest approved = approvalService.approve(requested.getId(), "director", "approval-refund-approve-1");
        assertThat(approved.getStatus()).isEqualTo(ApprovalRequest.APPROVED);
        assertThat(approved.getRequester()).isEqualTo("front-desk");

        authenticate("accounting", "ACCOUNTING");
        assertThatThrownBy(() -> approvalService.requireApproved("PAYMENT_REFUND", "77",
                approved.getMutationPayload(), new BigDecimal("10.00"), "accounting"))
                .isInstanceOf(DomainException.class)
                .extracting("code").isEqualTo("APPROVAL_REQUIRED");
        assertThat(approvals.findById(requested.getId()).orElseThrow().getStatus())
                .isEqualTo(ApprovalRequest.APPROVED);
    }

    @Test
    void concurrentExactActivationHasOneAtomicWinner() throws Exception {
        authenticate("kitchen", "KITCHEN");
        ApprovalRequest requested = approvalService.request("kitchen", "SERVICE_PRICE_CHANGE", "SERVICE-CONCURRENT",
                "125000.00", new BigDecimal("125000.00"), "Concurrent activation", "approval-service-concurrent");
        authenticate("manager", "MANAGER");
        approvalService.approve(requested.getId(), "manager");

        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> activateWhenReleased(ready, start));
            var second = executor.submit(() -> activateWhenReleased(ready, start));
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            assertThat(List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder("SUCCESS", "APPROVAL_REQUIRED");
        }
        assertThat(approvals.findById(requested.getId()).orElseThrow().getStatus())
                .isEqualTo(ApprovalRequest.CONSUMED);
    }

    @Test
    void expiredPendingApprovalIsPersistedAsExpiredBeforeItLeavesTheQueue() {
        ApprovalRequest expired = new ApprovalRequest("kitchen", "SERVICE_PRICE_CHANGE", "SERVICE02",
                "90000.00", ApprovalService.fingerprintFor("90000.00"), new BigDecimal("90000.00"),
                "Expired request", Instant.now().minusSeconds(1), "approval-service-expired", Instant.now().minusSeconds(2));
        approvals.saveAndFlush(expired);

        assertThat(approvalService.list(ApprovalRequest.EXPIRED)).hasSize(1)
                .allMatch(item -> item.getStatus().equals(ApprovalRequest.EXPIRED));
        assertThat(approvals.findById(expired.getId()).orElseThrow().getStatus())
                .isEqualTo(ApprovalRequest.EXPIRED);
    }

    private static void authenticate(String actor, String role) {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken(actor, "test", "ROLE_" + role));
    }

    private String activateWhenReleased(CountDownLatch ready, CountDownLatch start) throws Exception {
        authenticate("manager", "MANAGER");
        ready.countDown();
        assertThat(start.await(10, TimeUnit.SECONDS)).isTrue();
        try {
            approvalService.consumeApprovedByApprover("SERVICE_PRICE_CHANGE", "SERVICE-CONCURRENT",
                    "125000.00", new BigDecimal("125000.00"), "manager");
            return "SUCCESS";
        } catch (DomainException exception) {
            return exception.getCode();
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}

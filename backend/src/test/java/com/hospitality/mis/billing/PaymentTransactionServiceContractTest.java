package com.hospitality.mis.billing;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.billing.InvoiceRepository;
import com.hospitality.mis.dao.billing.PaymentTransactionRepository;
import com.hospitality.mis.dto.billing.PaymentTransactionDtos;
import com.hospitality.mis.entity.billing.Invoice;
import com.hospitality.mis.entity.billing.PaymentMethod;
import com.hospitality.mis.entity.billing.PaymentTransaction;
import com.hospitality.mis.entity.identity.Employee;
import com.hospitality.mis.entity.reservation.Reservation;
import com.hospitality.mis.service.billing.PaymentTransactionService;
import com.hospitality.mis.service.billing.PricingPolicy;
import com.hospitality.mis.service.governance.ApprovalService;
import com.hospitality.mis.service.governance.AuditService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class PaymentTransactionServiceContractTest {
    private final PaymentTransactionRepository transactions = mock(PaymentTransactionRepository.class);
    private final InvoiceRepository invoices = mock(InvoiceRepository.class);
    private final ApprovalService approvals = mock(ApprovalService.class);
    private final AuditService audit = mock(AuditService.class);
    private final List<PaymentTransaction> ledger = new ArrayList<>();
    private PaymentTransactionService service;
    private Invoice invoice;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("clerk", "secret", "ROLE_FRONT_DESK"));
        Employee employee = new Employee();
        employee.setEmployeeId("clerk");
        Reservation reservation = new Reservation();
        reservation.setEmployee(employee);
        invoice = new Invoice();
        ReflectionTestUtils.setField(invoice, "id", 7L);
        invoice.setReservation(reservation);
        invoice.setRoomTotal(new BigDecimal("1000.00"));

        when(invoices.findForUpdate(7L)).thenReturn(Optional.of(invoice));
        when(transactions.findByInvoiceIdAndStatus(eq(7L), any(PaymentTransaction.TransactionStatus.class)))
                .thenAnswer(invocation -> ledger);
        when(transactions.findByIdempotencyKeyPrefix(anyString())).thenAnswer(invocation -> ledger.stream()
                .filter(row -> row.getStoredIdempotencyKey() != null
                        && row.getStoredIdempotencyKey().startsWith(invocation.getArgument(0, String.class)))
                .toList());
        when(transactions.saveAndFlush(any(PaymentTransaction.class))).thenAnswer(invocation -> {
            PaymentTransaction saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", (long) ledger.size() + 1);
            ledger.add(saved);
            return saved;
        });
        service = new PaymentTransactionService(transactions, invoices, approvals, audit,
                new PricingPolicy(3, 20, new BigDecimal("10")));
    }

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void sameKeyRetryReplaysOneDurableLedgerEntry() {
        var request = request("400.00", "terminal-1");

        var first = service.record(7L, request, "clerk", "retry-key");
        var replay = service.record(7L, request, "clerk", "retry-key");

        assertThat(replay.id()).isEqualTo(first.id());
        assertThat(ledger).hasSize(1);
        verify(transactions, times(1)).saveAndFlush(any(PaymentTransaction.class));
    }

    @Test
    void sameKeyWithDifferentCanonicalPayloadConflicts() {
        service.record(7L, request("400.00", "terminal-1"), "clerk", "retry-key");

        assertThatThrownBy(() -> service.record(7L,
                request("401.00", "terminal-1"), "clerk", "retry-key"))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("payload khác");
        assertThat(ledger).hasSize(1);
    }

    @Test
    void overpaymentIsRejectedBeforeLedgerWrite() {
        assertThatThrownBy(() -> service.record(7L,
                request("1000.01", "terminal-1"), "clerk", "overpay-key"))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("vượt số dư");
        assertThat(ledger).isEmpty();
        verify(transactions, never()).saveAndFlush(any(PaymentTransaction.class));
    }

    @Test
    void refundRequiresReasonAndApprovedBinding() {
        var noReason = new PaymentTransactionDtos.CreateRequest(new BigDecimal("10.00"), PaymentMethod.CASH,
                PaymentTransaction.TransactionType.REFUND, null);
        assertThatThrownBy(() -> service.record(7L, noReason, "clerk", "refund-no-reason"))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("lý do");

        doThrow(new DomainException("APPROVAL_REQUIRED", "Thao tác cần được phê duyệt trước"))
                .when(approvals).requireApproved(anyString(), anyString(), anyString(), any(), anyString());
        var noApproval = new PaymentTransactionDtos.CreateRequest(new BigDecimal("10.00"), PaymentMethod.CASH,
                PaymentTransaction.TransactionType.REFUND, "customer-request");
        assertThatThrownBy(() -> service.record(7L, noApproval, "clerk", "refund-no-approval"))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("phê duyệt");
        assertThat(ledger).isEmpty();
    }

    private PaymentTransactionDtos.CreateRequest request(String amount, String reference) {
        return new PaymentTransactionDtos.CreateRequest(new BigDecimal(amount), PaymentMethod.CASH,
                PaymentTransaction.TransactionType.PAYMENT, reference);
    }
}

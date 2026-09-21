package com.hospitality.mis.billing;

import com.hospitality.mis.dao.billing.*;
import com.hospitality.mis.dao.operations.EquipmentIncidentRepository;
import com.hospitality.mis.dao.reservation.ReservationRepository;
import com.hospitality.mis.dto.billing.PaymentTransactionDtos;
import com.hospitality.mis.entity.billing.Invoice;
import com.hospitality.mis.entity.billing.PaymentMethod;
import com.hospitality.mis.entity.billing.PaymentTransaction;
import com.hospitality.mis.entity.billing.Receipt;
import com.hospitality.mis.entity.identity.Employee;
import com.hospitality.mis.entity.reservation.Reservation;
import com.hospitality.mis.entity.finance.FinancialLedgerEntry;
import com.hospitality.mis.service.billing.PaymentTransactionService;
import com.hospitality.mis.service.billing.BillingService;
import com.hospitality.mis.service.billing.PricingPolicy;
import com.hospitality.mis.service.finance.FinancialLedgerService;
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
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Positive contract tests for payment reconciliation, retry binding, refunds, and the financial ledger. */
class PaymentLedgerServiceTest {
    private final PaymentTransactionRepository transactions = mock(PaymentTransactionRepository.class);
    private final InvoiceRepository invoices = mock(InvoiceRepository.class);
    private final ApprovalService approvals = mock(ApprovalService.class);
    private final AuditService audit = mock(AuditService.class);
    private final FinancialLedgerService financialLedger = mock(FinancialLedgerService.class);
    private final List<PaymentTransaction> rows = new ArrayList<>();
    private Invoice invoice;
    private Invoice otherInvoice;
    private PaymentTransactionService service;

    @BeforeEach
    void setUp() {
        Employee employee = new Employee(); employee.setEmployeeId("clerk");
        Reservation reservation = new Reservation(); reservation.setEmployee(employee);
        invoice = new Invoice(); ReflectionTestUtils.setField(invoice, "id", 7L);
        invoice.setReservation(reservation); invoice.setRoomTotal(new BigDecimal("1000.00"));
        otherInvoice = new Invoice(); ReflectionTestUtils.setField(otherInvoice, "id", 8L);
        otherInvoice.setReservation(reservation); otherInvoice.setRoomTotal(new BigDecimal("1000.00"));
        when(invoices.findForUpdate(anyLong())).thenAnswer(call ->
                call.getArgument(0, Long.class) == 7L ? Optional.of(invoice) : Optional.of(otherInvoice));
        when(invoices.saveAndFlush(any())).thenAnswer(call -> call.getArgument(0));
        when(transactions.findByInvoiceIdAndStatus(eq(7L), any())).thenReturn(rows);
        when(transactions.findByIdempotencyKeyPrefix(anyString())).thenAnswer(call -> rows.stream()
                .filter(row -> row.getStoredIdempotencyKey() != null
                        && row.getStoredIdempotencyKey().startsWith(call.getArgument(0, String.class))).toList());
        when(transactions.saveAndFlush(any())).thenAnswer(call -> {
            PaymentTransaction row = call.getArgument(0);
            ReflectionTestUtils.setField(row, "id", (long) rows.size() + 1);
            rows.add(row);
            return row;
        });
        service = new PaymentTransactionService(transactions, invoices, approvals, audit,
                new PricingPolicy(3, 20, new BigDecimal("10")));
        ReflectionTestUtils.setField(service, "ledger", financialLedger);
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("clerk", "secret", "ROLE_FRONT_DESK"));
    }

    @AfterEach
    void clearSecurity() { SecurityContextHolder.clearContext(); }

    @Test
    void paymentsReconcileInvoiceAndAppendFinalizedLedgerEntries() {
        service.record(7L, request("400.00", PaymentTransaction.TransactionType.PAYMENT, "terminal-1"), "clerk", "pay-1");
        service.record(7L, request("600.00", PaymentTransaction.TransactionType.PAYMENT, "terminal-2"), "clerk", "pay-2");

        assertThat(invoice.getAmountDue()).isEqualByComparingTo("0.00");
        assertThat(invoice.getStatus()).isEqualTo(com.hospitality.mis.entity.billing.PaymentStatus.DA_THANH_TOAN);
        assertThat(rows).hasSize(2);
        verify(financialLedger, times(2)).record(eq("PAYMENT_RECEIVED"), eq("PAYMENT_TRANSACTION"),
                anyString(), eq(FinancialLedgerEntry.Direction.DEBIT), any(), eq("clerk"), any(), eq("CASH"));
    }

    @Test
    void sameIdempotencyKeyReplaysWithoutAppendingOrRecordingAgain() {
        var request = request("400.00", PaymentTransaction.TransactionType.PAYMENT, "terminal");
        var first = service.record(7L, request, "clerk", "retry-1");
        var replay = service.record(7L, request, "clerk", "retry-1");

        assertThat(replay.id()).isEqualTo(first.id());
        assertThat(rows).hasSize(1);
        verify(transactions, times(1)).saveAndFlush(any());
        verify(financialLedger, times(1)).record(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void sameKeyCannotCrossInvoiceBoundary() {
        service.record(7L, request("400.00", PaymentTransaction.TransactionType.PAYMENT, "terminal"), "clerk", "shared-key");

        assertThatThrownBy(() -> service.record(8L,
                request("400.00", PaymentTransaction.TransactionType.PAYMENT, "terminal"), "clerk", "shared-key"))
                .isInstanceOf(com.hospitality.mis.common.exception.DomainException.class)
                .hasMessageContaining("Idempotency key");
        assertThat(rows).hasSize(1);
    }

    @Test
    void sameKeyWithDifferentPayloadIsRejected() {
        service.record(7L, request("400.00", PaymentTransaction.TransactionType.PAYMENT, "terminal"), "clerk", "payload-key");

        assertThatThrownBy(() -> service.record(7L,
                request("401.00", PaymentTransaction.TransactionType.PAYMENT, "terminal"), "clerk", "payload-key"))
                .isInstanceOf(com.hospitality.mis.common.exception.DomainException.class)
                .hasMessageContaining("Idempotency key");
        assertThat(rows).hasSize(1);
    }

    @Test
    void paymentRequiresInvoiceActorScope() {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("other-clerk", "secret", "ROLE_USER"));

        assertThatThrownBy(() -> service.record(7L,
                request("100.00", PaymentTransaction.TransactionType.PAYMENT, "terminal"),
                "other-clerk", "scope-key"))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        assertThat(rows).isEmpty();
    }

    @Test
    void refundCreatesLinkedReversalUsingOriginalTender() {
        service.record(7L, request("1000.00", PaymentTransaction.TransactionType.PAYMENT, "paid"), "clerk", "pay-1");
        var refund = new PaymentTransactionDtos.CreateRequest(new BigDecimal("250.00"), PaymentMethod.CARD,
                PaymentTransaction.TransactionType.REFUND, "customer-request");
        var first = service.record(7L, refund, "clerk", "refund-1");
        var replay = service.record(7L, refund, "clerk", "refund-1");

        PaymentTransaction reversal = rows.get(1);
        assertThat(reversal.getType()).isEqualTo(PaymentTransaction.TransactionType.REFUND);
        assertThat(reversal.getMethod()).isEqualTo(PaymentMethod.CASH);
        assertThat(reversal.getSourceTransactionId()).isEqualTo("1");
        assertThat(reversal.getReference()).startsWith("REFUND_OF:1:");
        assertThat(replay.id()).isEqualTo(first.id());
        assertThat(invoice.getAmountDue()).isEqualByComparingTo("250.00");
        verify(approvals).requireApproved(eq("PAYMENT_REFUND"), eq("7"), anyString(),
                eq(new BigDecimal("250.00")), eq("clerk"));
        verify(financialLedger).record(eq("REFUND_ISSUED"), eq("PAYMENT_TRANSACTION"), anyString(),
                eq(FinancialLedgerEntry.Direction.CREDIT), eq(new BigDecimal("250.00")), eq("clerk"), any(), eq("CASH"));
        verify(approvals, times(1)).consumeApproved(eq("PAYMENT_REFUND"), eq("7"), anyString(),
                eq(new BigDecimal("250.00")), eq("clerk"));
    }

    @Test
    void paymentUsesSameRoundedTotalAsPricingPolicy() {
        invoice.setRoomTotal(new BigDecimal("1250500"));

        service.record(7L, request("1251000", PaymentTransaction.TransactionType.PAYMENT, "rounded"), "clerk", "rounded-key");

        assertThat(new PricingPolicy(3, 20, new BigDecimal("10")).roundFinalTotal(new BigDecimal("1250500")))
                .isEqualByComparingTo("1251000.00");
        assertThat(invoice.getAmountDue()).isEqualByComparingTo("0.00");
        assertThat(invoice.getStatus()).isEqualTo(com.hospitality.mis.entity.billing.PaymentStatus.DA_THANH_TOAN);
    }

    @Test
    void depositRegistrationPostsPaymentAndReceiptToLedger() {
        Reservation reservation = new Reservation();
        ReflectionTestUtils.setField(reservation, "id", 9L);
        reservation.setEmployee(invoice.getReservation().getEmployee());
        reservation.setDepositAmount(new BigDecimal("500.00"));
        when(invoices.findByReservationId(9L)).thenReturn(Optional.empty());
        when(invoices.saveAndFlush(any())).thenAnswer(call -> {
            Invoice saved = call.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 70L);
            return saved;
        });
        ReceiptRepository receipts = mock(ReceiptRepository.class);
        when(receipts.save(any())).thenAnswer(call -> {
            Receipt saved = call.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 90L);
            return saved;
        });
        BillingService billing = new BillingService(mock(ReservationRepository.class), invoices,
                new PricingPolicy(3, 20, new BigDecimal("10")), audit,
                mock(EquipmentIncidentRepository.class), approvals, transactions, receipts,
                mock(InvoiceAdjustmentRepository.class));
        ReflectionTestUtils.setField(billing, "ledger", financialLedger);

        billing.registerDeposit(reservation);

        verify(financialLedger).record(eq("PAYMENT_RECEIVED"), eq("PAYMENT_TRANSACTION"), anyString(),
                eq(FinancialLedgerEntry.Direction.DEBIT), eq(new BigDecimal("500.00")), eq("clerk"), any(), eq("DEPOSIT"));
        verify(financialLedger).record(eq("RECEIPT_ISSUED"), eq("RECEIPT"), eq("90"),
                eq(FinancialLedgerEntry.Direction.DEBIT), eq(new BigDecimal("500.00")), eq("clerk"), any(), eq("CASH"));
    }

    private PaymentTransactionDtos.CreateRequest request(String amount, PaymentTransaction.TransactionType type,
                                                          String reference) {
        return new PaymentTransactionDtos.CreateRequest(new BigDecimal(amount), PaymentMethod.CASH, type, reference);
    }
}

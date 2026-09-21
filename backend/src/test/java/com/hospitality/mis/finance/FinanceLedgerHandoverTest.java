package com.hospitality.mis.finance;

import com.hospitality.mis.dao.billing.PaymentTransactionRepository;
import com.hospitality.mis.dao.finance.CashShiftHandoverRepository;
import com.hospitality.mis.dao.finance.ExpenseRepository;
import com.hospitality.mis.dao.finance.FinancialLedgerEntryRepository;
import com.hospitality.mis.dao.finance.PartnerDebtRepository;
import com.hospitality.mis.dto.finance.FinanceDtos;
import com.hospitality.mis.entity.finance.CashShiftHandover;
import com.hospitality.mis.entity.finance.FinancialLedgerEntry;
import com.hospitality.mis.service.finance.FinanceService;
import com.hospitality.mis.service.governance.AuditService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Positive contract test proving cash expected value comes from the transaction ledger. */
class FinanceLedgerHandoverTest {
    private final CashShiftHandoverRepository handovers = mock(CashShiftHandoverRepository.class);
    private final PaymentTransactionRepository transactions = mock(PaymentTransactionRepository.class);
    private final AuditService audit = mock(AuditService.class);
    private final FinancialLedgerEntryRepository ledger = mock(FinancialLedgerEntryRepository.class);

    @BeforeEach
    void setUp() {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("cashier", "", "ROLE_ACCOUNTING"));
    }

    @AfterEach
    void clearSecurity() { SecurityContextHolder.clearContext(); }

    @Test
    void handoverUsesUnhandedCashLedgerAndPersistsVarianceEntry() {
        LocalDateTime priorAt = LocalDateTime.of(2031, 1, 1, 8, 0);
        CashShiftHandover prior = new CashShiftHandover(); prior.setHandedOverAt(priorAt);
        when(handovers.findFirstByFromActorOrderByHandedOverAtDesc("cashier")).thenReturn(Optional.of(prior));
        when(transactions.netCashByActorBetween(eq("cashier"), eq(priorAt), any())).thenReturn(new BigDecimal("950000"));
        when(handovers.save(any())).thenAnswer(call -> {
            CashShiftHandover saved = call.getArgument(0);
            org.springframework.test.util.ReflectionTestUtils.setField(saved, "id", 42L);
            return saved;
        });
        FinanceService service = new FinanceService(handovers, mock(ExpenseRepository.class),
                mock(PartnerDebtRepository.class), audit, transactions);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "ledger", ledger);
        var result = service.handover(new FinanceDtos.CashHandoverRequest(
                "SHIFT-2", "cashier", "next", new BigDecimal("940000"), "counted"), "cashier", "handover-1");

        assertThat(result.expectedAmount()).isEqualByComparingTo("950000");
        assertThat(result.actualAmount()).isEqualByComparingTo("940000");
        assertThat(result.variance()).isEqualByComparingTo("-10000");
        verify(handovers).save(argThat(row -> row.getExpectedAmount().compareTo(new BigDecimal("950000")) == 0
                && row.getActualAmount().compareTo(new BigDecimal("940000")) == 0
                && row.getVariance().compareTo(new BigDecimal("-10000")) == 0
                && row.getFromActor().equals("cashier")));
        verify(ledger).save(argThat(entry -> entry.isFinalized()
                && entry.getEntryType().equals("CASH_VARIANCE")
                && entry.getSourceType().equals("CASH_HANDOVER")
                && entry.getSourceId().equals("42")
                && entry.getDirection() == FinancialLedgerEntry.Direction.CREDIT
                && entry.getAmount().compareTo(new BigDecimal("10000")) == 0
                && entry.getActorId().equals("cashier")));
        verify(audit).record(eq("cashier"), eq("CASH_HANDOVER_RECORDED"), eq("CASH_HANDOVER"),
                anyString(), isNull(), eq("940000"), eq("counted"), eq("handover-1"));
    }
}

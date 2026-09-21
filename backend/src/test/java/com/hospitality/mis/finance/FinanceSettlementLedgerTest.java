package com.hospitality.mis.finance;

import com.hospitality.mis.dao.billing.PaymentTransactionRepository;
import com.hospitality.mis.dao.finance.*;
import com.hospitality.mis.dto.finance.FinanceDtos;
import com.hospitality.mis.entity.finance.FinancialLedgerEntry;
import com.hospitality.mis.entity.finance.PartnerDebt;
import com.hospitality.mis.service.finance.FinanceService;
import com.hospitality.mis.service.governance.AuditService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Positive contract test for immutable settlement history and its finalized ledger posting. */
class FinanceSettlementLedgerTest {
    private final PartnerDebtRepository debts = mock(PartnerDebtRepository.class);
    private final PartnerDebtSettlementRepository settlements = mock(PartnerDebtSettlementRepository.class);
    private final FinancialLedgerEntryRepository ledger = mock(FinancialLedgerEntryRepository.class);
    private final AuditService audit = mock(AuditService.class);
    private FinanceService service;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("accounting", "test", "ROLE_ACCOUNTING"));
        service = new FinanceService(mock(CashShiftHandoverRepository.class), mock(ExpenseRepository.class),
                debts, audit, mock(PaymentTransactionRepository.class));
        ReflectionTestUtils.setField(service, "debtSettlements", settlements);
        ReflectionTestUtils.setField(service, "ledger", ledger);
    }

    @AfterEach
    void clearSecurity() { SecurityContextHolder.clearContext(); }

    @Test
    void settlementUpdatesDebtAndAppendsHistoryAndFinalizedLedgerEntry() {
        PartnerDebt debt = new PartnerDebt(); ReflectionTestUtils.setField(debt, "id", 8L);
        debt.setAmount(new BigDecimal("1000")); debt.setSettledAmount(BigDecimal.ZERO);
        debt.setStatus(PartnerDebt.DebtStatus.OPEN);
        when(debts.findForUpdate(8L)).thenReturn(Optional.of(debt));

        service.settleDebt(8L, new FinanceDtos.DebtSettlementRequest(new BigDecimal("250"), "bank"),
                "accounting", "settlement-1");

        assertThat(debt.getSettledAmount()).isEqualByComparingTo("250");
        assertThat(debt.getStatus()).isEqualTo(PartnerDebt.DebtStatus.PARTIALLY_SETTLED);
        verify(settlements).save(argThat(row -> row.getPartnerDebt() == debt
                && row.getAmount().compareTo(new BigDecimal("250")) == 0
                && row.getSettledBy().equals("accounting")));
        verify(ledger).save(argThat(row -> row.isFinalized()
                && row.getEntryType().equals("PARTNER_DEBT_SETTLEMENT")
                && row.getSourceType().equals("PARTNER_DEBT")
                && row.getSourceId().equals("8")
                && row.getDirection() == FinancialLedgerEntry.Direction.DEBIT
                && row.getAmount().compareTo(new BigDecimal("250")) == 0
                && row.getActorId().equals("accounting")));

        service.settleDebt(8L, new FinanceDtos.DebtSettlementRequest(new BigDecimal("750"), "bank"),
                "accounting", "settlement-2");

        assertThat(debt.getSettledAmount()).isEqualByComparingTo("1000");
        assertThat(debt.getStatus()).isEqualTo(PartnerDebt.DebtStatus.SETTLED);
        verify(settlements, times(2)).save(any());
        verify(ledger, times(2)).save(any());
    }

    @Test
    void settlementRejectsAmountBeyondOutstandingBalance() {
        PartnerDebt debt = new PartnerDebt(); ReflectionTestUtils.setField(debt, "id", 8L);
        debt.setAmount(new BigDecimal("1000")); debt.setSettledAmount(new BigDecimal("900"));
        debt.setStatus(PartnerDebt.DebtStatus.PARTIALLY_SETTLED);
        when(debts.findForUpdate(8L)).thenReturn(Optional.of(debt));

        assertThatThrownBy(() -> service.settleDebt(8L,
                new FinanceDtos.DebtSettlementRequest(new BigDecimal("101"), "bank"),
                "accounting", "settlement-over"))
                .isInstanceOf(com.hospitality.mis.common.exception.DomainException.class)
                .hasMessageContaining("vượt số dư");
        assertThat(debt.getSettledAmount()).isEqualByComparingTo("900");
        verifyNoInteractions(settlements, ledger);
    }
}

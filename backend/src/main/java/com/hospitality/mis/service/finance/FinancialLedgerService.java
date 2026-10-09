package com.hospitality.mis.service.finance;

import com.hospitality.mis.dao.finance.FinanceDatabase;
import com.hospitality.mis.entity.finance.FinancialLedgerEntry;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;

/** Ghi bút toán finalized bất biến cho mọi biến động tài chính đã xác nhận. */
@Service
public class FinancialLedgerService {
    private final FinanceDatabase entries;
    private final Clock clock;
    public FinancialLedgerService(FinanceDatabase entries,Clock clock) { this.entries = entries; this.clock = clock; }
    @Transactional(propagation = Propagation.MANDATORY)
    public void record(String type, String sourceType, String sourceId, FinancialLedgerEntry.Direction direction,
                       BigDecimal amount, String actor, LocalDateTime occurredAt, String note) {
        if (amount == null || amount.signum() <= 0) return;
        entries.ledger(type,sourceType,sourceId,direction,amount,actor == null || actor.isBlank() ? "SYSTEM" : actor,
                occurredAt == null ? LocalDateTime.now(clock) : occurredAt,note);
    }
}

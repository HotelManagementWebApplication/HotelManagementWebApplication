package com.hospitality.mis.dao.finance;

import com.hospitality.mis.entity.finance.FinancialLedgerEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;

public interface FinancialLedgerEntryRepository extends JpaRepository<FinancialLedgerEntry, Long> {
    @Query("select e from FinancialLedgerEntry e where e.finalized = true and (:entryType is null or e.entryType = :entryType) and (:fromAt is null or e.occurredAt >= :fromAt) and (:toAt is null or e.occurredAt < :toAt)")
    Page<FinancialLedgerEntry> search(@Param("entryType") String entryType, @Param("fromAt") LocalDateTime fromAt,
                                      @Param("toAt") LocalDateTime toAt, Pageable pageable);

    /** Tổng hợp bút toán theo loại/chiều trong khoảng kỳ đối soát tại DB. */
    @Query("select e.direction as direction, coalesce(sum(e.amount), 0) as amount from FinancialLedgerEntry e where e.finalized = true and e.entryType = :entryType and e.occurredAt >= :fromAt and e.occurredAt < :toAt group by e.direction")
    java.util.List<LedgerTotal> summarize(@Param("entryType") String entryType, @Param("fromAt") LocalDateTime fromAt,
                                          @Param("toAt") LocalDateTime toAt);

    interface LedgerTotal {
        FinancialLedgerEntry.Direction getDirection();
        java.math.BigDecimal getAmount();
    }
}

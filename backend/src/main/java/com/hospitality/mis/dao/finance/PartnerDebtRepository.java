package com.hospitality.mis.dao.finance;

import com.hospitality.mis.entity.finance.PartnerDebt;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.List;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Kho công nợ đối tác và mã tham chiếu nghiệp vụ. */
public interface PartnerDebtRepository extends JpaRepository<PartnerDebt, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select d from PartnerDebt d where d.id = :id")
    Optional<PartnerDebt> findForUpdate(@org.springframework.data.repository.query.Param("id") Long id);
    /** Tra cứu công nợ đối tác bằng mã tham chiếu nghiệp vụ. */
    Optional<PartnerDebt> findByReferenceCode(String referenceCode);

    /** Lấy sổ công nợ theo thời điểm ghi nhận mới nhất trước. */
    List<PartnerDebt> findAllByOrderByRecordedAtDesc();
    @Query("select d from PartnerDebt d where (:partner is null or lower(d.partnerName) like lower(concat('%', :partner, '%'))) and (:status is null or d.status = :status) and (:fromAt is null or d.recordedAt >= :fromAt) and (:toAt is null or d.recordedAt < :toAt) order by d.recordedAt desc, d.id desc")
    Page<PartnerDebt> search(@Param("partner") String partner, @Param("status") PartnerDebt.DebtStatus status,
                             @Param("fromAt") LocalDateTime fromAt, @Param("toAt") LocalDateTime toAt, Pageable pageable);

    /** Tổng dư nợ chưa tất toán trong DB. */
    @Query("select coalesce(sum(d.amount - d.settledAmount), 0) from PartnerDebt d")
    java.math.BigDecimal outstandingAmount();
}

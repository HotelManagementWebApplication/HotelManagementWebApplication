package com.hospitality.mis.dao.finance;

import com.hospitality.mis.entity.finance.PartnerDebtSettlement;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PartnerDebtSettlementRepository extends JpaRepository<PartnerDebtSettlement, Long> {
    List<PartnerDebtSettlement> findByPartnerDebtIdOrderBySettledAtAscIdAsc(Long partnerDebtId);
}

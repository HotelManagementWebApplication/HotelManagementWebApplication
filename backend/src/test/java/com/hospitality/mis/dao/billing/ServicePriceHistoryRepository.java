package com.hospitality.mis.dao.billing;

import com.hospitality.mis.entity.billing.ServicePriceHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

/** SQL integration fixture access only; production reads the history view. */
public interface ServicePriceHistoryRepository extends JpaRepository<ServicePriceHistory, Long> {
    List<ServicePriceHistory> findByServiceIdOrderByEffectiveAtDescIdDesc(String serviceId);
}

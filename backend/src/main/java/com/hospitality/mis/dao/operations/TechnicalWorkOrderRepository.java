package com.hospitality.mis.dao.operations;

import com.hospitality.mis.entity.operations.TechnicalWorkOrder;
import com.hospitality.mis.entity.operations.TechnicalWorkOrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Collection;

public interface TechnicalWorkOrderRepository extends JpaRepository<TechnicalWorkOrder, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    java.util.Optional<TechnicalWorkOrder> findForUpdateById(Long id);
    List<TechnicalWorkOrder> findByRoomIdOrderByUpdatedAtDesc(String roomId);
    List<TechnicalWorkOrder> findByStatusOrderByUpdatedAtDesc(TechnicalWorkOrderStatus status);
    boolean existsByRoomIdAndStatusInAndIdNot(String roomId, Collection<TechnicalWorkOrderStatus> statuses, Long id);
}

package com.hospitality.mis.dao.operations;

import com.hospitality.mis.entity.operations.MaintenanceWorkOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;

/** Kho lệnh bảo trì theo phòng và ngày dự kiến. */
public interface MaintenanceWorkOrderRepository extends JpaRepository<MaintenanceWorkOrder, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<MaintenanceWorkOrder> findForUpdateById(String id);
    /** Lấy lệnh bảo trì của phòng theo ngày dự kiến giảm dần. */
    List<MaintenanceWorkOrder> findByRoomIdOrderByScheduledDateDesc(String roomId);
}

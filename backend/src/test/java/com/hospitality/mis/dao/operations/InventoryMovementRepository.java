package com.hospitality.mis.dao.operations;

import com.hospitality.mis.entity.operations.InventoryMovement;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

/** Kho các biến động tồn kho phát sinh từ dịch vụ. */
public interface InventoryMovementRepository extends JpaRepository<InventoryMovement, Long> {
    /** Lấy biến động tồn kho của dịch vụ, biến động gần nhất đứng trước. */
    List<InventoryMovement> findByServiceIdOrderByOccurredAtDesc(String serviceId);

}

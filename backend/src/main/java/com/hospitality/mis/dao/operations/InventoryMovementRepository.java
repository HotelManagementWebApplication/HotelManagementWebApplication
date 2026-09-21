package com.hospitality.mis.dao.operations;

import com.hospitality.mis.entity.operations.InventoryMovement;
import java.time.LocalDateTime;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

/** Kho các biến động tồn kho phát sinh từ dịch vụ. */
public interface InventoryMovementRepository extends JpaRepository<InventoryMovement, Long> {
    /** Lấy biến động tồn kho của dịch vụ, biến động gần nhất đứng trước. */
    List<InventoryMovement> findByServiceIdOrderByOccurredAtDesc(String serviceId);

    /** Tổng hợp report trong DB để không tải toàn bộ lịch sử movement vào heap. */
    @Query("""
            select coalesce(sum(case when m.type = com.hospitality.mis.entity.operations.InventoryMovement$MovementType.RECEIVE then m.quantity else 0 end), 0),
                   coalesce(sum(case when m.type = com.hospitality.mis.entity.operations.InventoryMovement$MovementType.ISSUE then m.quantity else 0 end), 0),
                   coalesce(sum(case when m.type = com.hospitality.mis.entity.operations.InventoryMovement$MovementType.WASTE then m.quantity else 0 end), 0),
                   coalesce(sum(case when m.type = com.hospitality.mis.entity.operations.InventoryMovement$MovementType.RETURN then m.quantity else 0 end), 0),
                   coalesce(sum(case when m.type = com.hospitality.mis.entity.operations.InventoryMovement$MovementType.ADJUST then m.quantity else 0 end), 0)
            from InventoryMovement m
            where m.service.id = :serviceId and m.occurredAt >= :fromAt and m.occurredAt < :toAt
            """)
    List<Object[]> summarize(@Param("serviceId") String serviceId, @Param("fromAt") LocalDateTime fromAt,
                             @Param("toAt") LocalDateTime toAt);
}

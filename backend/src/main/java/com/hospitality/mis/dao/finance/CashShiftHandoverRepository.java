package com.hospitality.mis.dao.finance;

import com.hospitality.mis.entity.finance.CashShiftHandover;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Kho các biên bản bàn giao tiền mặt giữa các ca. */
public interface CashShiftHandoverRepository extends JpaRepository<CashShiftHandover, Long> {
    /** Lấy các lần bàn giao của một ca, lần gần nhất đứng trước. */
    List<CashShiftHandover> findByShiftCodeOrderByHandedOverAtDesc(String shiftCode);

    /** Lấy toàn bộ lịch sử bàn giao theo thời điểm giảm dần cho màn hình giám sát. */
    List<CashShiftHandover> findAllByOrderByHandedOverAtDesc();

    /** Lấy lần bàn giao gần nhất do một nhân viên bàn giao thực hiện. */
    Optional<CashShiftHandover> findFirstByFromActorOrderByHandedOverAtDesc(String fromActor);
    @Query("select h from CashShiftHandover h where (:shiftCode is null or h.shiftCode = :shiftCode) and (:actor is null or h.fromActor = :actor or h.toActor = :actor) and (:fromAt is null or h.handedOverAt >= :fromAt) and (:toAt is null or h.handedOverAt < :toAt)")
    Page<CashShiftHandover> search(@Param("shiftCode") String shiftCode, @Param("actor") String actor,
                                   @Param("fromAt") LocalDateTime fromAt, @Param("toAt") LocalDateTime toAt,
                                   Pageable pageable);
}

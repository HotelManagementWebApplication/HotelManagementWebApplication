package com.hospitality.mis.dao.governance;

import com.hospitality.mis.entity.governance.ApprovalRequest;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/** Kho yêu cầu phê duyệt, bao gồm ràng buộc binding payload và khóa tiêu thụ. */
public interface ApprovalRepository extends JpaRepository<ApprovalRequest, Long> {
    @Query("select a from ApprovalRequest a where (:status is null or a.status = :status) and (:action is null or a.action = :action) and (:targetId is null or a.targetId = :targetId) order by a.id desc")
    org.springframework.data.domain.Page<ApprovalRequest> search(@Param("status") String status, @Param("action") String action,
            @Param("targetId") String targetId, org.springframework.data.domain.Pageable pageable);
    @Query("select a from ApprovalRequest a where (:status is null or a.status = :status) and (:action is null or a.action = :action) and (:targetId is null or a.targetId = :targetId) and (:requester is null or a.requester = :requester) and (:risk is null or a.risk = :risk) and (:fromTime is null or a.requestedAt >= :fromTime) and (:toTime is null or a.requestedAt < :toTime) order by a.id desc")
    org.springframework.data.domain.Page<ApprovalRequest> searchAdvanced(@Param("status") String status, @Param("action") String action,
            @Param("targetId") String targetId, @Param("requester") String requester,
            @Param("risk") String risk, @Param("fromTime") Instant fromTime, @Param("toTime") Instant toTime,
            org.springframework.data.domain.Pageable pageable);
    /** Liệt kê yêu cầu phê duyệt theo trạng thái, bản ghi mới hơn đứng trước. */
    List<ApprovalRequest> findByStatusOrderByIdDesc(String status);

    /** Khóa yêu cầu theo ID để tiêu thụ hoặc chuyển trạng thái phê duyệt độc quyền. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<ApprovalRequest> findWithLockById(Long id);

    /** Tìm phê duyệt còn dùng được khớp đủ hành động, đối tượng, người yêu cầu và payload. */
    @Query("""
            select a from ApprovalRequest a
            where a.action = :action and a.targetId = :targetId
              and a.requester = :actor and a.status = 'APPROVED'
              and a.consumedAt is null and a.payloadFingerprint = :payloadFingerprint
              and ((:amount is null and a.amount is null) or a.amount = :amount)
            order by a.id desc
            """)
    Optional<ApprovalRequest> findApprovedForBinding(@Param("action") String action,
                                                      @Param("targetId") String targetId,
                                                      @Param("actor") String actor,
                                                      @Param("payloadFingerprint") String payloadFingerprint,
                                                      @Param("amount") BigDecimal amount);

    /** Như truy vấn ràng buộc ở trên nhưng khóa bản ghi để gắn phê duyệt mà không bị dùng hai lần. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select a from ApprovalRequest a
            where a.action = :action and a.targetId = :targetId
              and a.requester = :actor and a.status = 'APPROVED'
              and a.consumedAt is null and a.payloadFingerprint = :payloadFingerprint
              and ((:amount is null and a.amount is null) or a.amount = :amount)
            order by a.id desc
            """)
    Optional<ApprovalRequest> findApprovedForBindingWithLock(@Param("action") String action,
                                                              @Param("targetId") String targetId,
                                                              @Param("actor") String actor,
                                                              @Param("payloadFingerprint") String payloadFingerprint,
                                                              @Param("amount") BigDecimal amount);

    /** Tìm ID candidate activation không khóa; state transition sẽ là conditional update theo primary key. */
    @Query("""
            select a.id from ApprovalRequest a
            where a.action = :action and a.targetId = :targetId
              and a.status = 'APPROVED' and a.consumedAt is null
              and a.payloadFingerprint = :payloadFingerprint
              and ((:amount is null and a.amount is null) or a.amount = :amount)
            order by a.id desc
            """)
    Optional<Long> findApprovedForActivationId(@Param("action") String action,
                                                @Param("targetId") String targetId,
                                                @Param("payloadFingerprint") String payloadFingerprint,
                                                @Param("amount") BigDecimal amount);

    /** Atomically consumes one exact approved activation; the affected-row count selects the sole winner. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update ApprovalRequest a
               set a.status = 'CONSUMED', a.consumedAt = :consumedAt
             where a.id = :id
               and a.action = :action and a.targetId = :targetId
               and a.status = 'APPROVED' and a.consumedAt is null
               and a.payloadFingerprint = :payloadFingerprint
               and ((:amount is null and a.amount is null) or a.amount = :amount)
               and a.expiresAt > :now
               and a.requester <> :approver
            """)
    int consumeApprovedForActivationIfCurrent(@Param("id") Long id,
                                                @Param("action") String action,
                                                @Param("targetId") String targetId,
                                                @Param("payloadFingerprint") String payloadFingerprint,
                                                @Param("amount") BigDecimal amount,
                                                @Param("now") Instant now,
                                                @Param("consumedAt") Instant consumedAt,
                                                @Param("approver") String approver);

    /** Lấy các yêu cầu ở trạng thái đã chỉ định và đã hết hạn tại thời điểm now. */
    List<ApprovalRequest> findByStatusAndExpiresAtLessThanEqual(String status, Instant now);

    Optional<ApprovalRequest> findFirstByRequesterAndCorrelationKey(String requester, String correlationKey);
}

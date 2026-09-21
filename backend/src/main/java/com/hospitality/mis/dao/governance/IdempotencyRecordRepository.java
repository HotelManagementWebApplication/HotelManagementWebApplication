package com.hospitality.mis.dao.governance;

import com.hospitality.mis.entity.governance.IdempotencyRecord;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface IdempotencyRecordRepository extends JpaRepository<IdempotencyRecord, Long> {
    /**
     * Claim the unique key before any business row is touched. A competing
     * InnoDB insert waits for the claimant transaction and then no-ops; the
     * caller reads the committed row with findForUpdate afterwards.
     */
    @Modifying(flushAutomatically = true)
    @Query(value = """
            insert into idempotency_records
                (command_scope, idempotency_key, actor, request_hash, status, created_at, version)
            values (:scope, :key, :actor, :requestHash, 'PROCESSING', :createdAt, 0)
            on duplicate key update id = id
            """, nativeQuery = true)
    void claim(@Param("scope") String scope, @Param("key") String key,
              @Param("actor") String actor, @Param("requestHash") String requestHash,
              @Param("createdAt") LocalDateTime createdAt);

    /** Non-locking observation used only to distinguish a fresh claimant. */
    boolean existsByScopeAndKey(String scope, String key);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select record from IdempotencyRecord record where record.scope = :scope and record.key = :key")
    Optional<IdempotencyRecord> findForUpdate(@Param("scope") String scope, @Param("key") String key);
}

package com.hospitality.mis.dao.governance;

import com.hospitality.mis.entity.governance.IdempotencyRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface IdempotencyRecordRepository extends JpaRepository<IdempotencyRecord, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select record from IdempotencyRecord record where record.scope = :scope and record.key = :key")
    Optional<IdempotencyRecord> findForUpdate(@Param("scope") String scope, @Param("key") String key);
}

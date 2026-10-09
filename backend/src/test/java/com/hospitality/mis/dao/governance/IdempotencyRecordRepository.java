package com.hospitality.mis.dao.governance;
import com.hospitality.mis.entity.governance.IdempotencyRecord;
import org.springframework.data.jpa.repository.JpaRepository;
/** Fixture persistence only; production claims use IdempotencyDatabase. */
public interface IdempotencyRecordRepository extends JpaRepository<IdempotencyRecord,Long> {}

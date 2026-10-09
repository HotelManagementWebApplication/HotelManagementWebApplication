package com.hospitality.mis.dao.governance;
import com.hospitality.mis.entity.governance.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
/** Fixture persistence only; production audit callers use AuditDatabase. */
public interface AuditLogRepository extends JpaRepository<AuditLog,Long> {}

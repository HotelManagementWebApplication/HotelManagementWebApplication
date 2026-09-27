package com.hospitality.mis.governance;

import com.hospitality.mis.dao.governance.AuditLogRepository;
import com.hospitality.mis.entity.governance.AuditLog;
import com.hospitality.mis.service.governance.AuditService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;

/** Integration proof that audit filters and pagination are evaluated by the owner repository. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:audit-behavior;MODE=MSSQLServer;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class AuditBehaviorIntegrationTest {
    @Autowired AuditService auditService;
    @Autowired AuditLogRepository audits;

    @BeforeEach
    void clean() {
        audits.deleteAll();
    }

    @Test
    void auditQueryAppliesActorActionTargetCorrelationTimeAndDatabasePagination() {
        Instant dayOne = Instant.parse("2026-09-14T00:00:00Z");
        Instant dayTwo = dayOne.plus(1, ChronoUnit.DAYS);
        audits.saveAllAndFlush(java.util.List.of(
                new AuditLog("actor-a", "SHIFT_UPDATED", "EMPLOYEE_SHIFT", "1", "AM", "DAY", "changed", "req-1", dayOne),
                new AuditLog("actor-a", "SHIFT_UPDATED", "EMPLOYEE_SHIFT", "2", "AM", "NIGHT", "changed", "req-2", dayTwo),
                new AuditLog("actor-b", "LOGIN_FAILED", "EMPLOYEE", "2", null, "1", "invalid", "login-1", dayTwo.plusSeconds(1))));

        var filtered = auditService.page("actor-a", false, "SHIFT_UPDATED", "EMPLOYEE_SHIFT", "1", "req-1",
                dayOne, dayTwo, 0, 10);
        assertThat(filtered.getTotalElements()).isEqualTo(1);
        assertThat(filtered.getContent()).singleElement().satisfies(item -> {
            assertThat(item.getActor()).isEqualTo("actor-a");
            assertThat(item.getEntityId()).isEqualTo("1");
            assertThat(item.getCorrelationKey()).isEqualTo("req-1");
        });

        var paged = auditService.page("actor-a", false, null, null, null, null,
                null, null, 1, 1);
        assertThat(paged.getTotalElements()).isEqualTo(2);
        assertThat(paged.getTotalPages()).isEqualTo(2);
        assertThat(paged.getContent()).singleElement().extracting(AuditLog::getEntityId).isEqualTo("1");
    }
}

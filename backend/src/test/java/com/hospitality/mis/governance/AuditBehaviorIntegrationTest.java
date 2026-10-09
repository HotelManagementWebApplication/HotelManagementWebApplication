package com.hospitality.mis.governance;

import com.hospitality.mis.dao.governance.AuditDatabase;
import com.hospitality.mis.dto.governance.AuditDtos;
import com.hospitality.mis.service.governance.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
class AuditBehaviorIntegrationTest {
    @Autowired AuditService audit;
    @Autowired SecurityAuditService security;
    @Autowired AuditDatabase database;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager manager;
    @BeforeEach @AfterEach void clean(){jdbc.update("DELETE NhatKyKiemSoat WHERE nguoiThucHien LIKE N'AUD-%' OR khoaLienKet=N'AUD-system'");}
    @Test void queryAppliesEveryFilterTimeBoundaryAndDatabasePagination(){
        Instant first=Instant.parse("2026-09-14T00:00:00Z"),second=first.plusSeconds(86400);
        new TransactionTemplate(manager).executeWithoutResult(tx->{
            database.append("AUD-a","SHIFT_UPDATED","EMPLOYEE_SHIFT","1","AM","DAY","changed","req-1",first);
            database.append("AUD-a","SHIFT_UPDATED","EMPLOYEE_SHIFT","2","AM","NIGHT","changed","req-2",second);
            database.append("AUD-b","LOGIN_FAILED","EMPLOYEE","2",null,"1","invalid","login-1",second.plusSeconds(1));
        });
        var filtered=audit.page("AUD-a",false,"SHIFT_UPDATED","EMPLOYEE_SHIFT","1","req-1",first,second,0,10);
        assertThat(filtered.getTotalElements()).isEqualTo(1);
        assertThat(filtered.getContent()).singleElement().satisfies(item->{assertThat(item.actor()).isEqualTo("AUD-a");assertThat(item.entityId()).isEqualTo("1");assertThat(item.correlationKey()).isEqualTo("req-1");assertThat(item.createdAt()).isEqualTo(first);});
        var page=audit.page("AUD-a",false,null,null,null,null,null,null,1,1);
        assertThat(page.getTotalElements()).isEqualTo(2);assertThat(page.getTotalPages()).isEqualTo(2);
        assertThat(page.getContent()).singleElement().extracting(AuditDtos.Response::entityId).isEqualTo("1");
        assertThat(audit.timeline("EMPLOYEE_SHIFT","1")).filteredOn(row->row.actor().startsWith("AUD-")).singleElement();
        assertThat(audit.list("AUD-a",false)).hasSize(2);
        assertThat(audit.page("AUD-a",false,null,null,-1,1000).getSize()).isEqualTo(100);
        assertThat(audit.page("AUD-a",false,null,null,0,0).getSize()).isEqualTo(1);
    }
    @Test void businessAuditRollsBackAndMissingTransactionIsRejected(){
        new TransactionTemplate(manager).executeWithoutResult(tx->{audit.record("AUD-rollback","TEST","ROOM","AUD-R",null,"new",null);tx.setRollbackOnly();});
        assertThat(audit.list("AUD-rollback",false)).isEmpty();
        assertThatThrownBy(()->audit.record("AUD-no-tx","TEST","ROOM","AUD-R",null,null,null)).isInstanceOf(org.springframework.transaction.IllegalTransactionStateException.class);
    }
    @Test void deniedRequestAuditCommitsIndependentlyOfOuterRollback(){
        new TransactionTemplate(manager).executeWithoutResult(tx->{
            security.record("AUD-security","HTTP_ACCESS_DENIED","POST","/api/protected",403);
            audit.record("AUD-business","TEST","ROOM","AUD-R",null,"new",null);
            tx.setRollbackOnly();
        });
        assertThat(audit.list("AUD-business",false)).isEmpty();
        assertThat(audit.list("AUD-security",false)).singleElement().satisfies(row->{assertThat(row.afterData()).isEqualTo("403");assertThat(row.reason()).isEqualTo("POST");assertThat(row.entityType()).isEqualTo("HTTP_REQUEST");});
    }
    @Test void invalidStorageLengthDoesNotCommitEarlierBusinessAudit(){
        assertThatThrownBy(()->new TransactionTemplate(manager).executeWithoutResult(tx->{
            audit.record("AUD-storage","TEST","ROOM","AUD-R",null,"first",null);
            audit.record("AUD-storage","TEST","ROOM","AUD-R",null,"second","x".repeat(501));
        })).isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThat(audit.list("AUD-storage",false)).isEmpty();
    }
    @Test void nullActorBecomesSystemAndSecurityLimitsUntrustedRequestFields(){
        new TransactionTemplate(manager).executeWithoutResult(tx->audit.record(null,"TEST","ROOM","AUD-R",null,null,null,"AUD-system"));
        assertThat(audit.page("ignored",true,"TEST","ROOM","AUD-R","AUD-system",null,null,0,10).getContent()).singleElement().extracting(AuditDtos.Response::actor).isEqualTo("SYSTEM");
        security.record("AUD-"+"a".repeat(100),"HTTP_ACCESS_DENIED","GET","/"+"p".repeat(200),403);
        assertThat(audit.list(("AUD-"+"a".repeat(100)).substring(0,50),false)).singleElement().satisfies(row->assertThat(row.entityId()).hasSize(100));
    }
}

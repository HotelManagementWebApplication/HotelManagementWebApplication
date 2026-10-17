package com.hospitality.mis.governance;
import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.service.governance.ApprovalService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import java.time.*;
import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
class ApprovalQueueFilterTest {
    @Autowired ApprovalService service;@Autowired JdbcTemplate jdbc;
    @BeforeEach @AfterEach void cleanup(){jdbc.update("DELETE BanGhiChongTrung WHERE nguoiThucHien=N'APQ-requester'");jdbc.update("DELETE NhatKyKiemSoat WHERE nguoiThucHien=N'APQ-requester'");jdbc.update("DELETE YeuCauPheDuyet WHERE nguoiYeuCau=N'APQ-requester'");SecurityContextHolder.clearContext();}
    @Test void queueAppliesRiskRequestedTimeAndEveryFilterInDatabase(){
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("APQ-requester","n/a","ROLE_FRONT_DESK"));
        var request=service.request("APQ-requester","PRICE_OVERRIDE","APQ-R","{}",new BigDecimal("10000000"),"review","APQ-key");
        Instant now=request.requestedAt();
        assertThat(service.page(null,"PRICE_OVERRIDE","APQ-R","APQ-requester","high",now,now.plusSeconds(1),0,20).getContent()).containsExactly(request);
        assertThat(service.page(null,"PRICE_OVERRIDE","APQ-R","APQ-requester","LOW",null,null,0,20).getContent()).isEmpty();
        assertThat(service.page(null,"PRICE_OVERRIDE","APQ-R","APQ-requester","HIGH",null,now,0,20).getContent()).isEmpty();
        assertThat(service.page(null,"PRICE_OVERRIDE","APQ-R","APQ-requester","HIGH",null,null,-1,1000).getSize()).isEqualTo(100);
    }
    @Test void queueRejectsUnknownRisk(){assertThatThrownBy(()->service.page(null,null,null,null,"urgent",null,null,0,20)).isInstanceOf(DomainException.class).extracting("code").isEqualTo("INVALID_APPROVAL_RISK");}
}

package com.hospitality.mis.billing;

import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:billingworkflow;MODE=MSSQLServer;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa", "spring.datasource.password=", "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop"})
@AutoConfigureMockMvc
/** Chạy workflow hóa đơn HTTP trên H2 bằng toàn bộ dịch vụ và repository thật. */
class BillingHttpWorkflowTest extends BillingWorkflowAssertions {}

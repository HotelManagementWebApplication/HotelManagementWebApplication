package com.hospitality.mis.billing;

import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {"spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}", "spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=true", "spring.flyway.baseline-on-migrate=false", "spring.jpa.hibernate.ddl-auto=validate"})
@AutoConfigureMockMvc
/** Chạy cùng billing contract trên schema SQL Server/Flyway thật để bắt khác biệt dialect. */
class SqlServerBillingWorkflowTest extends BillingWorkflowAssertions {}

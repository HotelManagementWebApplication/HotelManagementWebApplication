package com.hospitality.mis.inventory;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.operations.InventoryMovementDtos;
import com.hospitality.mis.service.operations.InventoryMovementService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/** MySQL/InnoDB proof: competing ISSUE commands serialize on the service row lock. */
@SpringBootTest(properties = {
        "spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}",
        "spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=true", "spring.jpa.hibernate.ddl-auto=validate"
})
@EnabledIfEnvironmentVariable(named = "MIGRATION_TEST_DB_URL", matches = ".+")
class MySqlInventoryConcurrencyTest {
    private static final String SERVICE_ID = "CINV01";
    private static final String ACTOR = "cinv01";

    @Autowired JdbcTemplate jdbc;
    @Autowired InventoryMovementService inventory;

    @BeforeEach
    void seed() {
        cleanup();
        jdbc.update("insert into services(id, name, price, unit, stock_quantity, safety_threshold, active) values (?,?,?,?,?,?,?)",
                SERVICE_ID, "Concurrency minibar", new BigDecimal("10000"), "UNIT", 1, 0, true);
    }

    @AfterEach
    void cleanup() {
        jdbc.update("delete from idempotency_records where command_scope = ? and idempotency_key in (?, ?)",
                "inventory-movement", "issue-a", "issue-b");
        jdbc.update("delete from inventory_movements where service_id = ?", SERVICE_ID);
        jdbc.update("delete from services where id = ?", SERVICE_ID);
        jdbc.update("delete from audit_logs where actor = ?", ACTOR);
    }

    @Test
    void competingIssueCommandsCannotDriveStockBelowZero() throws Exception {
        var requestA = request("issue-a");
        var requestB = request("issue-b");
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> issueWhenReleased(requestA, ready, start));
            var second = executor.submit(() -> issueWhenReleased(requestB, ready, start));
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            assertThat(List.of(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder("SUCCESS", "INSUFFICIENT_STOCK");
        }
        assertThat(jdbc.queryForObject("select stock_quantity from services where id = ?", Integer.class, SERVICE_ID)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from inventory_movements where service_id = ?", Integer.class, SERVICE_ID)).isEqualTo(1);
    }

    private InventoryMovementDtos.CreateRequest request(String key) {
        return new InventoryMovementDtos.CreateRequest(SERVICE_ID,
                com.hospitality.mis.entity.operations.InventoryMovement.MovementType.ISSUE, 1, "concurrent issue " + key);
    }

    private String issueWhenReleased(InventoryMovementDtos.CreateRequest request, CountDownLatch ready, CountDownLatch start) throws Exception {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(ACTOR, "", "ROLE_KITCHEN"));
        try {
            ready.countDown();
            assertThat(start.await(10, TimeUnit.SECONDS)).isTrue();
            inventory.record(request, ACTOR, request.reason().substring(request.reason().length() - 7));
            return "SUCCESS";
        } catch (DomainException exception) {
            return exception.getCode();
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}

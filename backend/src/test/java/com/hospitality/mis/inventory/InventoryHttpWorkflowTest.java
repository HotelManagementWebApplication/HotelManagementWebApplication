package com.hospitality.mis.inventory;

import com.hospitality.mis.dao.billing.ServiceRepository;
import com.hospitality.mis.dao.operations.InventoryMovementRepository;
import com.hospitality.mis.entity.billing.Service;
import com.hospitality.mis.entity.operations.InventoryMovement;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** HTTP -> service -> repository thật cho contract movement, stock guard và DB report. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:inventoryworkflow;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa", "spring.datasource.password=", "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
class InventoryHttpWorkflowTest {
    @Autowired MockMvc mvc;
    @Autowired ServiceRepository services;
    @Autowired InventoryMovementRepository movements;

    @BeforeEach
    void seed() {
        movements.deleteAllInBatch();
        services.deleteAllInBatch();
        Service service = new Service();
        service.setId("MINI"); service.setName("Minibar water"); service.setPrice(new BigDecimal("10000"));
        service.setUnit("BOTTLE"); service.setStockQuantity(5); service.setSafetyThreshold(5);
        services.saveAndFlush(service);
    }

    @Test
    @WithMockUser(username = "kitchen", roles = "KITCHEN")
    void canonicalMovementsAreDurableAndReportIsAggregatedFromStoredRows() throws Exception {
        String receive = "{\"service_id\":\"MINI\",\"type\":\"RECEIVE\",\"quantity\":3,\"reason\":\"delivery\"}";
        String first = mvc.perform(post("/api/services/MINI/inventory-movements")
                        .header("Idempotency-Key", "receive-1").contentType(APPLICATION_JSON).content(receive))
                .andExpect(status().isOk()).andExpect(jsonPath("$.type").value("RECEIVE"))
                .andReturn().getResponse().getContentAsString();
        mvc.perform(post("/api/services/MINI/inventory-movements")
                        .header("Idempotency-Key", "receive-1").contentType(APPLICATION_JSON).content(receive))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(com.fasterxml.jackson.databind.json.JsonMapper.builder().build().readTree(first).get("id").asLong()));

        movement("ISSUE", 2, "used", "issue-1");
        movement("ADJUST", -1, "count", "adjust-1");
        movement("WASTE", 1, "damaged", "waste-1");
        movement("RETURN", 2, "supplier return", "return-1");

        mvc.perform(get("/api/services/MINI/inventory-movements/inventory-report"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.received").value(3))
                .andExpect(jsonPath("$.issued").value(2))
                .andExpect(jsonPath("$.wasted").value(1))
                .andExpect(jsonPath("$.returned").value(2))
                .andExpect(jsonPath("$.adjusted").value(-1))
                .andExpect(jsonPath("$.net_change").value(1));

        assertThat(services.findById("MINI").orElseThrow().getStockQuantity()).isEqualTo(6);
        assertThat(movements.findByServiceIdOrderByOccurredAtDesc("MINI")).hasSize(5);
    }

    @Test
    @WithMockUser(username = "kitchen", roles = "KITCHEN")
    void issueAndAdjustCannotLeaveNegativeStock() throws Exception {
        mvc.perform(post("/api/services/MINI/inventory-movements")
                        .header("Idempotency-Key", "too-many").contentType(APPLICATION_JSON)
                        .content("{\"service_id\":\"MINI\",\"type\":\"ISSUE\",\"quantity\":6}"))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(post("/api/services/MINI/inventory-movements")
                        .header("Idempotency-Key", "zero-adjust").contentType(APPLICATION_JSON)
                        .content("{\"service_id\":\"MINI\",\"type\":\"ADJUST\",\"quantity\":-6}"))
                .andExpect(status().isUnprocessableEntity());
        assertThat(services.findById("MINI").orElseThrow().getStockQuantity()).isEqualTo(5);
        assertThat(movements.findByServiceIdOrderByOccurredAtDesc("MINI")).isEmpty();
    }

    @Test
    @WithMockUser(username = "kitchen", roles = "KITCHEN")
    void stockEndpointUsesCanonicalReceiveAndDurableReplay() throws Exception {
        String body = "{\"quantity\":3}";
        String first = mvc.perform(post("/api/services/MINI/stock")
                        .header("Idempotency-Key", "stock-receive-1")
                        .contentType(APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.stock").value(8))
                .andReturn().getResponse().getContentAsString();

        mvc.perform(post("/api/services/MINI/stock")
                        .header("Idempotency-Key", "stock-receive-1")
                        .contentType(APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.stock").value(8));

        assertThat(first).contains("\"stock\":8");
        assertThat(services.findById("MINI").orElseThrow().getStockQuantity()).isEqualTo(8);
        assertThat(movements.findByServiceIdOrderByOccurredAtDesc("MINI"))
                .singleElement().satisfies(movement -> {
                    assertThat(movement.getType()).isEqualTo(InventoryMovement.MovementType.RECEIVE);
                    assertThat(movement.getQuantity()).isEqualTo(3);
                    assertThat(movement.getActorId()).isEqualTo("kitchen");
                });
    }

    @Test
    @WithMockUser(username = "kitchen", roles = "KITCHEN")
    void stockEndpointRequiresPositiveCanonicalMovement() throws Exception {
        mvc.perform(post("/api/services/MINI/stock")
                        .header("Idempotency-Key", "stock-zero")
                        .contentType(APPLICATION_JSON).content("{\"quantity\":0}"))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(post("/api/services/MINI/stock")
                        .contentType(APPLICATION_JSON).content("{\"quantity\":1}"))
                .andExpect(status().isBadRequest());
        assertThat(services.findById("MINI").orElseThrow().getStockQuantity()).isEqualTo(5);
        assertThat(movements.findByServiceIdOrderByOccurredAtDesc("MINI")).isEmpty();
    }

    @Test
    @WithMockUser(username = "kitchen", roles = "KITCHEN")
    void serviceOpeningStockIsRecordedAsCanonicalReceive() throws Exception {
        mvc.perform(post("/api/services").contentType(APPLICATION_JSON)
                        .content("{\"id\":\"OPEN\",\"name\":\"Opening stock\",\"price\":10,\"unit\":\"UNIT\",\"opening_stock\":4,\"safety_threshold\":1}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.stock").value(4));

        assertThat(services.findById("OPEN").orElseThrow().getStockQuantity()).isEqualTo(4);
        assertThat(movements.findByServiceIdOrderByOccurredAtDesc("OPEN")).singleElement().satisfies(movement -> {
            assertThat(movement.getType()).isEqualTo(InventoryMovement.MovementType.RECEIVE);
            assertThat(movement.getQuantity()).isEqualTo(4);
            assertThat(movement.getReason()).isEqualTo("SERVICE_OPENING_STOCK");
            assertThat(movement.getActorId()).isEqualTo("kitchen");
        });
    }

    private void movement(String type, int quantity, String reason, String key) throws Exception {
        mvc.perform(post("/api/services/MINI/inventory-movements").header("Idempotency-Key", key)
                        .contentType(APPLICATION_JSON)
                        .content("{\"service_id\":\"MINI\",\"type\":\"" + type + "\",\"quantity\":" + quantity + ",\"reason\":\"" + reason + "\"}"))
                .andExpect(status().isOk());
    }
}

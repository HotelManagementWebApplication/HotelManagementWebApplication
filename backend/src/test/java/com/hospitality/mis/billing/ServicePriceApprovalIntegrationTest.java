package com.hospitality.mis.billing;

import com.hospitality.mis.dao.billing.ServiceRepository;
import com.hospitality.mis.dao.billing.ServicePriceHistoryRepository;
import com.hospitality.mis.dao.governance.ApprovalRepository;
import com.hospitality.mis.dao.governance.AuditLogRepository;
import com.hospitality.mis.dao.governance.IdempotencyRecordRepository;
import com.hospitality.mis.dto.billing.ServiceDtos;
import com.hospitality.mis.dto.governance.ApprovalDtos;
import com.hospitality.mis.entity.billing.Service;
import com.hospitality.mis.entity.governance.ApprovalRequest;
import com.hospitality.mis.service.billing.ServiceCatalogService;
import com.hospitality.mis.service.governance.ApprovalService;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Real JPA approval proof for requester/approver separation and exact price payload binding. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:servicepriceapproval;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa", "spring.datasource.password=", "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
class ServicePriceApprovalIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ServiceRepository services;
    @Autowired ServicePriceHistoryRepository priceHistory;
    @Autowired ApprovalRepository approvalRecords;
    @Autowired AuditLogRepository audits;
    @Autowired IdempotencyRecordRepository idempotencyRecords;
    @Autowired ServiceCatalogService catalog;
    @Autowired ApprovalService approvals;

    @BeforeEach
    void seed() {
        idempotencyRecords.deleteAllInBatch();
        approvalRecords.deleteAllInBatch();
        audits.deleteAllInBatch();
        priceHistory.deleteAllInBatch();
        services.deleteAllInBatch();
        Service service = new Service(); service.setId("PRICE1"); service.setName("Approved price");
        service.setPrice(new BigDecimal("100")); service.setUnit("UNIT"); service.setStockQuantity(0); service.setSafetyThreshold(0);
        services.saveAndFlush(service);
    }

    @AfterEach
    void clear() { SecurityContextHolder.clearContext(); }

    @Test
    void activationRequiresTheApprovedPriceAndUsesApprovalReason() throws Exception {
        as("kitchen", "ROLE_KITCHEN");
        ApprovalDtos.Response request = catalog.requestPriceChange("PRICE1",
                new ServiceDtos.PriceChangeRequest(new BigDecimal("150.00"), "manager reviewed"), "kitchen", "price-1");

        as("manager", "ROLE_MANAGER");
        approvals.approve(request.id(), "manager", "approve-price-1");
        mvc.perform(activate("150.00", "activate-price-1", "untrusted client reason"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.price").value(150.0));

        assertThat(services.findById("PRICE1").orElseThrow().getPrice()).isEqualByComparingTo("150");
        assertThat(catalog.priceHistory("PRICE1")).singleElement()
                .satisfies(history -> assertThat(history.approvalId()).isEqualTo(request.id()));
        assertThat(approvalRecords.findById(request.id()).orElseThrow().getStatus())
                .isEqualTo(ApprovalRequest.CONSUMED);
        assertThat(audits.findTop100ByEntityTypeAndEntityIdOrderByCreatedAtAscIdAsc("SERVICE", "PRICE1"))
                .filteredOn(audit -> audit.getAction().equals("SERVICE_PRICE_CHANGED"))
                .singleElement().satisfies(audit -> assertThat(audit.getReason()).isEqualTo("manager reviewed"));
    }

    @Test
    void sameActivationRequestReplaysTheStoredResponseWithoutRepeatingTheMutation() throws Exception {
        ApprovalDtos.Response request = approvedPrice("150", "replay-price", "replay-approve");
        var first = mvc.perform(activate("150", "activate-replay", "ignored on activation"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        mvc.perform(activate("150", "activate-replay", "ignored on activation"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.price").value(150.0));

        assertThat(first).contains("\"price\":150");
        assertThat(catalog.priceHistory("PRICE1")).hasSize(1)
                .singleElement().satisfies(history -> assertThat(history.approvalId()).isEqualTo(request.id()));
        assertThat(audits.findTop100ByEntityTypeAndEntityIdOrderByCreatedAtAscIdAsc("SERVICE", "PRICE1"))
                .filteredOn(audit -> audit.getAction().equals("SERVICE_PRICE_CHANGED"))
                .hasSize(1);
    }

    @Test
    void changedPayloadWithTheSameKeyIsAnIdempotencyConflict() throws Exception {
        approvedPrice("150", "mismatch-price", "mismatch-approve");
        mvc.perform(activate("150", "activate-mismatch", "reason"))
                .andExpect(status().isOk());

        mvc.perform(activate("151", "activate-mismatch", "reason"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_CONFLICT"));
        assertThat(services.findById("PRICE1").orElseThrow().getPrice()).isEqualByComparingTo("150");
    }

    @Test
    void activationRequiresApprovalAndAConsumedApprovalCannotBeUsedByAnotherKey() throws Exception {
        mvc.perform(activate("150", "activate-without-approval", "reason"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("APPROVAL_REQUIRED"));

        approvedPrice("150", "state-price", "state-approve");
        mvc.perform(activate("150", "activate-state-first", "reason"))
                .andExpect(status().isOk());
        mvc.perform(activate("150", "activate-state-second", "reason"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("APPROVAL_REQUIRED"));
        assertThat(catalog.priceHistory("PRICE1")).hasSize(1);
    }

    private ApprovalDtos.Response approvedPrice(String price, String requestKey, String approvalKey) {
        as("kitchen", "ROLE_KITCHEN");
        ApprovalDtos.Response request = catalog.requestPriceChange("PRICE1",
                new ServiceDtos.PriceChangeRequest(new BigDecimal(price), "manager reviewed"), "kitchen", requestKey);
        as("manager", "ROLE_MANAGER");
        approvals.approve(request.id(), "manager", approvalKey);
        return request;
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder activate(
            String price, String key, String reason) {
        return post("/api/services/PRICE1/price/activate")
                .with(user("manager").roles("MANAGER"))
                .header("Idempotency-Key", key)
                .contentType(APPLICATION_JSON)
                .content("{\"price\":" + price + ",\"reason\":\"" + reason + "\"}");
    }

    private void as(String username, String role) {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(username, "", role));
    }
}

package com.hospitality.mis.governance;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospitality.mis.dto.governance.ApprovalDtos;
import com.hospitality.mis.dto.governance.AuditDtos;
import com.hospitality.mis.entity.governance.ApprovalRequest;
import com.hospitality.mis.entity.governance.AuditLog;
import com.hospitality.mis.middleware.security.ApprovalAuthorization;
import com.hospitality.mis.service.governance.ApprovalService;
import com.hospitality.mis.service.governance.AuditService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:governanceapi;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
/** Kiểm tra wire contract governance: snake_case allowlist và không lộ metadata persistence. */
class GovernanceApiContractTest {
    /** HTTP boundary thật để kiểm tra security, serialization và status code. */
    @Autowired MockMvc mockMvc;
    /** Mapper dùng đọc/kiểm tra exact field set của response. */
    @Autowired ObjectMapper objectMapper;

    /** Service mock để contract test không phụ thuộc nghiệp vụ approval. */
    @MockBean ApprovalService approvalService;
    /** Audit service mock cho endpoint list audit. */
    @MockBean AuditService auditService;
    /** Authorization mock; true cho fixture id 42 để request đi tới controller. */
    @MockBean ApprovalAuthorization approvalAuthorization;

    /** Approval PENDING id 42 là fixture chung cho create/list/serialization. */
    private ApprovalRequest pending;

    /** Dựng approval canonical và cho phép actor test approve fixture id 42. */
    @BeforeEach
    void setUp() {
        pending = new ApprovalRequest("requester", "PRICE_OVERRIDE", "room-1", "{\"price\":100}",
                ApprovalService.fingerprintFor("{\"price\":100}"), new BigDecimal("100.00"),
                "Review", Instant.now().plusSeconds(3600), "approval-1");
        ReflectionTestUtils.setField(pending, "id", 42L);
        when(approvalAuthorization.canApprove(eq(42L), anyString())).thenReturn(true);
    }

    /** Given approval response, When POST create, Then JSON snake_case đúng allowlist và không có field nội bộ. */
    @Test
    void approvalResponseUsesTheCanonicalAllowlistedSnakeCaseShape() throws Exception {
        when(approvalService.request(eq("actor"), eq("PRICE_OVERRIDE"), eq("room-1"),
                eq("{\"price\":100}"), eq(new BigDecimal("100.00")), eq("Review"), eq("approval-1")))
                .thenReturn(pending);

        String body = mockMvc.perform(post("/api/governance/approvals")
                        .with(jwtAs("FRONT_DESK"))
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"action":"PRICE_OVERRIDE","target_id":"room-1","payload":"{\\"price\\":100}",
                                 "amount":100.00,"reason":"Review","idempotency_key":"approval-1"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(42))
                .andExpect(jsonPath("$.requester").value("requester"))
                .andExpect(jsonPath("$.target_id").value("room-1"))
                .andExpect(jsonPath("$.payload").value("{\"price\":100}"))
                .andExpect(jsonPath("$.amount").value(100.00))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.idempotency_key").value("approval-1"))
                .andExpect(jsonPath("$.targetId").doesNotExist())
                .andExpect(jsonPath("$.mutation_payload").doesNotExist())
                .andExpect(jsonPath("$.payload_fingerprint").doesNotExist())
                .andExpect(jsonPath("$.correlation_key").doesNotExist())
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("hibernateLazyInitializer"))))
                .andReturn().getResponse().getContentAsString();

        JsonNode json = objectMapper.readTree(body);
        assertThat(json.fieldNames()).toIterable().allMatch(name -> !name.matches(".*[A-Z].*"));
    }

    /** Given approved/rejected/pending rows, When gọi action và list, Then status/body semantics ổn định. */
    @Test
    void approvalActionsAndListKeepExistingStatusAndBodySemantics() throws Exception {
        ApprovalRequest approved = new ApprovalRequest("requester", "PRICE_OVERRIDE", "room-1", "{}", "fingerprint",
                null, "Review", Instant.now().plusSeconds(3600), "approval-1");
        ReflectionTestUtils.setField(approved, "id", 42L);
        approved.approve("actor", Instant.now());
        when(approvalService.approve(42L, "actor")).thenReturn(approved);

        ApprovalRequest rejected = new ApprovalRequest("requester", "PRICE_OVERRIDE", "room-1", "{}", "fingerprint",
                null, "Review", Instant.now().plusSeconds(3600), "approval-1");
        ReflectionTestUtils.setField(rejected, "id", 42L);
        rejected.reject("actor", Instant.now());
        when(approvalService.reject(42L, "actor")).thenReturn(rejected);
        when(approvalService.list("PENDING")).thenReturn(List.of(pending));

        mockMvc.perform(post("/api/governance/approvals/42/approve").with(jwtAs("MANAGER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.approver").value("actor"));
        mockMvc.perform(post("/api/governance/approvals/42/reject").with(jwtAs("MANAGER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"));
        mockMvc.perform(get("/api/governance/approvals").param("status", "PENDING").with(jwtAs("MANAGER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("PENDING"))
                .andExpect(jsonPath("$[0].payload").value("{\"price\":100}"));
    }

    @Test
    void filteredApprovalListUsesPageWrapperWhileStatusOnlyListRemainsArray() throws Exception {
        when(approvalService.page(eq("APPROVED"), eq("PRICE_OVERRIDE"), eq("room-1"), eq(null), eq(null),
                eq(null), eq(null), eq(0), eq(20)))
                .thenReturn(new PageImpl<>(List.of(pending), PageRequest.of(0, 20), 1));

        mockMvc.perform(get("/api/governance/approvals")
                        .param("status", "APPROVED")
                        .param("action", "PRICE_OVERRIDE")
                        .param("target_id", "room-1")
                        .with(jwtAs("MANAGER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(42))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.totalPages").value(1))
                .andExpect(jsonPath("$[0]").doesNotExist());
    }

    /** Given audit row, When GET audit, Then snake_case và không serialize metadata của entity. */
    @Test
    void auditResponseUsesSnakeCaseWithoutEntitySerializationMetadata() throws Exception {
        AuditLog audit = new AuditLog("manager", "APPROVAL_APPROVED", "APPROVAL", "42",
                "PENDING", "APPROVED", "Review", "audit-1");
        ReflectionTestUtils.setField(audit, "id", 7L);
        when(auditService.list("actor", true)).thenReturn(List.of(audit));

        String body = mockMvc.perform(get("/api/governance/audit").with(jwtAs("MANAGER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(7))
                .andExpect(jsonPath("$[0].entity_type").value("APPROVAL"))
                .andExpect(jsonPath("$[0].entity_id").value("42"))
                .andExpect(jsonPath("$[0].before_data").value("PENDING"))
                .andExpect(jsonPath("$[0].after_data").value("APPROVED"))
                .andExpect(jsonPath("$[0].correlation_key").value("audit-1"))
                .andExpect(jsonPath("$[0].entityType").doesNotExist())
                .andExpect(jsonPath("$[0].hibernateLazyInitializer").doesNotExist())
                .andReturn().getResponse().getContentAsString();

        JsonNode json = objectMapper.readTree(body).get(0);
        assertThat(json.fieldNames()).toIterable().allMatch(name -> !name.matches(".*[A-Z].*"));
    }

    /** Given DTO explicit, When Jackson serialize, Then chỉ có field public contract, không có fingerprint nội bộ. */
    @Test
    void responseDtoSerializationIsExplicitAndDoesNotIncludePersistenceFingerprint() throws Exception {
        JsonNode approval = objectMapper.valueToTree(ApprovalDtos.Response.from(pending));
        JsonNode audit = objectMapper.valueToTree(AuditDtos.Response.from(new AuditLog(
                "actor", "ACTION", "GUEST", "1", null, "after", "reason", "correlation")));

        assertThat(approval.fieldNames()).toIterable().containsExactlyInAnyOrder(
                "id", "requester", "action", "target_id", "payload", "amount", "reason", "risk", "status",
                "approver", "decided_at", "expires_at", "consumed_at", "requested_at", "idempotency_key");
        assertThat(audit.fieldNames()).toIterable().containsExactlyInAnyOrder(
                "id", "actor", "action", "entity_type", "entity_id", "before_data", "after_data", "reason",
                "correlation_key", "created_at");
        assertThat(approval.has("mutation_payload")).isFalse();
        assertThat(approval.has("payload_fingerprint")).isFalse();
    }

    /** Tạo JWT employee tối thiểu với role được truyền để test controller authorization. */
    private static RequestPostProcessor jwtAs(String role) {
        return jwt().jwt(token -> token.subject("actor")
                        .claim("principal_id", "actor")
                        .claim("principal_type", "EMPLOYEE"))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }
}

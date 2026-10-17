package com.hospitality.mis.operations;

import com.hospitality.mis.dto.operations.EquipmentIncidentDtos;
import com.hospitality.mis.entity.operations.IncidentSeverity;
import com.hospitality.mis.entity.operations.IncidentHandoffStatus;
import com.hospitality.mis.service.operations.EquipmentIncidentService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import java.math.BigDecimal;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** HTTP-only shape, parameter binding and permission tests. Business proof lives in SqlServerEquipmentIncidentTest. */
@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
@AutoConfigureMockMvc
class EquipmentIncidentCorrectnessTest {
    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @MockBean EquipmentIncidentService httpService;

    @Test
    @WithMockUser(username = "housekeeping", roles = "HOUSEKEEPING")
    void incidentQueryBindsExactCamelCaseParametersAndReturnsExactShape() throws Exception {
        when(httpService.find("101", 9L, IncidentHandoffStatus.ACKNOWLEDGED))
                .thenReturn(List.of(new EquipmentIncidentDtos.Response(44L, 9L, "101", "TV",
                        new BigDecimal("1500.00"), IncidentSeverity.HIGH,
                        IncidentHandoffStatus.ACKNOWLEDGED, "technical received")));

        String body = mockMvc.perform(get("/api/operations/incidents")
                        .param("roomId", "101")
                        .param("reservationId", "9")
                        .param("handoffStatus", "ACKNOWLEDGED"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode response = objectMapper.readTree(body).get(0);
        assertThat(response.fieldNames()).toIterable().containsExactlyInAnyOrder(
                "id", "reservation_id", "room_id", "equipment_name", "compensation", "severity",
                "handoff_status", "handoff_note");
        assertThat(response.get("reservation_id").asLong()).isEqualTo(9L);
        assertThat(response.get("room_id").asText()).isEqualTo("101");
        assertThat(response.get("handoff_status").asText()).isEqualTo("ACKNOWLEDGED");
        verify(httpService).find("101", 9L, IncidentHandoffStatus.ACKNOWLEDGED);
    }

    @Test
    @WithMockUser(username = "housekeeping", roles = "HOUSEKEEPING")
    void incidentQueryRejectsInvalidTypedParametersAtHttpBoundary() throws Exception {
        mockMvc.perform(get("/api/operations/incidents").param("reservationId", "not-a-number"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/operations/incidents").param("handoffStatus", "NOT_A_STATUS"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(httpService);
    }

    @Test
    @WithMockUser(username = "frontdesk", roles = "FRONT_DESK")
    void incidentQueryEnforcesHandoffPermissionBeforeServiceInvocation() throws Exception {
        mockMvc.perform(get("/api/operations/incidents").param("roomId", "101"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(httpService);
    }

    @Test
    @WithMockUser(username = "housekeeping", authorities = {"ROLE_HOUSEKEEPING", "INCIDENT_WRITE"})
    void recordRoomIncidentEndpointPermitsAuthorizedHousekeeping() throws Exception {
        when(httpService.recordRoomIncident(any(), eq("housekeeping"), eq("test-key")))
                .thenReturn(new EquipmentIncidentDtos.Response(77L, null, "204", "Khóa cửa từ không nhận",
                        BigDecimal.ZERO, IncidentSeverity.HIGH, IncidentHandoffStatus.OPEN, "Pin yếu"));

        String requestJson = """
                {
                    "room_id": "204",
                    "equipment_name": "Khóa cửa từ không nhận",
                    "quantity": 1,
                    "severity": "HIGH",
                    "description": "Pin yếu"
                }
                """;

        mockMvc.perform(post("/api/operations/incidents")
                        .header("Idempotency-Key", "test-key")
                        .contentType("application/json")
                        .content(requestJson))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "guest", roles = "GUEST")
    void recordRoomIncidentEndpointDeniesUnauthorizedUsers() throws Exception {
        String requestJson = """
                {
                    "room_id": "204",
                    "equipment_name": "Khóa cửa từ không nhận",
                    "quantity": 1,
                    "severity": "HIGH",
                    "description": "Pin yếu"
                }
                """;

        mockMvc.perform(post("/api/operations/incidents")
                        .header("Idempotency-Key", "test-key")
                        .contentType("application/json")
                        .content(requestJson))
                .andExpect(status().isForbidden());
        verifyNoInteractions(httpService);
    }
}

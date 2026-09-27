package com.hospitality.mis.billing;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospitality.mis.dto.billing.ServiceDtos;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Luồng HTTP thật trên SQL Server chứng minh bí danh đầu vào được chuẩn hóa cùng một nhãn trong API và database. */
@SpringBootTest(properties = {
        "spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}",
        "spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
@AutoConfigureMockMvc
class SqlServerServiceUnitIntegrationTest {
    private static final String ACTOR = "sqlserver-unit-contract-kitchen";
    private final List<String> createdIds = new ArrayList<>();

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;

    @AfterEach
    void cleanup() {
        createdIds.forEach(id -> jdbc.update("DELETE FROM DichVu WHERE maDichVu = ?", id));
        jdbc.update("DELETE FROM NhatKyKiemSoat WHERE nguoiThucHien = ?", ACTOR);
    }

    @Test
    @WithMockUser(username = ACTOR, roles = "KITCHEN")
    void createServiceNormalizesLegacyInputAliasesAndStoresExactVietnameseText() throws Exception {
        List<UnitCase> cases = List.of(
                new UnitCase(null, "lần"),
                new UnitCase(" ", "lần"),
                new UnitCase("BOTTLE", "chai"),
                new UnitCase("CHAI", "chai"),
                new UnitCase("UNIT", "đơn vị"),
                new UnitCase("TIME", "lần"),
                new UnitCase("LẦN", "lần"),
                new UnitCase("set", "bộ"),
                new UnitCase("bộ", "bộ"),
                new UnitCase("lần", "lần"),
                new UnitCase("suất", "suất"),
                new UnitCase("món", "món"),
                new UnitCase("đêm", "đêm"),
                new UnitCase("lượt", "lượt"),
                new UnitCase("chuyến", "chuyến"),
                new UnitCase("khách", "khách"),
                new UnitCase("khách/ngày", "khách/ngày"),
                new UnitCase("giờ", "giờ"),
                new UnitCase("ngày", "ngày"),
                new UnitCase("chai", "chai"),
                new UnitCase("đơn vị", "đơn vị"));

        int index = 0;
        for (UnitCase unitCase : cases) {
            String id = "UTV" + String.format("%03d", index++);
            createdIds.add(id);
            var request = new ServiceDtos.CreateRequest(id, "Đơn vị thử " + id,
                    new BigDecimal("1000"), unitCase.input(), 0, 0);

            mvc.perform(post("/api/services")
                            .contentType(APPLICATION_JSON)
                            .content(objectMapper.writeValueAsBytes(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.unit").value(unitCase.normalizedLabel()));

            String persisted = jdbc.queryForObject(
                    "SELECT donViTinh FROM DichVu WHERE maDichVu = ?", String.class, id);
            assertThat(persisted).isEqualTo(unitCase.normalizedLabel());
        }
    }

    @Test
    @WithMockUser(username = ACTOR, roles = "KITCHEN")
    void unsupportedUnitIsRejectedBeforeDatabaseCheckCanBecomeConflict() throws Exception {
        String id = "UTVBAD";
        createdIds.add(id);
        var request = new ServiceDtos.CreateRequest(id, "Đơn vị không hợp lệ",
                new BigDecimal("1000"), "BOTTLE_PER_HOUR", 0, 0);

        mvc.perform(post("/api/services")
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(request)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("INVALID_SERVICE_UNIT"));

        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM DichVu WHERE maDichVu = ?", Integer.class, id)).isZero();
    }

    private record UnitCase(String input, String normalizedLabel) {}
}

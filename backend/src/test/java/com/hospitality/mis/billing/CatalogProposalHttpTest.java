package com.hospitality.mis.billing;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.http.MediaType.APPLICATION_JSON;

@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
@AutoConfigureMockMvc
@Transactional
class CatalogProposalHttpTest {
    @Autowired MockMvc mvc;@Autowired JdbcTemplate jdbc;@Autowired ObjectMapper mapper;
    @BeforeEach void seed(){
        jdbc.update("INSERT NhanVien(maNhanVien,hoVaTen,matKhau,vaiTro,soDienThoai) VALUES(N'CPWH',N'Kho test',N'unused',N'Nhà bếp',N'0901120011'),(N'CPMAN',N'Quản lý test',N'unused',N'Quản lý',N'0901120012')");
    }
    private String body(String kind){return "{\"kind\":\""+kind+"\",\"id\":\"CPITEM\",\"name\":\"Danh mục thử\",\"unit\":\"cái\",\"category\":\""+(kind.equals("SERVICE")?"recreation":"room-amenity")+"\",\"price\":12000,\"reason\":\"Cần bổ sung\"}";}
    private long submit(String kind)throws Exception{
        String json=mvc.perform(post("/api/services/catalog-proposals").with(user("CPWH").roles("KITCHEN")).header("Idempotency-Key","cp-create").contentType(APPLICATION_JSON).content(body(kind)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PENDING")).andReturn().getResponse().getContentAsString();
        return mapper.readTree(json).get("id").asLong();
    }
    private int count(){return jdbc.queryForObject("SELECT COUNT(*) FROM DichVu WHERE maDichVu=N'CPITEM'",Integer.class);}
    @Test void warehouseIsCreatedOnlyAfterManagerApprovalAndStaysInternal()throws Exception{
        long id=submit("WAREHOUSE");assertThat(count()).isZero();assertThat(submit("WAREHOUSE")).isEqualTo(id);
        mvc.perform(post("/api/governance/approvals/{id}/approve",id).with(user("CPMAN").roles("MANAGER")).header("Idempotency-Key","cp-approve"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CONSUMED"));
        assertThat(count()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT dangHoatDong FROM DichVu WHERE maDichVu=N'CPITEM'",Boolean.class)).isFalse();
        assertThat(jdbc.queryForObject("SELECT soLuongTonKho FROM DichVu WHERE maDichVu=N'CPITEM'",Integer.class)).isZero();
        mvc.perform(post("/api/governance/approvals/{id}/approve",id).with(user("CPMAN").roles("MANAGER")).header("Idempotency-Key","cp-approve")).andExpect(status().isOk());
        assertThat(count()).isEqualTo(1);
    }
    @Test void approvedServiceIsActive()throws Exception{
        long id=submit("SERVICE");
        mvc.perform(post("/api/governance/approvals/{id}/approve",id).with(user("CPMAN").roles("MANAGER"))).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT dangHoatDong FROM DichVu WHERE maDichVu=N'CPITEM'",Boolean.class)).isTrue();
    }
    @Test void rejectionCreatesNothingAndRequesterCannotDecide()throws Exception{
        long id=submit("WAREHOUSE");
        mvc.perform(post("/api/governance/approvals/{id}/approve",id).with(user("CPWH").roles("KITCHEN"))).andExpect(status().isForbidden());
        mvc.perform(post("/api/governance/approvals/{id}/reject",id).with(user("CPMAN").roles("MANAGER"))).andExpect(status().isOk());
        assertThat(count()).isZero();
    }
    @Test void validatesKindCategoryUnitAndRole()throws Exception{
        mvc.perform(post("/api/services/catalog-proposals").with(user("CPWH").roles("HOUSEKEEPING")).header("Idempotency-Key","cp-invalid").contentType(APPLICATION_JSON).content(body("WAREHOUSE"))).andExpect(status().isForbidden());
        mvc.perform(post("/api/services/catalog-proposals").with(user("CPWH").roles("KITCHEN")).header("Idempotency-Key","cp-invalid").contentType(APPLICATION_JSON).content(body("WAREHOUSE").replace("room-amenity","spa"))).andExpect(status().isUnprocessableEntity());
        mvc.perform(post("/api/services/catalog-proposals").with(user("CPWH").roles("KITCHEN")).header("Idempotency-Key","cp-invalid").contentType(APPLICATION_JSON).content(body("WAREHOUSE").replace("cái","invalid"))).andExpect(status().isUnprocessableEntity());
        assertThat(count()).isZero();
    }
    @Test void historyIsScopedToRequester()throws Exception{
        submit("WAREHOUSE");
        mvc.perform(get("/api/services/catalog-proposals").with(user("CPWH").roles("KITCHEN"))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get("/api/services/catalog-proposals").with(user("OTHER").roles("KITCHEN"))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }
}

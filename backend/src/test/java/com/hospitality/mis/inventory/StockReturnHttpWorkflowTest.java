package com.hospitality.mis.inventory;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
@AutoConfigureMockMvc
class StockReturnHttpWorkflowTest {
    @Autowired MockMvc mvc; @Autowired JdbcTemplate jdbc; @Autowired ObjectMapper mapper;
    @BeforeEach void seed(){
        cleanup();
        jdbc.update("INSERT NhanVien(maNhanVien,hoVaTen,matKhau,vaiTro,soDienThoai) VALUES(N'HKRET',N'Buồng phòng test',N'not-used',N'Buồng phòng',N'0901110001'),(N'WHRET',N'Kho test',N'not-used',N'Nhà bếp',N'0901110002'),(N'HKRET2',N'Buồng phòng khác',N'not-used',N'Buồng phòng',N'0901110003')");
        jdbc.update("INSERT DichVu(maDichVu,ten,gia,donViTinh,soLuongTonKho,nguongAnToan,dangHoatDong,danhMuc) VALUES(N'RETITEM',N'Khăn trả kho',0,N'cái',5,1,0,N'Vật dụng phòng')");
    }
    @AfterEach void cleanup(){
        jdbc.update("DELETE YeuCauTraKho WHERE maDichVu=N'RETITEM'");
        jdbc.update("DELETE BienDongKhoDichVu WHERE maDichVu=N'RETITEM'");
        jdbc.update("DELETE BanGhiChongTrung WHERE nguoiThucHien IN(N'HKRET',N'WHRET',N'HKRET2')");
        jdbc.update("DELETE NhatKyKiemSoat WHERE nguoiThucHien IN(N'HKRET',N'WHRET',N'HKRET2')");
        jdbc.update("DELETE DichVu WHERE maDichVu=N'RETITEM'");
        jdbc.update("DELETE NhanVien WHERE maNhanVien IN(N'HKRET',N'WHRET',N'HKRET2')");
    }
    private String body(int quantity){return "{\"service_id\":\"RETITEM\",\"quantity\":"+quantity+",\"reason\":\"Còn nguyên chưa dùng\"}";}
    private long request(String key) throws Exception{
        String json=mvc.perform(post("/api/operations/stock-returns").with(user("HKRET").roles("HOUSEKEEPING"))
            .header("Idempotency-Key",key).contentType(APPLICATION_JSON).content(body(2)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PENDING")).andReturn().getResponse().getContentAsString();
        return mapper.readTree(json).get("id").asLong();
    }
    private int stock(){return jdbc.queryForObject("SELECT soLuongTonKho FROM DichVu WHERE maDichVu=N'RETITEM'",Integer.class);}
    @Test void requestDoesNotIncreaseStockAndRetryDoesNotDuplicate() throws Exception{
        long id=request("return-request"); assertThat(request("return-request")).isEqualTo(id);
        assertThat(stock()).isEqualTo(5);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM YeuCauTraKho WHERE maDichVu=N'RETITEM'",Integer.class)).isEqualTo(1);
        mvc.perform(post("/api/operations/stock-returns").with(user("HKRET").roles("HOUSEKEEPING")).header("Idempotency-Key","return-request").contentType(APPLICATION_JSON).content(body(3)))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_CONFLICT"));
    }
    @Test void warehouseApprovalAddsStockExactlyOnceAndIsTerminal() throws Exception{
        long id=request("approve-request");
        for(int retry=0;retry<2;retry++)mvc.perform(post("/api/operations/stock-returns/"+id+"/approve").with(user("WHRET").roles("KITCHEN")).contentType(APPLICATION_JSON).content("{\"reason\":\"Đã kiểm đếm\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPROVED")).andExpect(jsonPath("$.approver").value("WHRET"));
        assertThat(stock()).isEqualTo(7);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM BienDongKhoDichVu WHERE maDichVu=N'RETITEM' AND loai=N'Hoàn kho'",Integer.class)).isEqualTo(1);
        mvc.perform(post("/api/operations/stock-returns/"+id+"/reject").with(user("WHRET").roles("KITCHEN")).contentType(APPLICATION_JSON).content("{\"reason\":\"Đổi ý\"}"))
            .andExpect(status().isUnprocessableEntity());
    }
    @Test void rejectionRequiresReasonAndNeverChangesStock() throws Exception{
        long id=request("reject-request");
        mvc.perform(post("/api/operations/stock-returns/"+id+"/reject").with(user("WHRET").roles("KITCHEN")).contentType(APPLICATION_JSON).content("{\"reason\":\" \"}"))
            .andExpect(status().isUnprocessableEntity());
        mvc.perform(post("/api/operations/stock-returns/"+id+"/reject").with(user("WHRET").roles("KITCHEN")).contentType(APPLICATION_JSON).content("{\"reason\":\"Hàng đã hỏng\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REJECTED"));
        assertThat(stock()).isEqualTo(5);
        mvc.perform(post("/api/operations/stock-returns/"+id+"/approve").with(user("WHRET").roles("KITCHEN")).contentType(APPLICATION_JSON).content("{}"))
            .andExpect(status().isUnprocessableEntity());
    }
    @Test void departmentsHaveSeparatePermissionsAndRequestersOnlySeeTheirOwnRequests() throws Exception{
        long id=request("access-request");
        mvc.perform(get("/api/operations/stock-returns").with(user("HKRET2").roles("HOUSEKEEPING"))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/operations/stock-returns").with(user("HKRET").roles("HOUSEKEEPING"))).andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(id));
        mvc.perform(post("/api/operations/stock-returns/"+id+"/approve").with(user("HKRET").roles("HOUSEKEEPING")).contentType(APPLICATION_JSON).content("{}"))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/operations/stock-returns").with(user("WHRET").roles("KITCHEN")).header("Idempotency-Key","wrong-role").contentType(APPLICATION_JSON).content(body(2)))
            .andExpect(status().isForbidden());
        mvc.perform(get("/api/operations/stock-returns").with(user("TECH").roles("TECHNICAL"))).andExpect(status().isForbidden());
        mvc.perform(post("/api/services/RETITEM/inventory-movements").with(user("HKRET").roles("HOUSEKEEPING")).header("Idempotency-Key","bypass").contentType(APPLICATION_JSON)
            .content("{\"service_id\":\"RETITEM\",\"type\":\"RETURN\",\"quantity\":2,\"reason\":\"Bypass\"}"))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("RETURN_APPROVAL_REQUIRED"));
        assertThat(stock()).isEqualTo(5);
    }
    @Test void invalidQuantityAndUnknownRoomAreRejected() throws Exception{
        mvc.perform(post("/api/operations/stock-returns").with(user("HKRET").roles("HOUSEKEEPING")).header("Idempotency-Key","zero").contentType(APPLICATION_JSON).content(body(0)))
            .andExpect(status().isBadRequest());
        mvc.perform(post("/api/operations/stock-returns").with(user("HKRET").roles("HOUSEKEEPING")).header("Idempotency-Key","bad-room").contentType(APPLICATION_JSON)
            .content("{\"service_id\":\"RETITEM\",\"quantity\":1,\"reason\":\"Trả lại\",\"room_id\":\"UNKNOWN\"}"))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("ROOM_NOT_FOUND"));
    }
    @Test void concurrentApprovalsStillCreateOnlyOneMovement() throws Exception{
        long id=request("concurrent-request");
        try(var pool=java.util.concurrent.Executors.newFixedThreadPool(2)){
            java.util.concurrent.Callable<Void> approve=()->{
                mvc.perform(post("/api/operations/stock-returns/"+id+"/approve").with(user("WHRET").roles("KITCHEN")).contentType(APPLICATION_JSON).content("{}"))
                    .andExpect(status().isOk());return null;
            };
            var first=pool.submit(approve);var second=pool.submit(approve);
            first.get(15,java.util.concurrent.TimeUnit.SECONDS);second.get(15,java.util.concurrent.TimeUnit.SECONDS);
        }
        assertThat(stock()).isEqualTo(7);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM BienDongKhoDichVu WHERE maDichVu=N'RETITEM'",Integer.class)).isEqualTo(1);
    }
    @Test void requesterCannotApproveTheirOwnRequestEvenAfterChangingDepartments() throws Exception{
        long id=request("self-request");jdbc.update("UPDATE NhanVien SET vaiTro=N'Nhà bếp' WHERE maNhanVien=N'HKRET'");
        mvc.perform(post("/api/operations/stock-returns/"+id+"/approve").with(user("HKRET").roles("KITCHEN")).contentType(APPLICATION_JSON).content("{}"))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("STOCK_RETURN_FORBIDDEN"));
        assertThat(stock()).isEqualTo(5);
    }
    @Test void failedApprovalLeavesRequestPendingAndStockUnchanged() throws Exception{
        long id=request("overflow-request");jdbc.update("UPDATE DichVu SET soLuongTonKho=2147483647 WHERE maDichVu=N'RETITEM'");
        mvc.perform(post("/api/operations/stock-returns/"+id+"/approve").with(user("WHRET").roles("KITCHEN")).contentType(APPLICATION_JSON).content("{}"))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("INVALID_STOCK_RETURN"));
        assertThat(stock()).isEqualTo(Integer.MAX_VALUE);
        assertThat(jdbc.queryForObject("SELECT trangThai FROM YeuCauTraKho WHERE maYeuCauTraKho=?",String.class,id)).isEqualTo("Chờ duyệt");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM BienDongKhoDichVu WHERE maDichVu=N'RETITEM'",Integer.class)).isZero();
    }
}

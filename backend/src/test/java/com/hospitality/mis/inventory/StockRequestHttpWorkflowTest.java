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
class StockRequestHttpWorkflowTest {
    @Autowired MockMvc mvc; @Autowired JdbcTemplate jdbc; @Autowired ObjectMapper mapper;
    @BeforeEach void seed(){
        cleanup();
        jdbc.update("INSERT NhanVien(maNhanVien,hoVaTen,matKhau,vaiTro,soDienThoai) VALUES(N'HKRET',N'Buồng phòng test',N'not-used',N'Buồng phòng',N'0901110001'),(N'WHRET',N'Kho test',N'not-used',N'Nhà bếp',N'0901110002'),(N'HKRET2',N'Buồng phòng khác',N'not-used',N'Buồng phòng',N'0901110003')");
        jdbc.update("INSERT DichVu(maDichVu,ten,gia,donViTinh,soLuongTonKho,nguongAnToan,dangHoatDong,danhMuc) VALUES(N'RETITEM',N'Khăn trả kho',0,N'cái',5,1,0,N'Vật dụng phòng')");
        jdbc.update("INSERT TonKhoBuongPhong(maDichVu,soLuongTon) VALUES(N'RETITEM',4)");
    }
    @AfterEach void cleanup(){
        jdbc.update("DELETE YeuCauKho WHERE maDichVu=N'RETITEM'");
        jdbc.update("DELETE TonKhoBuongPhong WHERE maDichVu=N'RETITEM'");
        jdbc.update("DELETE BienDongKhoDichVu WHERE maDichVu=N'RETITEM'");
        jdbc.update("DELETE BanGhiChongTrung WHERE nguoiThucHien IN(N'HKRET',N'WHRET',N'HKRET2')");
        jdbc.update("DELETE NhatKyKiemSoat WHERE nguoiThucHien IN(N'HKRET',N'WHRET',N'HKRET2')");
        jdbc.update("DELETE DichVu WHERE maDichVu=N'RETITEM'");
        jdbc.update("DELETE NhanVien WHERE maNhanVien IN(N'HKRET',N'WHRET',N'HKRET2')");
    }
    private String body(int quantity){return "{\"service_id\":\"RETITEM\",\"kind\":\"RETURN\",\"quantity\":"+quantity+",\"reason\":\"Còn nguyên chưa dùng\"}";}
    private long request(String key) throws Exception{
        String json=mvc.perform(post("/api/operations/stock-requests").with(user("HKRET").roles("HOUSEKEEPING"))
            .header("Idempotency-Key",key).contentType(APPLICATION_JSON).content(body(2)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PENDING")).andReturn().getResponse().getContentAsString();
        return mapper.readTree(json).get("id").asLong();
    }
    private int stock(){return jdbc.queryForObject("SELECT soLuongTonKho FROM DichVu WHERE maDichVu=N'RETITEM'",Integer.class);}
    private int housekeepingStock(){return jdbc.queryForObject("SELECT soLuongTon FROM TonKhoBuongPhong WHERE maDichVu=N'RETITEM'",Integer.class);}
    private long request(String kind,int quantity,String key) throws Exception {
        var result=mvc.perform(post("/api/operations/stock-requests").with(user("HKRET").roles("HOUSEKEEPING"))
            .header("Idempotency-Key",key).contentType(APPLICATION_JSON).content(body(quantity).replace("RETURN",kind)))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return mapper.readTree(result).get("id").asLong();
    }
    private void approve(long id) throws Exception {
        mvc.perform(post("/api/operations/stock-requests/"+id+"/approve").with(user("WHRET").roles("KITCHEN"))
            .contentType(APPLICATION_JSON).content("{}")).andExpect(status().isOk());
    }
    @Test void requestDoesNotIncreaseStockAndRetryDoesNotDuplicate() throws Exception{
        long id=request("return-request"); assertThat(request("return-request")).isEqualTo(id);
        assertThat(stock()).isEqualTo(5);
        assertThat(housekeepingStock()).isEqualTo(4);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM YeuCauKho WHERE maDichVu=N'RETITEM'",Integer.class)).isEqualTo(1);
        mvc.perform(post("/api/operations/stock-requests").with(user("HKRET").roles("HOUSEKEEPING")).header("Idempotency-Key","return-request").contentType(APPLICATION_JSON).content(body(3)))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_CONFLICT"));
    }
    @Test void warehouseApprovalAddsStockExactlyOnceAndIsTerminal() throws Exception{
        long id=request("approve-request");
        for(int retry=0;retry<2;retry++)mvc.perform(post("/api/operations/stock-requests/"+id+"/approve").with(user("WHRET").roles("KITCHEN")).contentType(APPLICATION_JSON).content("{\"reason\":\"Đã kiểm đếm\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPROVED")).andExpect(jsonPath("$.approver").value("WHRET"));
        assertThat(stock()).isEqualTo(7);
        assertThat(housekeepingStock()).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM BienDongKhoDichVu WHERE maDichVu=N'RETITEM' AND loai=N'Hoàn kho'",Integer.class)).isEqualTo(1);
        mvc.perform(post("/api/operations/stock-requests/"+id+"/reject").with(user("WHRET").roles("KITCHEN")).contentType(APPLICATION_JSON).content("{\"reason\":\"Đổi ý\"}"))
            .andExpect(status().isUnprocessableEntity());
    }
    @Test void rejectionRequiresReasonAndNeverChangesStock() throws Exception{
        long id=request("reject-request");
        mvc.perform(post("/api/operations/stock-requests/"+id+"/reject").with(user("WHRET").roles("KITCHEN")).contentType(APPLICATION_JSON).content("{\"reason\":\" \"}"))
            .andExpect(status().isUnprocessableEntity());
        mvc.perform(post("/api/operations/stock-requests/"+id+"/reject").with(user("WHRET").roles("KITCHEN")).contentType(APPLICATION_JSON).content("{\"reason\":\"Hàng đã hỏng\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REJECTED"));
        assertThat(stock()).isEqualTo(5);
        mvc.perform(post("/api/operations/stock-requests/"+id+"/approve").with(user("WHRET").roles("KITCHEN")).contentType(APPLICATION_JSON).content("{}"))
            .andExpect(status().isUnprocessableEntity());
    }
    @Test void departmentsHaveSeparatePermissionsAndRequestersOnlySeeTheirOwnRequests() throws Exception{
        long id=request("access-request");
        mvc.perform(get("/api/operations/stock-requests").with(user("HKRET2").roles("HOUSEKEEPING"))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/operations/stock-requests").with(user("HKRET").roles("HOUSEKEEPING"))).andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(id));
        mvc.perform(post("/api/operations/stock-requests/"+id+"/approve").with(user("HKRET").roles("HOUSEKEEPING")).contentType(APPLICATION_JSON).content("{}"))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/operations/stock-requests").with(user("WHRET").roles("KITCHEN")).header("Idempotency-Key","wrong-role").contentType(APPLICATION_JSON).content(body(2)))
            .andExpect(status().isForbidden());
        mvc.perform(get("/api/operations/stock-requests").with(user("TECH").roles("TECHNICAL"))).andExpect(status().isForbidden());
        mvc.perform(post("/api/services/RETITEM/inventory-movements").with(user("HKRET").roles("HOUSEKEEPING")).header("Idempotency-Key","bypass").contentType(APPLICATION_JSON)
            .content("{\"service_id\":\"RETITEM\",\"type\":\"RETURN\",\"kind\":\"RETURN\",\"quantity\":2,\"reason\":\"Bypass\"}"))
            .andExpect(status().isForbidden());
        assertThat(stock()).isEqualTo(5);
    }
    @Test void invalidQuantityAndUnknownRoomAreRejected() throws Exception{
        mvc.perform(post("/api/operations/stock-requests").with(user("HKRET").roles("HOUSEKEEPING")).header("Idempotency-Key","zero").contentType(APPLICATION_JSON).content(body(0)))
            .andExpect(status().isBadRequest());
        mvc.perform(post("/api/operations/stock-requests").with(user("HKRET").roles("HOUSEKEEPING")).header("Idempotency-Key","bad-room").contentType(APPLICATION_JSON)
            .content("{\"service_id\":\"RETITEM\",\"kind\":\"RETURN\",\"quantity\":1,\"reason\":\"Trả lại\",\"room_id\":\"UNKNOWN\"}"))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("ROOM_NOT_FOUND"));
    }
    @Test void concurrentApprovalsStillCreateOnlyOneMovement() throws Exception{
        long id=request("concurrent-request");
        try(var pool=java.util.concurrent.Executors.newFixedThreadPool(2)){
            java.util.concurrent.Callable<Void> approve=()->{
                mvc.perform(post("/api/operations/stock-requests/"+id+"/approve").with(user("WHRET").roles("KITCHEN")).contentType(APPLICATION_JSON).content("{}"))
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
        mvc.perform(post("/api/operations/stock-requests/"+id+"/approve").with(user("HKRET").roles("KITCHEN")).contentType(APPLICATION_JSON).content("{}"))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("STOCK_REQUEST_FORBIDDEN"));
        assertThat(stock()).isEqualTo(5);
    }
    @Test void failedApprovalLeavesRequestPendingAndStockUnchanged() throws Exception{
        long id=request("overflow-request");jdbc.update("UPDATE DichVu SET soLuongTonKho=2147483647 WHERE maDichVu=N'RETITEM'");
        mvc.perform(post("/api/operations/stock-requests/"+id+"/approve").with(user("WHRET").roles("KITCHEN")).contentType(APPLICATION_JSON).content("{}"))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("INVALID_STOCK_REQUEST"));
        assertThat(stock()).isEqualTo(Integer.MAX_VALUE);
        assertThat(housekeepingStock()).isEqualTo(4);
        assertThat(jdbc.queryForObject("SELECT trangThai FROM YeuCauKho WHERE maYeuCauKho=?",String.class,id)).isEqualTo("Chờ duyệt");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM BienDongKhoDichVu WHERE maDichVu=N'RETITEM'",Integer.class)).isZero();
    }
    @Test void issueIsApprovedOnceAndDamageNeverEntersUsableStock() throws Exception {
        for(String kind:java.util.List.of("ISSUE","DAMAGE")){
            String json=mvc.perform(post("/api/operations/stock-requests").with(user("HKRET").roles("HOUSEKEEPING"))
                .header("Idempotency-Key","request-"+kind).contentType(APPLICATION_JSON).content(body(2).replace("RETURN",kind)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.kind").value(kind)).andReturn().getResponse().getContentAsString();
            long id=mapper.readTree(json).get("id").asLong();
            for(int retry=0;retry<2;retry++)mvc.perform(post("/api/operations/stock-requests/"+id+"/approve").with(user("WHRET").roles("KITCHEN")).contentType(APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPROVED"));
            assertThat(stock()).isEqualTo(3);
            assertThat(housekeepingStock()).isEqualTo(kind.equals("ISSUE")?6:4);
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM BienDongKhoDichVu WHERE maDichVu='RETITEM'",Integer.class)).isEqualTo(1);
    }

    @Test void catalogReadsDepartmentStockAndUnallocatedItemsStartAtZero() throws Exception {
        mvc.perform(get("/api/operations/stock-requests/catalog").with(user("HKRET").roles("HOUSEKEEPING")))
            .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.id == 'RETITEM')].stock").value(org.hamcrest.Matchers.contains(4)));
        mvc.perform(get("/api/services").with(user("WHRET").roles("KITCHEN")))
            .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.id == 'RETITEM')].stock").value(org.hamcrest.Matchers.contains(5)));
        jdbc.update("DELETE TonKhoBuongPhong WHERE maDichVu=N'RETITEM'");
        mvc.perform(get("/api/operations/stock-requests/catalog").with(user("HKRET").roles("HOUSEKEEPING")))
            .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.id == 'RETITEM')].stock").value(org.hamcrest.Matchers.contains(0)));
        approve(request("ISSUE",2,"first-allocation"));
        assertThat(stock()).isEqualTo(3);
        assertThat(housekeepingStock()).isEqualTo(2);
    }

    @Test void issueAndReturnMoveTheSameQuantityBetweenWarehouses() throws Exception {
        long issue=request("ISSUE",3,"transfer-out");
        approve(issue);approve(issue);
        assertThat(stock()).isEqualTo(2);
        assertThat(housekeepingStock()).isEqualTo(7);
        long returned=request("RETURN",3,"transfer-back");
        approve(returned);approve(returned);
        assertThat(stock()).isEqualTo(5);
        assertThat(housekeepingStock()).isEqualTo(4);
    }

    @Test void damageOnlyReducesHousekeepingStockOnce() throws Exception {
        long id=request("DAMAGE",2,"damaged-items");approve(id);approve(id);
        assertThat(stock()).isEqualTo(5);
        assertThat(housekeepingStock()).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM BienDongKhoDichVu WHERE maDichVu=N'RETITEM'",Integer.class)).isZero();
    }

    @Test void insufficientDepartmentStockCannotBeReturnedOrWrittenOff() throws Exception {
        for(String kind:java.util.List.of("RETURN","DAMAGE")) {
            long id=request(kind,5,"too-many-"+kind);
            mvc.perform(post("/api/operations/stock-requests/"+id+"/approve").with(user("WHRET").roles("KITCHEN"))
                .contentType(APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("INSUFFICIENT_HOUSEKEEPING_STOCK"));
            assertThat(jdbc.queryForObject("SELECT trangThai FROM YeuCauKho WHERE maYeuCauKho=?",String.class,id)).isEqualTo("Chờ duyệt");
        }
        assertThat(stock()).isEqualTo(5);assertThat(housekeepingStock()).isEqualTo(4);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM BienDongKhoDichVu WHERE maDichVu=N'RETITEM'",Integer.class)).isZero();
    }

    @Test void failedIssueDoesNotAddDepartmentStockAndCanBeRetriedAfterRestock() throws Exception {
        long id=request("ISSUE",6,"insufficient-main");
        mvc.perform(post("/api/operations/stock-requests/"+id+"/approve").with(user("WHRET").roles("KITCHEN"))
            .contentType(APPLICATION_JSON).content("{}"))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("INSUFFICIENT_STOCK"));
        assertThat(stock()).isEqualTo(5);assertThat(housekeepingStock()).isEqualTo(4);
        jdbc.update("UPDATE DichVu SET soLuongTonKho=6 WHERE maDichVu=N'RETITEM'");
        approve(id);approve(id);
        assertThat(stock()).isZero();assertThat(housekeepingStock()).isEqualTo(10);
    }

    @Test void concurrentDifferentRequestsCannotOverdrawDepartmentStock() throws Exception {
        long first=request("RETURN",3,"race-first"),second=request("RETURN",3,"race-second");
        var gate=new java.util.concurrent.CountDownLatch(1);
        try(var pool=java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var futures=java.util.List.of(first,second).stream().map(id->pool.submit(()->{
                gate.await();
                return mvc.perform(post("/api/operations/stock-requests/"+id+"/approve").with(user("WHRET").roles("KITCHEN"))
                    .contentType(APPLICATION_JSON).content("{}")).andReturn().getResponse().getStatus();
            })).toList();
            gate.countDown();
            assertThat(java.util.List.of(futures.get(0).get(15,java.util.concurrent.TimeUnit.SECONDS),futures.get(1).get(15,java.util.concurrent.TimeUnit.SECONDS)))
                .containsExactlyInAnyOrder(200,422);
        }
        assertThat(stock()).isEqualTo(8);assertThat(housekeepingStock()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM YeuCauKho WHERE maDichVu=N'RETITEM' AND trangThai=N'Đã duyệt'",Integer.class)).isEqualTo(1);
    }

}

package com.hospitality.mis.inventory;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
@AutoConfigureMockMvc
@Transactional
class InventoryVoucherHttpTest {
    @Autowired JdbcTemplate jdbc;@Autowired MockMvc mvc;
    @Test void voucherDataUsesTheActualActorAndReconstructsStockInStableLedgerOrder()throws Exception{
        jdbc.update("INSERT NhanVien(maNhanVien,hoVaTen,matKhau,vaiTro,soDienThoai) VALUES(N'EXPORT1',N'Nguyễn Văn Nhập',N'unused',N'Nhà bếp',N'0901120041'),(N'EXPORT2',N'Trần Thị Xuất',N'unused',N'Nhà bếp',N'0901120042')");
        jdbc.update("INSERT DichVu(maDichVu,ten,gia,donViTinh,soLuongTonKho,dangHoatDong) VALUES(N'VOUCHER',N'Hàng test',10000,N'cái',12,0)");
        jdbc.update("INSERT BienDongKhoDichVu(maDichVu,loai,soLuong,maNguoiThucHien,thoiDiemPhatSinh) VALUES(N'VOUCHER',N'Nhập kho',5,N'EXPORT1','2035-01-10T10:00:00'),(N'VOUCHER',N'Xuất kho',4,N'EXPORT2','2035-01-10T10:00:00'),(N'VOUCHER',N'Hao hụt',1,N'EXPORT2','2035-01-10T10:00:00')");
        mvc.perform(get("/api/services/VOUCHER/inventory-movements").with(user("EXPORT1").roles("KITCHEN")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(3))
            .andExpect(jsonPath("$[0].actor_name").value("Trần Thị Xuất")).andExpect(jsonPath("$[0].stock_before").value(13)).andExpect(jsonPath("$[0].stock_after").value(12))
            .andExpect(jsonPath("$[1].actor_name").value("Trần Thị Xuất")).andExpect(jsonPath("$[1].stock_before").value(17)).andExpect(jsonPath("$[1].stock_after").value(13))
            .andExpect(jsonPath("$[2].actor_name").value("Nguyễn Văn Nhập")).andExpect(jsonPath("$[2].stock_before").value(12)).andExpect(jsonPath("$[2].stock_after").value(17));
    }
}

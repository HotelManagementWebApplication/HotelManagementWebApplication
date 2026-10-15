package com.hospitality.mis.billing;
import com.hospitality.mis.dto.billing.ServiceAvailabilityDtos;
import com.hospitality.mis.service.billing.ServiceAvailabilityService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import java.time.LocalDateTime;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
@AutoConfigureMockMvc
class ServiceAvailabilityHttpTest {
    @Autowired JdbcTemplate jdbc; @Autowired ServiceAvailabilityService service; @Autowired MockMvc mvc;
    private long reservation,guest;
    @BeforeEach void seed(){
        jdbc.update("INSERT LoaiPhong(maLoaiPhong,ten,giaTheoNgay) VALUES(N'AVTYPE',N'Availability test',100000)");
        jdbc.update("INSERT Phong(maPhong,maLoaiPhong,trangThai) VALUES(N'AVROOM',N'AVTYPE',N'Đang có khách')");
        guest=jdbc.queryForObject("INSERT KhachLuuTru(hoVaTen,soDienThoai,soGiayToTuyThan) OUTPUT INSERTED.maKhachLuuTru VALUES(N'Availability guest',N'0997123499',N'AV-GUEST')",Long.class);
        reservation=jdbc.queryForObject("INSERT PhieuDatPhong(maKhachLuuTru,trangThai,hinhThucThue,trangThaiThanhToanCoc) OUTPUT INSERTED.maPhieuDatPhong VALUES(?,N'Đã nhận phòng',N'Theo gói',N'Đã thanh toán')",Long.class,guest);
        jdbc.update("INSERT ChiTietDatPhong(maPhieuDatPhong,maPhong,thoiDiemNhanPhong,thoiDiemTraPhong,thoiDiemTraPhongBanDau,soLuongKhach,trangThai) VALUES(?,N'AVROOM','2035-01-10T00:00:00','2035-01-13T12:00:00','2035-01-13T12:00:00',2,N'Đang có khách')",reservation);
        for(String id:new String[]{"AVCOURT","AVTOUR","AVBED","AVSTOCK"})jdbc.update("INSERT DichVu(maDichVu,ten,gia,donViTinh,danhMuc,soLuongTonKho) VALUES(?,?,100,N'giờ',N'Giải trí',5)",id,id);
        jdbc.update("INSERT CauHinhLichDichVu VALUES(N'AVCOURT',2,N'sân',60,N'Theo thời lượng'),(N'AVTOUR',20,N'suất',240,N'Theo lượt'),(N'AVBED',3,N'giường',1440,N'Theo kỳ lưu trú'),(N'AVSTOCK',5,N'bộ',60,N'Theo tồn kho')");
    }
    @AfterEach void cleanup(){
        jdbc.update("DELETE DatDichVuKhachSan WHERE maPhieuDatPhong=?",reservation);
        jdbc.update("DELETE PhieuDatPhong WHERE maPhieuDatPhong=?",reservation);
        jdbc.update("DELETE KhachLuuTru WHERE maKhachLuuTru=?",guest);
        jdbc.update("DELETE Phong WHERE maPhong=N'AVROOM'");jdbc.update("DELETE LoaiPhong WHERE maLoaiPhong=N'AVTYPE'");
        jdbc.update("DELETE CauHinhLichDichVu WHERE maDichVu IN(N'AVCOURT',N'AVTOUR',N'AVBED',N'AVSTOCK')");
        jdbc.update("DELETE DichVu WHERE maDichVu IN(N'AVCOURT',N'AVTOUR',N'AVBED',N'AVSTOCK')");
    }
    private void book(String id,String at,int quantity,String status){
        jdbc.update("INSERT DatDichVuKhachSan(maPhieuDatPhong,maPhong,maDichVu,thoiDiemDuKien,soLuong,donGia,trangThai,khoaYeuCau,maBamYeuCau,nguoiTao) VALUES(?,N'AVROOM',?,?,?,100,?,?,?,N'AVTEST')",reservation,id,at,quantity,status,java.util.UUID.randomUUID().toString(),"a".repeat(64));
    }
    private ServiceAvailabilityDtos.Response result(String id,String from,String to){return service.list(LocalDateTime.parse(from),LocalDateTime.parse(to)).stream().filter(row->row.serviceId().equals(id)).findFirst().orElseThrow();}
    @Test void hourlyQuantityKeepsOneCourtForTheWholeDurationAndUsesExclusiveEnd(){
        book("AVCOURT","2035-01-10T09:00:00",2,"Đã xác nhận");
        book("AVCOURT","2035-01-10T10:00:00",1,"Đã xác nhận");
        var busy=result("AVCOURT","2035-01-10T09:30:00","2035-01-10T10:30:00");
        assertThat(busy.available()).isZero();assertThat(busy.booked()).isEqualTo(2);assertThat(busy.unit()).isEqualTo("sân");
        assertThat(result("AVCOURT","2035-01-10T11:00:00","2035-01-10T12:00:00").available()).isEqualTo(2);
        assertThat(result("AVCOURT","2035-01-10T08:00:00","2035-01-10T09:00:00").available()).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT donViTinh FROM DichVu WHERE maDichVu=N'AVCOURT'",String.class)).isEqualTo("giờ");
    }
    @Test void adjacentBookingsUsePeakConcurrencyNotSumAndCancelledOnesDoNotOccupy(){
        book("AVTOUR","2035-01-10T08:00:00",7,"Đã xác nhận");
        book("AVTOUR","2035-01-10T12:00:00",9,"Đã xác nhận");
        book("AVTOUR","2035-01-10T09:00:00",20,"Đã hủy");
        var row=result("AVTOUR","2035-01-10T08:00:00","2035-01-10T16:00:00");
        assertThat(row.booked()).isEqualTo(9);assertThat(row.available()).isEqualTo(11);
        assertThat(result("AVTOUR","2035-01-11T08:00:00","2035-01-11T16:00:00").available()).isEqualTo(20);
    }
    @Test void usedResourcesOccupyOnlyTheirTimeWindowAndOverbookedCountsNeverGoNegative(){
        book("AVTOUR","2035-01-10T10:00:00",25,"Đã sử dụng");
        assertThat(result("AVTOUR","2035-01-10T11:00:00","2035-01-10T12:00:00").available()).isZero();
        assertThat(result("AVTOUR","2035-01-10T14:00:00","2035-01-10T15:00:00").available()).isEqualTo(20);
    }
    @Test void extraBedsStayOccupiedUntilCheckoutAndCourtsCanSpanMidnight(){
        book("AVBED","2035-01-10T08:00:00",2,"Đã xác nhận");
        assertThat(result("AVBED","2035-01-12T11:00:00","2035-01-12T12:00:00").available()).isEqualTo(1);
        assertThat(result("AVBED","2035-01-13T12:00:00","2035-01-13T13:00:00").available()).isEqualTo(3);
        book("AVCOURT","2035-01-10T23:00:00",2,"Đã xác nhận");
        assertThat(result("AVCOURT","2035-01-11T00:30:00","2035-01-11T01:00:00").available()).isEqualTo(1);
    }
    @Test void consumableStockReservesConfirmedBookingsWithoutDoubleCountingUsedOnes(){
        book("AVSTOCK","2035-01-11T10:00:00",2,"Đã xác nhận");
        book("AVSTOCK","2035-01-10T10:00:00",3,"Đã sử dụng");
        assertThat(result("AVSTOCK","2035-01-10T10:00:00","2035-01-10T11:00:00").available()).isEqualTo(3);
    }
    @Test void dailyPassesExpireAtMidnightAndOvernightLaundryEndsAtEight(){
        jdbc.update("UPDATE CauHinhLichDichVu SET cachTinh=N'Theo ngày' WHERE maDichVu=N'AVTOUR'");
        book("AVTOUR","2035-01-10T18:00:00",3,"Đã xác nhận");
        assertThat(result("AVTOUR","2035-01-10T09:00:00","2035-01-10T10:00:00").available()).isEqualTo(17);
        assertThat(result("AVTOUR","2035-01-11T00:00:00","2035-01-11T01:00:00").available()).isEqualTo(20);
        jdbc.update("UPDATE CauHinhLichDichVu SET cachTinh=N'Qua đêm' WHERE maDichVu=N'AVSTOCK'");
        book("AVSTOCK","2035-01-10T20:00:00",2,"Đã xác nhận");
        assertThat(result("AVSTOCK","2035-01-11T07:00:00","2035-01-11T08:00:00").available()).isEqualTo(3);
        assertThat(result("AVSTOCK","2035-01-11T08:00:00","2035-01-11T09:00:00").available()).isEqualTo(5);
    }
    @Test void apiValidatesWindowAndPermissions()throws Exception{
        String url="/api/services/availability";
        mvc.perform(get(url).with(user("KITCHEN").roles("KITCHEN")).param("from","2035-01-10T10:00:00").param("to","2035-01-10T11:00:00")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(4));
        mvc.perform(get(url).with(user("KITCHEN").roles("KITCHEN")).param("from","2035-01-10T11:00:00").param("to","2035-01-10T10:00:00")).andExpect(status().isUnprocessableEntity());
        mvc.perform(get(url).with(user("CUSTOMER").roles("CUSTOMER")).param("from","2035-01-10T10:00:00").param("to","2035-01-10T11:00:00")).andExpect(status().isForbidden());
    }
}

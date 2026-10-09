package com.hospitality.mis.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.operations.EnterpriseDtos;
import com.hospitality.mis.service.operations.EnterpriseExtensionService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.*;

/** Calls production services against migrated SQL Server, never a mock or H2. */
@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
class SqlServerEnterpriseCommandsTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired EnterpriseExtensionService service;
    long guest,reservation,invoice;
    LocalDate day=LocalDate.of(2036,3,2);

    @BeforeEach void seed() {
        jdbc.update("INSERT NhanVien(maNhanVien,hoVaTen,matKhau,vaiTro,soDienThoai) VALUES(N'ENT01',N'Enterprise',N'unused',N'Nhân sự',N'0998111122')");
        guest=jdbc.queryForObject("INSERT KhachLuuTru(hoVaTen,soDienThoai,soGiayToTuyThan) OUTPUT INSERTED.maKhachLuuTru VALUES(N'Enterprise guest',N'0998111123',N'ENTGUEST')",Long.class);
        reservation=jdbc.queryForObject("INSERT PhieuDatPhong(maKhachLuuTru,nguonDatPhong,doanhThuGopOta,hoaHongOta) OUTPUT INSERTED.maPhieuDatPhong VALUES(?,N'BOOKING_COM',120000,20000)",Long.class,guest);
        invoice=jdbc.queryForObject("INSERT HoaDon(maPhieuDatPhong,soTienPhaiTra) OUTPUT INSERTED.maHoaDon VALUES(?,100000)",Long.class,reservation);
        jdbc.update("INSERT MatHangTonKho(maMatHang,ten,danhMuc,donViTinh,soLuongHienTai) VALUES(N'ENT-STOCK',N'Enterprise stock',N'Đồ vải',N'bộ',10)");
    }
    @AfterEach void cleanup() {
        jdbc.update("DELETE HoaDonGiaTriGiaTang WHERE maHoaDon=?",invoice);
        jdbc.update("DELETE HoaDon WHERE maHoaDon=?",invoice);
        jdbc.update("DELETE PhieuDatPhong WHERE maPhieuDatPhong=?",reservation);
        jdbc.update("DELETE KhachLuuTru WHERE maKhachLuuTru=?",guest);
        jdbc.update("DELETE ChamCong WHERE maNhanVien=N'ENT01'");
        jdbc.update("DELETE DonNghiPhep WHERE maNhanVien=N'ENT01'");
        jdbc.update("DELETE NhanVien WHERE maNhanVien=N'ENT01'");
        jdbc.update("DELETE BienDongTonKho WHERE maMatHang=N'ENT-STOCK'");
        jdbc.update("DELETE MatHangTonKho WHERE maMatHang=N'ENT-STOCK'");
        jdbc.update("DELETE TaiSanKyThuat WHERE maTaiSanKyThuat=N'ENT-ASSET'");
    }

    @Test void otaReadAndUpdatePreserveRevenueAndRejectDirectBookings() {
        var row=service.updateOtaStatus(reservation,"MATCHED");
        assertThat(row.grossRevenue()).isEqualByComparingTo("120000");
        assertThat(row.netRevenue()).isEqualByComparingTo("100000");
        assertThat(row.status()).isEqualTo("MATCHED");
        jdbc.update("UPDATE PhieuDatPhong SET nguonDatPhong=N'Trực tiếp' WHERE maPhieuDatPhong=?",reservation);
        code(()->service.updateOtaStatus(reservation,"MATCHED"),"OTA_RESERVATION_NOT_FOUND");
    }
    @Test void vatUsesInvoiceAmountAndExportsEscapedXml() {
        var vat=service.createVat(vatRequest(),"ENT01");
        assertThat(vat.taxableAmount()).isEqualByComparingTo("100000");
        assertThat(vat.taxAmount()).isEqualByComparingTo("8000");
        assertThat(vat.totalAmount()).isEqualByComparingTo("108000");
        assertThat(service.exportVatXml(vat.id())).contains("A &amp; B &lt;guest&gt;");
        assertThat(service.vatInvoices().stream().filter(r->r.id().equals(vat.id())).findFirst().orElseThrow().xmlStatus()).isEqualTo("EXPORTED");
        code(()->service.createVat(vatRequest(),"ENT01"),"VAT_EXISTS");
        code(()->service.exportVatXml(-1),"VAT_NOT_FOUND");
    }
    @Test void concurrentVatCreationHasOneWinnerWithoutPartialInvoice() throws Exception {
        assertThat(race(()-> {service.createVat(vatRequest(),"ENT01");return "SUCCESS";})).containsExactlyInAnyOrder("SUCCESS","VAT_EXISTS");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM HoaDonGiaTriGiaTang WHERE maHoaDon=?",Integer.class,invoice)).isEqualTo(1);
    }
    @Test void attendanceBatchRollsBackEarlierRowsIfLaterEmployeeIsMissing() {
        assertThatThrownBy(()->service.importAttendance(new EnterpriseDtos.AttendanceImportRequest(List.of(attendance("ENT01"),attendance("MISSING"))),"ENT01")).isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM ChamCong WHERE maNhanVien=N'ENT01'",Integer.class)).isZero();
    }
    @Test void attendanceUpsertRetainsIdentityAndInputOrderForDuplicates() {
        service.importAttendance(new EnterpriseDtos.AttendanceImportRequest(List.of(attendance("ENT01"))),"ENT01");
        long id=service.attendance(day).stream().filter(r->r.employeeId().equals("ENT01")).findFirst().orElseThrow().id();
        var second=new EnterpriseDtos.AttendanceInput("ENT01",day,day.atTime(9,0),day.atTime(17,0),"LATE","BIOMETRIC_IMPORT","event-2","updated");
        service.importAttendance(new EnterpriseDtos.AttendanceImportRequest(List.of(attendance("ENT01"),second)),"ENT01");
        var result=service.attendance(day).stream().filter(r->r.employeeId().equals("ENT01")).findFirst().orElseThrow();
        assertThat(result.id()).isEqualTo(id); assertThat(result.status()).isEqualTo("LATE");
        assertThat(result.deviceEventId()).isEqualTo("event-2");
    }
    @Test void leaveDecisionOnlyConsumesPendingOnce() throws Exception {
        var leave=service.createLeave(new EnterpriseDtos.LeaveRequest("ENT01","ANNUAL",day,day.plusDays(1),"Annual leave",null),"ENT01");
        assertThat(race(()-> {service.decideLeave(leave.id(),true,"ENT01");return "SUCCESS";})).containsExactlyInAnyOrder("SUCCESS","LEAVE_NOT_PENDING");
        var result=service.leaves("APPROVED").stream().filter(r->r.id().equals(leave.id())).findFirst().orElseThrow();
        assertThat(result.approver()).isEqualTo("ENT01"); assertThat(result.decidedAt()).isNotNull();
    }
    @Test void stockAdjustIsAbsoluteAndFailedIssueWritesNothing() {
        assertThat(service.moveStock(stock("ADJUST",3),"ENT01").currentQuantity()).isEqualTo(3);
        code(()->service.moveStock(stock("ISSUE",4),"ENT01"),"INSUFFICIENT_STOCK");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM BienDongTonKho WHERE maMatHang=N'ENT-STOCK'",Integer.class)).isEqualTo(1);
        assertThat(service.moveStock(stock("WASTE",1),"ENT01").currentQuantity()).isEqualTo(2);
        code(()->service.moveStock(new EnterpriseDtos.StockMovementRequest("missing","ISSUE",1,null),"ENT01"),"STOCK_ITEM_NOT_FOUND");
    }
    @Test void concurrentStockIssuesDoNotOverspend() throws Exception {
        assertThat(race(()-> {service.moveStock(stock("ISSUE",7),"ENT01");return "SUCCESS";})).containsExactlyInAnyOrder("SUCCESS","INSUFFICIENT_STOCK");
        assertThat(jdbc.queryForObject("SELECT soLuongHienTai FROM MatHangTonKho WHERE maMatHang=N'ENT-STOCK'",Integer.class)).isEqualTo(3);
    }
    @Test void assetCommandsPersistValuesAndNotFoundContract() {
        var asset=service.createAsset(new EnterpriseDtos.TechnicalAssetRequest("ENT-ASSET","Pump","Pump","BUILDING",null,1,"Lobby","Brand",day,day.plusMonths(1),null,new BigDecimal("120000"),"note"));
        assertThat(asset.status()).isEqualTo("GOOD");assertThat(asset.originalValue()).isEqualByComparingTo("120000");
        assertThat(service.updateAssetStatus(asset.id(),"MAINTENANCE_NEEDED").status()).isEqualTo("MAINTENANCE_NEEDED");
        code(()->service.updateAssetStatus("missing","GOOD"),"ASSET_NOT_FOUND");
    }
    private EnterpriseDtos.VatInvoiceRequest vatRequest(){return new EnterpriseDtos.VatInvoiceRequest(invoice,"INDIVIDUAL","A & B <guest>",null,null,null,null);}
    private EnterpriseDtos.AttendanceInput attendance(String employee){return new EnterpriseDtos.AttendanceInput(employee,day,day.atTime(8,0),day.atTime(17,0),"PRESENT","MANUAL","event-1",null);}
    private EnterpriseDtos.StockMovementRequest stock(String type,int quantity){return new EnterpriseDtos.StockMovementRequest("ENT-STOCK",type,quantity,"test");}
    private void code(Runnable operation,String expected){assertThatThrownBy(operation::run).isInstanceOf(DomainException.class).extracting("code").isEqualTo(expected);}
    private List<String> race(Callable<String> operation)throws Exception {
        var start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            Callable<String> run=()->{start.await();try{return operation.call();}catch(DomainException error){return error.getCode();}};
            var first=pool.submit(run);var second=pool.submit(run);start.countDown();
            return List.of(first.get(30,TimeUnit.SECONDS),second.get(30,TimeUnit.SECONDS));
        }
    }
}

package com.hospitality.mis.billing;

import com.hospitality.mis.dao.billing.PaymentReportingDatabase;
import com.hospitality.mis.dao.billing.PaymentDatabase;
import com.hospitality.mis.dao.billing.InvoiceDatabase;
import com.hospitality.mis.entity.billing.PaymentMethod;
import com.hospitality.mis.entity.billing.PaymentTransaction.TransactionType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import java.time.LocalDateTime;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
@Transactional
@AutoConfigureMockMvc
class SqlServerPaymentReportingTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired PaymentReportingDatabase reporting;
    @Autowired PaymentDatabase payments;
    @Autowired InvoiceDatabase invoices;
    @Autowired MockMvc mvc;
    long invoice;
    long guest;
    final LocalDateTime from=LocalDateTime.of(2037,4,5,8,0),to=from.plusHours(1);
    @BeforeEach void seed(){
        guest=jdbc.queryForObject("INSERT KhachLuuTru(hoVaTen,soDienThoai,soGiayToTuyThan) OUTPUT INSERTED.maKhachLuuTru VALUES(N'Report guest',N'0997444555',N'REPORTGUEST')",Long.class);
        long reservation=jdbc.queryForObject("INSERT PhieuDatPhong(maKhachLuuTru) OUTPUT INSERTED.maPhieuDatPhong VALUES(?)",Long.class,guest);
        invoice=jdbc.queryForObject("INSERT HoaDon(maPhieuDatPhong) OUTPUT INSERTED.maHoaDon VALUES(?)",Long.class,reservation);
        payment(100,"Tiền mặt","Thanh toán","Đã hoàn tất","REPORT",from);
        payment(70,"Tiền mặt","Thanh toán","Đã hoàn tất","REPORT",from.plusMinutes(5));
        payment(20,"Tiền mặt","Hoàn tiền","Đã hoàn tất","REPORT",to);
        payment(200,"Tiền mặt","Thanh toán","Đã hoàn tất","REPORT",to.plusNanos(1000));
        payment(100,"Tiền mặt","Thanh toán","Thất bại","REPORT",from.plusMinutes(5));
        payment(300,"Thẻ","Thanh toán","Đã hoàn tất","REPORT",from.plusMinutes(5));
        payment(400,"Tiền mặt","Thanh toán","Đã hoàn tất","OTHER",from.plusMinutes(5));
    }
    @Test void cashUsesExclusiveLowerInclusiveUpperBoundaryAndCompletedActorTenderOnly(){
        assertThat(reporting.netCashByActorBetween("REPORT",from,to)).isEqualByComparingTo("50");
        assertThat(reporting.netCashByActorBetween("missing",from,to)).isEqualByComparingTo("0");
    }
    @Test void reconciliationUsesInclusiveLowerExclusiveUpperBoundaryAndKeepsTenderGroups(){
        var totals=reporting.summarize(from,to);
        assertThat(totals).hasSize(2);
        assertThat(totals.stream().filter(r->r.method()==PaymentMethod.CASH).findFirst().orElseThrow().amount()).isEqualByComparingTo("570");
        assertThat(totals.stream().filter(r->r.method()==PaymentMethod.CARD).findFirst().orElseThrow().amount()).isEqualByComparingTo("300");
        assertThat(totals).extracting(PaymentReportingDatabase.Total::type).containsOnly(TransactionType.PAYMENT);
        assertThat(reporting.completedCount(from,to)).isEqualTo(4);
    }
    @Test void paginatedLedgerAndInvoicesKeepRecordsPastOneHundredAndSearchAcrossPages() throws Exception {
        var at=from.plusDays(2);
        long firstInvoice=0,firstPayment=0,lastPayment=0;
        for(int index=0;index<150;index++){
            long booking=jdbc.queryForObject("INSERT PhieuDatPhong(maKhachLuuTru) OUTPUT INSERTED.maPhieuDatPhong VALUES(?)",Long.class,guest);
            long bill=jdbc.queryForObject("INSERT HoaDon(maPhieuDatPhong,thoiDiemPhatHanh) OUTPUT INSERTED.maHoaDon VALUES(?,?)",Long.class,booking,at);
            lastPayment=jdbc.queryForObject("SET NOCOUNT ON; DECLARE @inserted TABLE(id BIGINT); INSERT GiaoDichThanhToan(maHoaDon,soTien,phuongThuc,loai,trangThai,maThamChieu,maNguoiThucHien,thoiDiemPhatSinh) OUTPUT INSERTED.maGiaoDichThanhToan INTO @inserted VALUES(?,100,?,N'Thanh toán',N'Đã hoàn tất',?,N'PAGING',?); SELECT id FROM @inserted;",Long.class,bill,index%2==0?"Tiền mặt":"Thẻ","PAGING-"+index,at);
            if(index==0){firstInvoice=bill;firstPayment=lastPayment;}
        }
        var last=payments.ledgerPage(null,null,null,null,at,at.plusDays(1),null,14,10);
        assertThat(last.totalElements()).isEqualTo(150);assertThat(last.totalPages()).isEqualTo(15);assertThat(last.items()).hasSize(10);
        assertThat(last.methodCounts()).containsEntry("CASH",75L).containsEntry("CARD",75L);
        assertThat(last.items().getLast().id()).isEqualTo(firstPayment);assertThat(last.items().getLast().invoiceId()).isEqualTo(firstInvoice);
        assertThat(last.items().getLast().reservationId()).isNotNull();
        assertThat(invoices.page(null,null,at.toLocalDate(),at.toLocalDate(),1,100).items()).hasSize(50);
        var search=payments.ledgerPage(null,PaymentMethod.CARD,null,null,at,at.plusDays(1),"PAGING-149",0,10);
        assertThat(search.totalElements()).isEqualTo(1);assertThat(search.items().getFirst().id()).isEqualTo(lastPayment);
        assertThat(payments.ledgerPage(null,null,null,null,at,at.plusDays(1),"' OR 1=1 --",0,10).totalElements()).isZero();
        mvc.perform(get("/api/finance/payments").param("from",at.toLocalDate().toString()).param("to",at.toLocalDate().toString()).param("page","14").param("size","10")
            .with(jwt().jwt(j->j.subject("ACCOUNTING").claim("principal_type","EMPLOYEE").claim("principal_id","ACCOUNTING")).authorities(new SimpleGrantedAuthority("ROLE_ACCOUNTING"))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.page").value(14)).andExpect(jsonPath("$.total_elements").value(150))
            .andExpect(jsonPath("$.total_pages").value(15)).andExpect(jsonPath("$.method_counts.CASH").value(75))
            .andExpect(jsonPath("$.items[9].invoice_id").value(firstInvoice)).andExpect(jsonPath("$.items[9].reservation_id").isNumber());
        mvc.perform(get("/api/finance/payments").with(jwt().jwt(j->j.subject("STAFF").claim("principal_type","EMPLOYEE").claim("principal_id","STAFF")).authorities(new SimpleGrantedAuthority("ROLE_STAFF"))))
            .andExpect(status().isForbidden());
    }
    @Test void pendingBankTransfersAggregateAllInvoices(){
        var before=reporting.pendingBankTransfers();
        long booking=jdbc.queryForObject("INSERT PhieuDatPhong(maKhachLuuTru) OUTPUT INSERTED.maPhieuDatPhong VALUES(?)",Long.class,guest);
        jdbc.update("INSERT HoaDon(maPhieuDatPhong,tongTienPhong,phuongThucThanhToan,trangThai) VALUES(?,600000,N'Chuyển khoản ngân hàng',N'Chưa thanh toán')",booking);
        assertThat(reporting.pendingBankTransfers().subtract(before)).isEqualByComparingTo("600000");
    }
    private void payment(int amount,String method,String type,String status,String actor,LocalDateTime at){jdbc.update("INSERT GiaoDichThanhToan(maHoaDon,soTien,phuongThuc,loai,trangThai,maNguoiThucHien,thoiDiemPhatSinh) VALUES(?,?,?,?,?,?,?)",invoice,amount,method,type,status,actor,at);}
}

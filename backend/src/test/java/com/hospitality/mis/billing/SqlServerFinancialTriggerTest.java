package com.hospitality.mis.billing;
import com.hospitality.mis.reservation.ReservationSqlFixture;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class SqlServerFinancialTriggerTest extends ReservationSqlFixture {
    @Test void installedTriggersAreEnabledAndRejectUnfundedMultiRowReceiptAtomically(){
        assertThat(jdbc.queryForList("SELECT name FROM sys.triggers WHERE parent_id IN(OBJECT_ID(N'dbo.BienLai'),OBJECT_ID(N'dbo.GiaoDichThanhToan')) AND is_disabled=0",String.class))
            .containsExactlyInAnyOrder("trgBienLaiBaoDamTienThu","trgThanhToanBaoDamBienLai");
        var booking=create(now.plusDays(4),24,false,"HCT-R1");long invoice=billing.getByReservation(booking.id()).id();
        assertThatThrownBy(()->jdbc.update("INSERT BienLai(soBienLai,maHoaDon,soTien,phuongThuc,thoiDiemPhatHanh,nguoiPhatHanh) VALUES(N'HCT-X1',?,1,N'Tiền mặt',GETDATE(),N'HCT-FD'),(N'HCT-X2',?,1,N'Tiền mặt',GETDATE(),N'HCT-FD')",invoice,invoice)).hasMessageContaining("53601");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM BienLai WHERE maHoaDon=?",Integer.class,invoice)).isEqualTo(1);
    }
    @Test void paymentChangeDeleteAndInvalidCodesRollbackButRefundPreservesHistoricalReceipt(){
        var booking=create(now.plusDays(4),24,false,"HCT-R1");long invoice=billing.getByReservation(booking.id()).id();
        assertThatThrownBy(()->jdbc.update("UPDATE GiaoDichThanhToan SET soTien=1 WHERE maHoaDon=?",invoice)).hasMessageContaining("53603");
        assertThatThrownBy(()->jdbc.update("DELETE GiaoDichThanhToan WHERE maHoaDon=?",invoice)).hasMessageContaining("53603");
        assertThatThrownBy(()->jdbc.update("UPDATE GiaoDichThanhToan SET loai=N'PAYMENT' WHERE maHoaDon=?",invoice)).hasMessageContaining("chkGiaoDichThanhToanloai");
        jdbc.update("INSERT GiaoDichThanhToan(maHoaDon,soTien,phuongThuc,loai,trangThai,thoiDiemPhatSinh,maNguoiThucHien) VALUES(?,1,N'Tiền mặt',N'Hoàn tiền',N'Đã hoàn tất',GETDATE(),N'HCT-FD')",invoice);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM BienLai WHERE maHoaDon=?",Integer.class,invoice)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT soTien FROM GiaoDichThanhToan WHERE maHoaDon=? AND loai=N'Thanh toán'",java.math.BigDecimal.class,invoice)).isEqualByComparingTo("1200000");
    }
}

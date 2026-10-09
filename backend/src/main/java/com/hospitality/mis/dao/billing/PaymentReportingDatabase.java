package com.hospitality.mis.dao.billing;

import com.hospitality.mis.entity.billing.PaymentMethod;
import com.hospitality.mis.entity.billing.PaymentTransaction.TransactionType;
import com.hospitality.mis.persistence.VietnameseEnumConverters;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public class PaymentReportingDatabase {
    private final JdbcTemplate jdbc;
    public PaymentReportingDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public record Total(PaymentMethod method,TransactionType type,BigDecimal amount) {}
    public long completedCount(LocalDateTime from,LocalDateTime to){
        return jdbc.queryForObject("SELECT COUNT_BIG(*) FROM dbo.vwGiaoDichDoiSoat WHERE thoiDiemPhatSinh>=? AND thoiDiemPhatSinh<?",Long.class,from,to);
    }
    public BigDecimal pendingBankTransfers(){
        return jdbc.queryForObject("SELECT COALESCE(SUM(CASE WHEN trangThai=N'Dự kiến' THEN tienDatCocDaTra ELSE soDuConLai END),0) FROM dbo.vwHoaDonChiTiet WHERE phuongThucThanhToan=N'Chuyển khoản ngân hàng' AND (trangThai=N'Dự kiến' OR soDuConLai>0)",BigDecimal.class);
    }
    public BigDecimal netCashByActorBetween(String actor,LocalDateTime from,LocalDateTime to){
        return jdbc.queryForObject("SELECT dbo.fnTienMatRongTheoCa(?,?,?)",BigDecimal.class,actor,from,to);
    }
    public List<Total> summarize(LocalDateTime from,LocalDateTime to){
        return jdbc.query("SELECT phuongThuc,loai,COALESCE(SUM(soTien),0) FROM dbo.vwGiaoDichDoiSoat WHERE thoiDiemPhatSinh>=? AND thoiDiemPhatSinh<? GROUP BY phuongThuc,loai",(rs,n)->new Total(new VietnameseEnumConverters.PaymentMethodConverter().convertToEntityAttribute(rs.getString(1)),new VietnameseEnumConverters.TransactionTypeConverter().convertToEntityAttribute(rs.getString(2)),rs.getBigDecimal(3)),from,to);
    }
}

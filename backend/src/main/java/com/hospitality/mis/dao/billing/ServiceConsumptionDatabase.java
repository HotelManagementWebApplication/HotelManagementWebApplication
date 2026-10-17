package com.hospitality.mis.dao.billing;
import com.hospitality.mis.dto.billing.ServiceConsumptionDto;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;
@Repository
public class ServiceConsumptionDatabase {
    private final JdbcTemplate jdbc;
    public ServiceConsumptionDatabase(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public List<ServiceConsumptionDto> list(LocalDate from,LocalDate to) {
        return jdbc.query("SELECT * FROM dbo.vwTieuThuDichVu WHERE thoiDiem>=? AND thoiDiem<? ORDER BY thoiDiem,maLuot",
            (r,n)->new ServiceConsumptionDto(r.getString("maLuot"),r.getString("maDichVu"),r.getTimestamp("thoiDiem").toLocalDateTime(),
                r.getInt("soLuong"),r.getInt("soLuongMienPhi"),r.getBigDecimal("donGia"),r.getBigDecimal("thanhTien")),from.atStartOfDay(),to.plusDays(1).atStartOfDay());
    }
}

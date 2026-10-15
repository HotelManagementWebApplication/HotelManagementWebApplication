package com.hospitality.mis.dao.billing;
import com.hospitality.mis.dto.billing.ServiceAvailabilityDtos;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;
@Repository
public class ServiceAvailabilityDatabase {
    private final JdbcTemplate jdbc;
    public ServiceAvailabilityDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public List<ServiceAvailabilityDtos.Response> list(LocalDateTime from,LocalDateTime to){
        return jdbc.query("SELECT * FROM dbo.fnKhaDungDichVu(?,?) ORDER BY maDichVu",(r,n)->new ServiceAvailabilityDtos.Response(
            r.getString("maDichVu"),r.getString("donViKhaDung"),r.getInt("congSuat"),r.getLong("daDat"),r.getLong("conLai"),
            switch(r.getString("cachTinh")){case "Theo thời lượng"->"DURATION";case "Theo kỳ lưu trú"->"STAY";case "Theo tồn kho"->"STOCK";case "Theo ngày"->"DAILY";case "Qua đêm"->"OVERNIGHT";default->"UNITS";}),from,to);
    }
}

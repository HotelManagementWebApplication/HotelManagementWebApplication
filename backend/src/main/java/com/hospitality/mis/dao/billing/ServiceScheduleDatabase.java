package com.hospitality.mis.dao.billing;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.billing.ServiceScheduleDtos;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.dao.DataAccessException;
import java.sql.SQLException;

@Repository
public class ServiceScheduleDatabase {
    private final JdbcTemplate jdbc;
    public ServiceScheduleDatabase(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public ServiceScheduleDtos.Response get(String id) {
        var rows=jdbc.query("SELECT * FROM dbo.vwCauHinhLichDichVu WHERE maDichVu=?",(r,n)->
            new ServiceScheduleDtos.Response(r.getString("maDichVu"),r.getObject("congSuat",Integer.class),
                r.getString("donViKhaDung"),r.getObject("soPhutMoiLuot",Integer.class),r.getString("cachTinh"),r.getBoolean("truTon")),id);
        if(rows.isEmpty()) throw new DomainException("SERVICE_NOT_FOUND","Không tìm thấy dịch vụ");
        return rows.getFirst();
    }
    public ServiceScheduleDtos.Response save(String id,ServiceScheduleDtos.Request request,String mode,String actor) {
        try {
            jdbc.update("EXEC dbo.uspCauHinhLichDichVu ?,?,?,?,?,?,?,?",id,request.capacity(),request.unit().trim(),
                request.minutesPerUnit(),mode,request.consumesStock(),actor,request.reason().trim());
            return get(id);
        } catch(DataAccessException error) {
            for(Throwable cause=error;cause!=null;cause=cause.getCause()) if(cause instanceof SQLException sql) {
                if(sql.getErrorCode()==53801) throw new DomainException("SERVICE_SCHEDULE_IN_USE","Còn lượt đặt đang giữ chỗ. Hãy xử lý các lượt đặt trước khi đổi cấu hình.");
                if(sql.getErrorCode()==53802) throw new DomainException("SERVICE_NOT_FOUND","Không tìm thấy dịch vụ");
            }
            throw error;
        }
    }
}

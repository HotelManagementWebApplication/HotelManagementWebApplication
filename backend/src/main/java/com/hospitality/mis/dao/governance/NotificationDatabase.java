package com.hospitality.mis.dao.governance;

import com.hospitality.mis.dto.governance.NotificationDtos;
import com.hospitality.mis.persistence.VietnameseCodeConverters.EmployeeRoleCodeConverter;
import com.hospitality.mis.persistence.VietnameseEnumConverters.NotificationStatusConverter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.dao.DataAccessException;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public class NotificationDatabase {
    private static final String COLUMNS="maThongBao,chuDe,vaiTroNguoiNhan,noiDung,trangThai,khoaChongLap,thoiDiemCoTheGui,thoiDiemTao,thoiDiemGui";
    private final JdbcTemplate jdbc;
    private final EmployeeRoleCodeConverter roles=new EmployeeRoleCodeConverter();
    private final NotificationStatusConverter statuses=new NotificationStatusConverter();
    private final RowMapper<NotificationDtos.Response> rows=(r,n)->new NotificationDtos.Response(r.getLong(1),r.getString(2),roles.convertToEntityAttribute(r.getString(3)),r.getString(4),statuses.convertToEntityAttribute(r.getString(5)).name(),r.getString(6),r.getTimestamp(7).toLocalDateTime(),r.getTimestamp(8).toLocalDateTime(),r.getTimestamp(9)==null?null:r.getTimestamp(9).toLocalDateTime());
    public NotificationDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public NotificationDtos.Response enqueue(String topic,String role,String payload,String key,LocalDateTime now){return command("DECLARE @id BIGINT;EXEC dbo.uspThemThongBao ?,?,?,?,?,@id OUTPUT;SELECT "+COLUMNS+" FROM dbo.vwThongBao WHERE maThongBao=@id",topic,roles.convertToDatabaseColumn(role),payload,key,now);}
    public List<NotificationDtos.Response> poll(LocalDateTime now){return jdbc.query("SELECT TOP(100) "+COLUMNS+" FROM dbo.vwThongBao WHERE trangThai=N'Chờ gửi' AND thoiDiemCoTheGui<=? ORDER BY maThongBao",rows,now);}
    public NotificationDtos.Response deliver(Long id,LocalDateTime now){return command("EXEC dbo.uspDanhDauThongBaoDaGui ?,?",id,now);}
    private NotificationDtos.Response command(String sql,Object...args){
        try{return jdbc.queryForObject(sql,rows,args);}
        catch(DataAccessException error){
            for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException failure){
                if(failure.getErrorCode()==52001)throw new java.util.NoSuchElementException("Không tìm thấy thông báo");
                if(failure.getErrorCode()==2628||failure.getErrorCode()==8152)throw new org.springframework.dao.DataIntegrityViolationException("Dữ liệu vượt độ dài cột",error);
            }throw error;
        }
    }
}

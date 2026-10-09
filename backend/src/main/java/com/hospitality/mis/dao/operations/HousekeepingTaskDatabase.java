package com.hospitality.mis.dao.operations;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.operations.HousekeepingDtos;
import com.hospitality.mis.entity.operations.HousekeepingTaskStatus;
import com.hospitality.mis.persistence.VietnameseEnumConverters.HousekeepingTaskStatusConverter;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.HashMap;

@Repository
public class HousekeepingTaskDatabase {
    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate named;
    private final ObjectMapper mapper;
    private final HousekeepingTaskStatusConverter statuses=new HousekeepingTaskStatusConverter();
    public HousekeepingTaskDatabase(JdbcTemplate jdbc,ObjectMapper mapper){this.jdbc=jdbc;this.named=new NamedParameterJdbcTemplate(jdbc);this.mapper=mapper;}
    public HousekeepingDtos.Response create(HousekeepingDtos.CreateRequest request,String actor,String key,String hash,LocalDateTime now){
        return command("EXEC dbo.uspTaoNhiemVuBuongPhong ?,?,?,?,?,?,?,?",request.roomId(),request.assignee().trim(),request.note(),actor,key,hash,bucket("housekeeping-task-create",key),now);
    }
    public HousekeepingDtos.Response update(Long task,HousekeepingDtos.UpdateRequest request,HousekeepingTaskStatus status,String actor,boolean management,String key,String hash,LocalDateTime now){
        return command("EXEC dbo.uspCapNhatNhiemVuBuongPhong ?,?,?,?,?,?,?,?,?,?",task,statuses.convertToDatabaseColumn(status),request==null?null:request.note(),request==null||request.assignee()==null?null:request.assignee().trim(),actor,management,key,hash,bucket("housekeeping-task-update",key),now);
    }
    public List<HousekeepingDtos.Response> list(String room,String assignee,HousekeepingTaskStatus status){
        StringBuilder sql=new StringBuilder("SELECT maNhiemVuBuongPhong,maPhong,nguoiDuocPhanCong,trangThai,daHoanThanhChecklist,coSuCoChan,ghiChu,nguoiPhanCong,thoiDiemCapNhat FROM dbo.vwCongViecBuongPhong WHERE 1=1");
        var args=new HashMap<String,Object>();
        if(room!=null){sql.append(" AND maPhong COLLATE Latin1_General_100_BIN2=:room");args.put("room",room);}
        if(assignee!=null){sql.append(" AND nguoiDuocPhanCong COLLATE Latin1_General_100_BIN2=:actor");args.put("actor",assignee);}
        if(status!=null){sql.append(" AND trangThai=:status");args.put("status",statuses.convertToDatabaseColumn(status));}
        sql.append(" ORDER BY thoiDiemCapNhat DESC,maNhiemVuBuongPhong");
        return named.query(sql.toString(),args,(r,n)->new HousekeepingDtos.Response(r.getLong(1),r.getString(2),r.getString(3),statuses.convertToEntityAttribute(r.getString(4)).name(),r.getBoolean(5),r.getBoolean(6),r.getString(7),r.getString(8),r.getTimestamp(9).toLocalDateTime()));
    }
    private short bucket(String scope,String key){return (short)Math.floorMod((scope+"\u0000"+key).hashCode(),64);}
    private HousekeepingDtos.Response command(String sql,Object...args){
        try{return mapper.readValue(jdbc.queryForObject(sql,String.class,args),HousekeepingDtos.Response.class);}
        catch(JsonProcessingException error){throw new IllegalStateException("Không thể đọc kết quả housekeeping",error);}
        catch(DataAccessException error){
            for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException failure){
                if(failure.getErrorCode()==2628||failure.getErrorCode()==8152)throw new org.springframework.dao.DataIntegrityViolationException("Dữ liệu vượt độ dài cột",error);
                String code=switch(failure.getErrorCode()){case 51601->"ROOM_NOT_FOUND";case 51702->"ROOM_OCCUPIED";case 51801->"HOUSEKEEPING_TASK_NOT_FOUND";case 51802->"HOUSEKEEPING_TASK_SCOPE_FORBIDDEN";case 51806->"ROOM_MAINTENANCE_LOCKED";case 51807->"INVALID_HOUSEKEEPING_STATUS";case 51808->"INVALID_HOUSEKEEPING_TRANSITION";case 51809->"HOUSEKEEPING_ASSIGNMENT_FORBIDDEN";case 51810->"HOUSEKEEPING_ASSIGNEE_REQUIRED";case 51811->"HOUSEKEEPING_CHECKLIST_REQUIRED";case 51812->"HOUSEKEEPING_ACCEPTANCE_FORBIDDEN";case 51005->"IDEMPOTENCY_KEY_CONFLICT";case 51503->"IDEMPOTENCY_REQUEST_IN_PROGRESS";default->null;};
                if(code!=null)throw new DomainException(code,failure.getMessage());
            }
            throw error;
        }
    }
}

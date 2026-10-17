package com.hospitality.mis.dao.operations;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.operations.TechnicalWorkOrderDtos;
import com.hospitality.mis.entity.operations.TechnicalWorkOrderStatus;
import com.hospitality.mis.persistence.VietnameseEnumConverters.TechnicalWorkOrderStatusConverter;
import com.hospitality.mis.persistence.VietnameseCodeConverters.PriorityConverter;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import java.sql.SQLException;
import java.sql.ResultSet;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.List;

@Repository
public class TechnicalWorkOrderDatabase {
    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate named;
    private final ObjectMapper mapper;
    private final TechnicalWorkOrderStatusConverter statuses=new TechnicalWorkOrderStatusConverter();
    private final PriorityConverter priorities=new PriorityConverter();
    public TechnicalWorkOrderDatabase(JdbcTemplate jdbc,ObjectMapper mapper){this.jdbc=jdbc;this.named=new NamedParameterJdbcTemplate(jdbc);this.mapper=mapper;}
    public TechnicalWorkOrderDtos.Response execute(String command,Long id,Map<String,Object> payload,String actor,boolean management,boolean technical,String key,String hash,LocalDateTime now){
        short bucket=(short)Math.floorMod(("technical-work-order-"+command+"\u0000"+key).hashCode(),64);
        try{return mapper.readValue(jdbc.queryForObject("EXEC dbo.uspLenhCongViecKyThuat ?,?,?,?,?,?,?,?,?,?",String.class,command,id,mapper.writeValueAsString(payload),actor,management,technical,key,hash,bucket,now),TechnicalWorkOrderDtos.Response.class);}
        catch(JsonProcessingException error){throw new IllegalStateException("Không thể đọc/ghi kết quả technical command",error);}
        catch(DataAccessException error){
            for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException failure){
                if(failure.getErrorCode()==2628||failure.getErrorCode()==8152)throw new org.springframework.dao.DataIntegrityViolationException("Dữ liệu vượt độ dài cột",error);
                String code=switch(failure.getErrorCode()){case 51601->"ROOM_NOT_FOUND";case 51602->"EQUIPMENT_NOT_FOUND";case 51702->"ROOM_OCCUPIED";case 51005->"IDEMPOTENCY_KEY_CONFLICT";case 51503->"IDEMPOTENCY_REQUEST_IN_PROGRESS";case 51902->"INVALID_TECHNICAL_PRIORITY";case 51903->"INVALID_TECHNICAL_STATUS";case 51904->"ROOM_OUT_OF_SERVICE";case 51905->"TECHNICAL_ASSIGNMENT_FORBIDDEN";case 51906->"TECHNICAL_WORK_ORDER_NOT_FOUND";case 51907->"TECHNICAL_WORK_ORDER_SCOPE_FORBIDDEN";case 51908->"TECHNICAL_WORK_ORDER_CLOSED";case 51909->"INVALID_TECHNICAL_TRANSITION";case 51910->"TECHNICAL_ACCEPTANCE_COMMAND_REQUIRED";case 51911->"TECHNICAL_ASSIGNEE_REQUIRED";case 51912->"TECHNICAL_RESULT_REQUIRED";case 51913->"TECHNICAL_ACCEPTANCE_FORBIDDEN";case 51914->"TECHNICAL_SELF_ACCEPTANCE_FORBIDDEN";case 51915->"TECHNICAL_ACCEPTANCE_NOTE_REQUIRED";case 51916->"TECHNICAL_ACCEPTANCE_REQUIRED";case 51917->"TECHNICAL_WORK_ORDER_NOT_READY";case 51918->"ROOM_NOT_AVAILABLE";case 51919->"HOUSEKEEPING_NOT_READY";default->null;};
                if(code!=null)throw new DomainException(code,failure.getMessage());
            }
            throw error;
        }
    }
    public List<TechnicalWorkOrderDtos.Response> list(String room,TechnicalWorkOrderStatus status,String actor){
        StringBuilder sql=new StringBuilder("SELECT maPhieuCongViecKyThuat,maPhong,maThietBiPhong,nguoiDuocPhanCong,doUuTien,thoiHanSla,vatTuSuDung,ghiChuKetQua,ghiChuNghiemThu,nguoiNghiemThu,thoiDiemNghiemThu,trangThai,nguoiTao,thoiDiemTao,thoiDiemCapNhat FROM dbo.vwCongViecKyThuat WHERE 1=1");
        var args=new HashMap<String,Object>();
        if(room!=null){sql.append(" AND maPhong=:room");args.put("room",room);}
        if(status!=null){sql.append(" AND trangThai=:status");args.put("status",statuses.convertToDatabaseColumn(status));}
        if(actor!=null){sql.append(" AND nguoiDuocPhanCong COLLATE Latin1_General_100_BIN2=:actor");args.put("actor",actor);}
        // Match the existing repository ordering for room/status queries; stable ID for findAll.
        sql.append(room!=null||status!=null?" ORDER BY thoiDiemCapNhat DESC,maPhieuCongViecKyThuat":" ORDER BY maPhieuCongViecKyThuat");
        return named.query(sql.toString(),args,(r,n)->new TechnicalWorkOrderDtos.Response(r.getLong(1),r.getString(2),r.getObject(3,Long.class),r.getString(4),priorities.convertToEntityAttribute(r.getString(5)),time(r,6),r.getString(7),r.getString(8),r.getString(9),r.getString(10),time(r,11),statuses.convertToEntityAttribute(r.getString(12)).name(),r.getString(13),time(r,14),time(r,15)));
    }
    private LocalDateTime time(ResultSet row,int col)throws SQLException{var value=row.getTimestamp(col);return value==null?null:value.toLocalDateTime();}
}

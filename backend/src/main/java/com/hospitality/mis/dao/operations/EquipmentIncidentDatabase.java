package com.hospitality.mis.dao.operations;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.operations.EquipmentIncidentDtos;
import com.hospitality.mis.dto.room.RoomEquipmentDtos;
import com.hospitality.mis.entity.operations.IncidentHandoffStatus;
import com.hospitality.mis.entity.operations.IncidentSeverity;
import com.hospitality.mis.persistence.VietnameseEnumConverters.IncidentHandoffStatusConverter;
import com.hospitality.mis.persistence.VietnameseEnumConverters.IncidentSeverityConverter;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Arrays;

/** Bound commands and explicit incident/registry snapshots; no entity persistence. */
@Repository
public class EquipmentIncidentDatabase {
    public record Preparation(EquipmentIncidentDtos.Response replay,List<RoomEquipmentDtos.Response> equipment) {}
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final IncidentSeverityConverter severities=new IncidentSeverityConverter();
    private final IncidentHandoffStatusConverter statuses=new IncidentHandoffStatusConverter();
    public EquipmentIncidentDatabase(JdbcTemplate jdbc,ObjectMapper mapper){this.jdbc=jdbc;this.mapper=mapper;}
    public Preparation prepare(String command,Long reservation,String room,Long id,String actor,String key,String hash){
        String json=query("DECLARE @context NVARCHAR(MAX);EXEC dbo.uspKhoaLenhSuCoThietBi ?,?,?,?,?,?,?,?,@context OUTPUT;SELECT @context",command,key,actor,hash,bucket(command,key),reservation,room,id);
        try{
            var context=mapper.readTree(json);
            if(context.hasNonNull("replay"))return new Preparation(mapper.readValue(context.get("replay").asText(),EquipmentIncidentDtos.Response.class),List.of());
            return new Preparation(null,context.has("equipment")?Arrays.asList(mapper.treeToValue(context.get("equipment"),RoomEquipmentDtos.Response[].class)):List.of());
        }catch(JsonProcessingException error){throw new IllegalStateException("Không thể đọc context sự cố",error);}
    }
    public EquipmentIncidentDtos.Response execute(String command,Long id,Long reservation,String room,Long equipment,String name,int quantity,IncidentSeverity severity,String note,IncidentHandoffStatus next,boolean mayResolve,String actor,String key,String hash,LocalDateTime now){
        String json=query("EXEC dbo.uspGhiSuCoThietBi ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?",command,id,reservation,room,equipment,name,name==null?null:name.trim(),quantity,severities.convertToDatabaseColumn(severity),note,statuses.convertToDatabaseColumn(next),mayResolve,actor,key,hash,bucket(command,key),now);
        try{return mapper.readValue(json,EquipmentIncidentDtos.Response.class);}
        catch(JsonProcessingException error){throw new IllegalStateException("Không thể đọc kết quả sự cố",error);}
    }
    public List<EquipmentIncidentDtos.Response> list(String room,Long reservation,IncidentHandoffStatus status){
        return jdbc.query("SELECT maSuCoThietBi,maPhieuDatPhong,maPhong,tenThietBi,tienBoiThuong,mucDoNghiemTrong,trangThaiBanGiao,ghiChuBanGiao FROM dbo.vwSuCoThietBi WHERE (? IS NULL OR maPhong=?) AND (? IS NULL OR maPhieuDatPhong=?) AND (? IS NULL OR trangThaiBanGiao=?) ORDER BY maSuCoThietBi",
                (r,n)->new EquipmentIncidentDtos.Response(r.getLong(1),r.getObject(2,Long.class),r.getString(3),r.getString(4),r.getBigDecimal(5),severities.convertToEntityAttribute(r.getString(6)),statuses.convertToEntityAttribute(r.getString(7)),r.getString(8)),room,room,reservation,reservation,statuses.convertToDatabaseColumn(status),statuses.convertToDatabaseColumn(status));
    }
    private short bucket(String command,String key){String scope=switch(command){case "reservation"->"equipment-incident";case "room"->"room-incident";case "handoff"->"equipment-incident-handoff";default->throw new IllegalArgumentException(command);};return (short)Math.floorMod((scope+"\u0000"+key).hashCode(),64);}
    private String query(String sql,Object...args){
        try{return jdbc.queryForObject(sql,String.class,args);}
        catch(DataAccessException error){
            for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException failure){
                if(failure.getErrorCode()==2628||failure.getErrorCode()==8152)throw new org.springframework.dao.DataIntegrityViolationException("Dữ liệu vượt độ dài cột",error);
                String code=switch(failure.getErrorCode()){case 51005->"IDEMPOTENCY_KEY_CONFLICT";case 51503->"IDEMPOTENCY_REQUEST_IN_PROGRESS";case 51601->"ROOM_NOT_FOUND";case 51602->"EQUIPMENT_NOT_FOUND";case 52101->"RESERVATION_NOT_FOUND";case 52102->"INVALID_STATE";case 52103->"INCIDENT_NOT_FOUND";case 52104->"ROOM_NOT_IN_RESERVATION";case 52106->"INVALID_EQUIPMENT_QUANTITY";case 52107->"INVALID_EQUIPMENT_DATE";case 52109->"INCIDENT_HANDOFF_FORBIDDEN";case 52110->"INVALID_INCIDENT_HANDOFF";default->null;};
                if(code!=null)throw new DomainException(code,failure.getMessage());
            }throw error;
        }
    }
}

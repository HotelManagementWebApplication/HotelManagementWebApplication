package com.hospitality.mis.dao.room;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.room.RoomEquipmentDtos;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;

/** Bound SQL object calls and explicit immutable DTO projections. */
@Repository
public class RoomEquipmentDatabase {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    public RoomEquipmentDatabase(JdbcTemplate jdbc,ObjectMapper mapper){this.jdbc=jdbc;this.mapper=mapper;}
    public List<RoomEquipmentDtos.Response> list(String room){
        return jdbc.query("SELECT maThietBiPhong,maPhong,ten,giaTriBanDau,ngayMua,soLuong,dangHoatDong FROM dbo.vwThietBiPhong WHERE maPhong=? AND dangHoatDong=1 ORDER BY ten,maThietBiPhong",
                (r,n)->new RoomEquipmentDtos.Response(r.getLong(1),r.getString(2),r.getString(3),r.getBigDecimal(4),r.getDate(5).toLocalDate(),r.getInt(6),r.getBoolean(7)),room);
    }
    public RoomEquipmentDtos.Response add(RoomEquipmentDtos.CreateRequest request,String actor,String key,String hash,LocalDateTime now){
        short bucket=(short)Math.floorMod(("room-equipment\u0000"+key).hashCode(),64);
        return command("EXEC dbo.uspThemThietBiPhong ?,?,?,?,?,?,?,?,?,?",request.roomId(),request.name(),request.originalValue(),request.purchasedOn(),request.quantity(),actor,key,hash,bucket,now);
    }
    public RoomEquipmentDtos.Response update(String room,long id,RoomEquipmentDtos.UpdateRequest request,String actor){
        return command("EXEC dbo.uspSuaThietBiPhong ?,?,?,?,?,?,?,?",room,id,request.name().trim(),request.originalValue(),request.purchasedOn(),request.quantity(),request.active(),actor);
    }
    private RoomEquipmentDtos.Response command(String sql,Object... args){
        try{return mapper.readValue(jdbc.queryForObject(sql,String.class,args),RoomEquipmentDtos.Response.class);}
        catch(JsonProcessingException error){throw new IllegalStateException("Không thể đọc kết quả thiết bị",error);}
        catch(DataAccessException error){
            for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException failure){
                String code=switch(failure.getErrorCode()){case 51601->"ROOM_NOT_FOUND";case 51602->"EQUIPMENT_NOT_FOUND";case 51005->"IDEMPOTENCY_KEY_CONFLICT";case 51503->"IDEMPOTENCY_REQUEST_IN_PROGRESS";default->null;};
                if(code!=null)throw new DomainException(code,failure.getMessage());
            }
            throw error;
        }
    }
}

package com.hospitality.mis.dao.room;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.room.*;
import com.hospitality.mis.entity.room.RoomStatus;
import org.springframework.jdbc.core.*;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Repository;
import java.sql.SQLException;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.math.BigDecimal;
import java.util.*;

@Repository
public class RoomDatabase {
    public record Snapshot(String id,String name,String roomTypeId,String roomTypeName,BigDecimal dailyPrice,Integer floor,RoomStatus status,String description,long version){
        public RoomDtos.Response response(){return new RoomDtos.Response(id,name,roomTypeId,roomTypeName,dailyPrice,floor,status);}
        public RoomAdminDtos.Response admin(){return new RoomAdminDtos.Response(id,name,roomTypeId,roomTypeName,floor,description,status);}
    }
    private static final String COLUMNS="maPhong,ten,maLoaiPhong,tenLoaiPhong,giaTheoNgay,tang,trangThai,moTa,phienBan";
    private final JdbcTemplate jdbc;
    private final RoomStatusConverter statuses=new RoomStatusConverter();
    private final RowMapper<Snapshot> rows=(r,n)->new Snapshot(r.getString(1),r.getString(2),r.getString(3),r.getString(4),r.getBigDecimal(5),r.getObject(6,Integer.class),statuses.convertToEntityAttribute(r.getString(7)),r.getString(8),r.getLong(9));
    public RoomDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public List<Snapshot> search(String type,RoomStatus status){String code=statuses.convertToDatabaseColumn(status);return jdbc.query("SELECT "+COLUMNS+" FROM dbo.vwPhongNoiBo WHERE (? IS NULL OR maLoaiPhong=?) AND (? IS NULL OR trangThai=?) ORDER BY maPhong",rows,type,type,code,code);}
    public Optional<Snapshot> find(String id){return jdbc.query("SELECT "+COLUMNS+" FROM dbo.vwPhongNoiBo WHERE maPhong=?",rows,id).stream().findFirst();}
    public Optional<Snapshot> lock(String id){return jdbc.query("EXEC dbo.uspKhoaPhongNoiBo ?",rows,id).stream().findFirst();}
    public void catalogLock(){jdbc.update("EXEC dbo.uspKhoaDanhMucPhong");}
    public boolean overlap(String id,LocalDateTime from,LocalDateTime to,LocalDateTime now){
        LocalDateTime sqlFrom=from.truncatedTo(ChronoUnit.MICROS),sqlTo=to.truncatedTo(ChronoUnit.MICROS);if(!sqlTo.isAfter(sqlFrom))sqlTo=sqlFrom.plusNanos(1000);
        return !Boolean.TRUE.equals(jdbc.queryForObject("SELECT dbo.fnKiemTraPhongTrong(?,?,?,?,NULL)",Boolean.class,id,sqlFrom,sqlTo,now));
    }
    public Snapshot status(Snapshot old,RoomStatus next,boolean technical,boolean management,LocalDateTime now){
        try{jdbc.update("EXEC dbo.uspChuyenTrangThaiPhong ?,?,?,?,?,?",old.id(),statuses.convertToDatabaseColumn(next),old.version(),technical,management,now);}
        catch(DataAccessException error){throw translate(error);}return find(old.id()).orElseThrow();
    }
    public Snapshot admin(String command,String id,RoomAdminDtos.Request request,Long version){
        try{jdbc.update("EXEC dbo.uspLenhQuanTriPhong ?,?,?,?,?,?,?,?",command,id,request.name(),request.roomTypeId(),request.floor(),request.description(),statuses.convertToDatabaseColumn(request.status()),version);}
        catch(DataAccessException error){throw translate(error);}return find(id).orElseThrow();
    }
    private RuntimeException translate(DataAccessException error){
        for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException sql){String code=switch(sql.getErrorCode()){case 52801->"ROOM_NOT_FOUND";case 52802->"INVALID_ROOM_STATUS";case 52803->"INVALID_INITIAL_ROOM_STATUS";case 52804->"ROOM_STATUS_FORBIDDEN";case 52805->"ROOM_RELEASE_COMMAND_REQUIRED";case 52806->"INVALID_ROOM_TRANSITION";case 52807->"ROOM_NOT_AVAILABLE";case 52808->"ROOM_EXISTS";case 52809->"ROOM_TYPE_NOT_ACTIVE";case 51003->"VERSION_CONFLICT";default->null;};if(code!=null)return new DomainException(code,sql.getMessage());}return error;
    }
}

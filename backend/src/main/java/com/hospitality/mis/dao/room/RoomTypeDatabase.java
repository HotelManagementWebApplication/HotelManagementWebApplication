package com.hospitality.mis.dao.room;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.room.RoomTypeAdminDtos;
import com.hospitality.mis.persistence.VietnameseEnumConverters.RoomTypeCatalogStatusConverter;
import org.springframework.jdbc.core.*;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Repository;
import java.sql.*;
import java.time.LocalDateTime;
import java.math.*;
import java.util.*;

@Repository
public class RoomTypeDatabase {
    private static final String COLUMNS="maLoaiPhong,ten,giaTheoNgay,moTa,dienTich,huongNhin,giaTheoGio,loaiGiuong,trangThaiDanhMuc,nguoiCapNhatDanhMuc,nguoiDuyetDanhMuc,thoiDiemCapNhatDanhMuc,thoiDiemDuyetDanhMuc,maLoaiPhongGoc,maLoaiPhongThayThe";
    private final JdbcTemplate jdbc;
    private final RoomTypeCatalogStatusConverter statuses=new RoomTypeCatalogStatusConverter();
    private final RowMapper<RoomTypeAdminDtos.Response> rows=(r,n)->new RoomTypeAdminDtos.Response(r.getString(1),r.getString(2),r.getBigDecimal(3),r.getString(4),r.getBigDecimal(5),r.getString(6),r.getBigDecimal(7),r.getString(8),statuses.convertToEntityAttribute(r.getString(9)),r.getString(10),r.getString(11),date(r,12),date(r,13),r.getString(14),r.getString(15));
    public RoomTypeDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}
    private static LocalDateTime date(ResultSet r,int column)throws SQLException{var value=r.getTimestamp(column);return value==null?null:value.toLocalDateTime();}
    public void catalogLock(){jdbc.update("EXEC dbo.uspKhoaDanhMucPhong");}
    public Optional<RoomTypeAdminDtos.Response> find(String id){return jdbc.query("SELECT "+COLUMNS+" FROM dbo.vwLoaiPhongNoiBo WHERE maLoaiPhong=?",rows,id).stream().findFirst();}
    public RoomTypeAdminDtos.Response locked(String id){catalogLock();return required(id);}
    public RoomTypeAdminDtos.Response required(String id){return find(id).orElseThrow(()->new DomainException("ROOM_TYPE_NOT_FOUND","Không tìm thấy loại phòng"));}
    public RoomTypeAdminDtos.Response save(String command,String id,RoomTypeAdminDtos.Request request,String actor,LocalDateTime now,String source,Long approval,String approver){
        BigDecimal hourly=request==null?null:request.hourlyPrice()==null||request.hourlyPrice().signum()==0?request.dailyPrice().divide(BigDecimal.valueOf(24),2,RoundingMode.HALF_UP):request.hourlyPrice();
        try{jdbc.update("EXEC dbo.uspLenhLoaiPhong ?,?,?,?,?,?,?,?,?,?,?,?,?,?",command,id,request==null?null:request.name().trim(),request==null?null:request.dailyPrice(),request==null||request.description()==null?null:request.description().trim(),request==null?null:request.area(),request==null?null:trim(request.view()),hourly,request==null?null:trim(request.bedType()),actor,now,source,approval,approver);}
        catch(DataAccessException error){for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException sql){String code=switch(sql.getErrorCode()){case 52901->"ROOM_TYPE_EXISTS";case 52902->"ROOM_TYPE_NOT_FOUND";case 52903->"ROOM_TYPE_ACTIVE_IMMUTABLE";case 52904->"ROOM_TYPE_REVISION_SOURCE_INVALID";case 52205->"APPROVAL_REQUIRED";default->null;};if(code!=null)throw new DomainException(code,sql.getMessage());}throw error;}return required(id);
    }
    private static String trim(String value){return value==null||value.isBlank()?null:value.trim();}
    public List<RoomTypeAdminDtos.PriceHistoryResponse> history(String id){required(id);return jdbc.query("SELECT maLichSuGiaLoaiPhong,maLoaiPhong,giaTheoNgay,nguoiThayDoi,maYeuCauPheDuyet,thoiDiemHieuLuc FROM dbo.vwLichSuGiaLoaiPhong WHERE maLoaiPhong=? ORDER BY thoiDiemHieuLuc DESC,maLichSuGiaLoaiPhong DESC",(r,n)->new RoomTypeAdminDtos.PriceHistoryResponse(r.getLong(1),r.getString(2),r.getBigDecimal(3),r.getString(4),r.getObject(5,Long.class),date(r,6)),id);}
}

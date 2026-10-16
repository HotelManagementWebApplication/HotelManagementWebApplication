package com.hospitality.mis.dao.operations;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.operations.InventoryMovementDtos;
import com.hospitality.mis.dto.operations.InventoryMovementDtos.StockReturnDtos;
import com.hospitality.mis.persistence.VietnameseEnumConverters.InventoryMovementTypeConverter;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ServiceInventoryDatabase {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final InventoryMovementTypeConverter types = new InventoryMovementTypeConverter();
    public ServiceInventoryDatabase(JdbcTemplate jdbc,ObjectMapper mapper){this.jdbc=jdbc;this.mapper=mapper;}
    public void requireService(String id){
        if(jdbc.queryForObject("SELECT COUNT(*) FROM dbo.vwTonKhoDichVu WHERE maDichVu=?",Integer.class,id)==0)
            throw new DomainException("SERVICE_NOT_FOUND","Không tìm thấy dịch vụ");
    }
    public InventoryMovementDtos.Response record(InventoryMovementDtos.CreateRequest request,String actor,String key,String hash,LocalDateTime now){
        short bucket=(short)Math.floorMod(("inventory-movement\u0000"+key).hashCode(),64);
        try {
            String json=jdbc.queryForObject("EXEC dbo.uspGhiBienDongKhoDichVu ?,?,?,?,?,?,?,?,?",String.class,request.serviceId(),types.convertToDatabaseColumn(request.type()),request.quantity(),actor,request.reason(),key,hash,bucket,now);
            return mapper.readValue(json,InventoryMovementDtos.Response.class);
        } catch(JsonProcessingException error){throw new IllegalStateException("Không thể đọc kết quả inventory",error);}
        catch(DataAccessException error){
            for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException sql){
                String code=switch(sql.getErrorCode()){case 51501->"SERVICE_NOT_FOUND";case 51505->"INVENTORY_NOT_MANAGED";case 51006->"INSUFFICIENT_STOCK";case 51005->"IDEMPOTENCY_KEY_CONFLICT";case 51503->"IDEMPOTENCY_REQUEST_IN_PROGRESS";case 51504->"INVALID_INVENTORY_QUANTITY";default->null;};
                if(code!=null)throw new DomainException(code,sql.getMessage());
            }
            throw error;
        }
    }
    public List<InventoryMovementDtos.Response> list(String id){
        return jdbc.query("""
            WITH movements AS (
                SELECT *,CAST(CASE WHEN loai IN(N'Xuất kho',N'Hao hụt') THEN -soLuong ELSE soLuong END AS BIGINT) AS signedQuantity
                FROM dbo.vwBienDongKhoDichVu WHERE maDichVu=?
            ), running AS (
                SELECT *,SUM(signedQuantity) OVER(ORDER BY thoiDiemPhatSinh DESC,maBienDongKhoDichVu DESC ROWS UNBOUNDED PRECEDING) AS netToHere
                FROM movements
            )
            SELECT m.maBienDongKhoDichVu,m.maDichVu,m.loai,m.soLuong,m.maNguoiThucHien,m.thoiDiemPhatSinh,m.lyDo,n.hoVaTen,
                CAST(s.soLuongTonKho AS BIGINT)-m.netToHere AS stockBefore,
                CAST(s.soLuongTonKho AS BIGINT)-m.netToHere+m.signedQuantity AS stockAfter
            FROM running m JOIN dbo.vwTonKhoDichVu s ON s.maDichVu=m.maDichVu
            LEFT JOIN dbo.vwNhanVien n ON n.maNhanVien=m.maNguoiThucHien
            ORDER BY m.thoiDiemPhatSinh DESC,m.maBienDongKhoDichVu DESC
            """,(r,n)->new InventoryMovementDtos.Response(r.getLong(1),r.getString(2),types.convertToEntityAttribute(r.getString(3)),r.getInt(4),r.getString(5),r.getTimestamp(6).toLocalDateTime(),r.getString(7),r.getString(8),r.getLong(9),r.getLong(10)),id);
    }
    public int[] totals(String id,LocalDateTime from,LocalDateTime to){
        return jdbc.queryForObject("""
            SELECT COALESCE(SUM(CASE WHEN loai=N'Nhập kho' THEN soLuong ELSE 0 END),0),
            COALESCE(SUM(CASE WHEN loai=N'Xuất kho' THEN soLuong ELSE 0 END),0),
            COALESCE(SUM(CASE WHEN loai=N'Hao hụt' THEN soLuong ELSE 0 END),0),
            COALESCE(SUM(CASE WHEN loai=N'Hoàn kho' THEN soLuong ELSE 0 END),0),
            COALESCE(SUM(CASE WHEN loai=N'Điều chỉnh' THEN soLuong ELSE 0 END),0)
            FROM dbo.vwBienDongKhoDichVu WHERE maDichVu=? AND thoiDiemPhatSinh>=? AND thoiDiemPhatSinh<?
            """,(r,n)->new int[]{r.getInt(1),r.getInt(2),r.getInt(3),r.getInt(4),r.getInt(5)},id,from,to);
    }


    // StockReturnDatabase
    @Repository
    public static class StockReturnDatabase {
        private final JdbcTemplate jdbc;
        private final RowMapper<StockReturnDtos.Response> rows=(r,n)->new StockReturnDtos.Response(
            r.getLong("maYeuCauTraKho"),r.getString("maDichVu"),r.getString("ten"),r.getString("donViTinh"),r.getInt("soLuong"),
            r.getString("maPhong"),r.getString("nguoiGui"),r.getString("lyDo"),
            switch(r.getString("trangThai")){case "Chờ duyệt"->"PENDING";case "Đã duyệt"->"APPROVED";case "Từ chối"->"REJECTED";default->throw new IllegalStateException("Trạng thái trả kho không hợp lệ");},
            r.getString("nguoiDuyet"),r.getString("ghiChuDuyet"),r.getTimestamp("ngayGui").toLocalDateTime(),
            r.getTimestamp("ngayDuyet")==null?null:r.getTimestamp("ngayDuyet").toLocalDateTime());
        public StockReturnDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}
        public List<StockReturnDtos.Response> list(String requester){
            return requester==null?jdbc.query("SELECT * FROM dbo.vwYeuCauTraKho ORDER BY ngayGui DESC,maYeuCauTraKho DESC",rows)
                :jdbc.query("SELECT * FROM dbo.vwYeuCauTraKho WHERE nguoiGui=? ORDER BY ngayGui DESC,maYeuCauTraKho DESC",rows,requester);
        }
        public StockReturnDtos.Response command(String command,Long id,String serviceId,Integer quantity,String room,String actor,String reason,String key,LocalDateTime now){
            try{return jdbc.queryForObject("EXEC dbo.uspLenhTraKho ?,?,?,?,?,?,?,?,?",rows,command,id,serviceId,quantity,room,actor,reason,key,now);}
            catch(DataAccessException error){
                for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException sql){
                    String code=switch(sql.getErrorCode()){
                        case 53701->"INVALID_RETURN_ITEM";case 53702->"IDEMPOTENCY_KEY_CONFLICT";case 53703->"STOCK_RETURN_NOT_FOUND";
                        case 53704->"STOCK_RETURN_ALREADY_DECIDED";case 53705->"STOCK_RETURN_FORBIDDEN";case 53706->"INVALID_STOCK_RETURN";
                        case 53707->"ROOM_NOT_FOUND";default->null;
                    };
                    if(code!=null)throw new DomainException(code,sql.getMessage());
                }
                throw error;
            }
        }
    }
}

package com.hospitality.mis.dao.operations;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.operations.InventoryMovementDtos;
import com.hospitality.mis.persistence.VietnameseEnumConverters.InventoryMovementTypeConverter;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;

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
                String code=switch(sql.getErrorCode()){case 51501->"SERVICE_NOT_FOUND";case 51006->"INSUFFICIENT_STOCK";case 51005->"IDEMPOTENCY_KEY_CONFLICT";case 51503->"IDEMPOTENCY_REQUEST_IN_PROGRESS";case 51504->"INVALID_INVENTORY_QUANTITY";default->null;};
                if(code!=null)throw new DomainException(code,sql.getMessage());
            }
            throw error;
        }
    }
    public List<InventoryMovementDtos.Response> list(String id){
        return jdbc.query("SELECT maBienDongKhoDichVu,maDichVu,loai,soLuong,maNguoiThucHien,thoiDiemPhatSinh,lyDo FROM dbo.vwBienDongKhoDichVu WHERE maDichVu=? ORDER BY thoiDiemPhatSinh DESC,maBienDongKhoDichVu DESC",
            (r,n)->new InventoryMovementDtos.Response(r.getLong(1),r.getString(2),types.convertToEntityAttribute(r.getString(3)),r.getInt(4),r.getString(5),r.getTimestamp(6).toLocalDateTime(),r.getString(7)),id);
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
}

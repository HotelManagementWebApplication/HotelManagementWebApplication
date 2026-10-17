package com.hospitality.mis.dao.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.operations.StockRequestDtos;
import org.springframework.jdbc.core.*;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Repository;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public class StockRequestDatabase {
    private final JdbcTemplate jdbc;
    private final RowMapper<StockRequestDtos.Response> rows=(r,n)->new StockRequestDtos.Response(
        r.getLong("maYeuCauKho"),r.getString("maDichVu"),r.getString("ten"),r.getString("donViTinh"),switch(r.getString("loai")){case "Cấp hàng"->"ISSUE";case "Trả hàng"->"RETURN";case "Báo hỏng"->"DAMAGE";default->throw new IllegalStateException("Loại yêu cầu không hợp lệ");},r.getInt("soLuong"),
        r.getString("maPhong"),r.getString("nguoiGui"),r.getString("lyDo"),
        switch(r.getString("trangThai")){case "Chờ duyệt"->"PENDING";case "Đã duyệt"->"APPROVED";case "Từ chối"->"REJECTED";default->throw new IllegalStateException("Trạng thái trả kho không hợp lệ");},
        r.getString("nguoiDuyet"),r.getString("ghiChuDuyet"),r.getTimestamp("ngayGui").toLocalDateTime(),
        r.getTimestamp("ngayDuyet")==null?null:r.getTimestamp("ngayDuyet").toLocalDateTime());
    public StockRequestDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public List<StockRequestDtos.Response> list(String requester){
        return requester==null?jdbc.query("SELECT * FROM dbo.vwYeuCauKho ORDER BY ngayGui DESC,maYeuCauKho DESC",rows)
            :jdbc.query("SELECT * FROM dbo.vwYeuCauKho WHERE nguoiGui=? ORDER BY ngayGui DESC,maYeuCauKho DESC",rows,requester);
    }
    public StockRequestDtos.Response command(String command,Long id,String serviceId,Integer quantity,String room,String actor,String reason,String key,LocalDateTime now,String kind){
        try{return jdbc.queryForObject("EXEC dbo.uspLenhYeuCauKho ?,?,?,?,?,?,?,?,?,?",rows,command,id,serviceId,quantity,room,actor,reason,key,now,kind);}
        catch(DataAccessException error){
            for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException sql){
                String code=switch(sql.getErrorCode()){
                    case 53701->"INVALID_RETURN_ITEM";case 53702->"IDEMPOTENCY_KEY_CONFLICT";case 53703->"STOCK_REQUEST_NOT_FOUND";
                    case 53704->"STOCK_REQUEST_ALREADY_DECIDED";case 53705->"STOCK_REQUEST_FORBIDDEN";case 53706->"INVALID_STOCK_REQUEST";
                    case 51504->"INVALID_STOCK_REQUEST";case 51006->"INSUFFICIENT_STOCK";case 53707->"ROOM_NOT_FOUND";default->null;
                };
                if(code!=null)throw new DomainException(code,sql.getMessage());
            }
            throw error;
        }
    }
}

package com.hospitality.mis.dao.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.operations.StockReturnDtos;
import org.springframework.jdbc.core.*;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Repository;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public class StockReturnDatabase {
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

package com.hospitality.mis.dao.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.operations.RoomTransferDtos;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.sql.SQLException;
import java.time.LocalDateTime;

@Repository
public class RoomTransferDatabase {
    private final JdbcTemplate jdbc;
    public RoomTransferDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public RoomTransferDtos.Response transfer(long reservation,String from,String to,LocalDateTime at,String reason,String actor,LocalDateTime now){
        try{jdbc.update("EXEC dbo.uspChuyenPhong ?,?,?,?,?,?,?",reservation,from,to,at,reason,actor,now);}
        catch(DataAccessException error){for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException sql){String code=switch(sql.getErrorCode()){case 51001->sql.getMessage().contains("nguồn")?"ROOM_NOT_IN_RESERVATION":"ROOM_NOT_FOUND";case 51002->sql.getMessage().contains("booking")?"INVALID_STATE":"ROOM_NOT_AVAILABLE";case 51004->"OVERBOOKING";case 51008->from.equals(to)?"SAME_ROOM":"INVALID_TRANSFER_TIME";default->null;};if(code!=null)throw new DomainException(code,sql.getMessage());}throw error;}
        return jdbc.queryForObject("SELECT TOP(1) maChuyenPhong,maPhieuDatPhong,maPhongCu,maPhongMoi,thoiDiemChuyenPhong,lyDo FROM dbo.vwChuyenPhong WHERE maPhieuDatPhong=? AND maPhongCu=? AND maPhongMoi=? ORDER BY maChuyenPhong DESC",(r,n)->new RoomTransferDtos.Response(r.getLong(1),r.getLong(2),r.getString(3),r.getString(4),r.getTimestamp(5).toLocalDateTime(),r.getString(6)),reservation,from,to);
    }
}

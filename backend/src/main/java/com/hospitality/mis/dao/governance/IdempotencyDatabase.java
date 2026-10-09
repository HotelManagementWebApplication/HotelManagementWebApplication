package com.hospitality.mis.dao.governance;

import com.hospitality.mis.common.exception.DomainException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Repository;
import java.sql.SQLException;
import java.time.LocalDateTime;

@Repository
public class IdempotencyDatabase {
    public record Claim(boolean fresh,String responseType,String responseJson){}
    private final JdbcTemplate jdbc;
    public IdempotencyDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public Claim claim(String scope,String key,String actor,String hash,LocalDateTime now){
        short bucket=(short)Math.floorMod((scope+'\u0000'+key).hashCode(),64);
        try{return jdbc.queryForObject("EXEC dbo.uspNhanKhoaChongTrung ?,?,?,?,?,?",(r,n)->new Claim(r.getBoolean(1),r.getString(2),r.getString(3)),scope,key,actor,hash,bucket,now);}
        catch(DataAccessException error){throw translate(error);}
    }
    public void complete(String scope,String key,String actor,String hash,String type,String json,LocalDateTime now){
        try{jdbc.update("EXEC dbo.uspHoanThanhChongTrung ?,?,?,?,?,?,?",scope,key,actor,hash,type,json,now);}
        catch(DataAccessException error){throw translate(error);}
    }
    private RuntimeException translate(DataAccessException error){
        for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException sql){
            if(sql.getErrorCode()==51005)return new DomainException("IDEMPOTENCY_KEY_CONFLICT","Idempotency key đã được dùng cho yêu cầu khác hoặc actor khác");
            if(sql.getErrorCode()==51503)return new DomainException("IDEMPOTENCY_REQUEST_IN_PROGRESS","Yêu cầu cùng Idempotency-Key đang được xử lý");
        }
        return error;
    }
}

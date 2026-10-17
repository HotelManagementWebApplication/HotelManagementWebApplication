package com.hospitality.mis.dao.billing;
import com.hospitality.mis.dto.billing.ServiceAvailabilityDtos.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;import java.util.List;
@Repository public class ServiceAvailabilityDatabase {
 private final JdbcTemplate jdbc;
 public ServiceAvailabilityDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}
 public List<Response> list(LocalDateTime from,LocalDateTime to){
  return jdbc.query("SELECT * FROM dbo.fnKhaDungDichVu(?,?)",(r,n)->new Response(r.getString("maDichVu"),r.getString("donViKhaDung"),r.getInt("congSuat"),r.getLong("daDat"),r.getLong("conLai"),r.getInt("thoiLuongPhut"),r.getBoolean("laTaiNguyen"),r.getString("maNguonTaiNguyen")),from,to);
 }
 public void configure(String id,CapacityRequest request,String actor){
  try{jdbc.update("EXEC dbo.uspCauHinhDichVu ?,?,?,?,?",id,request.capacity(),request.minutes(),actor,request.reason());}
  catch(org.springframework.dao.DataAccessException e){
   for(Throwable cause=e;cause!=null;cause=cause.getCause())if(cause instanceof java.sql.SQLException sql){
    if(sql.getErrorCode()==53801)throw new com.hospitality.mis.common.exception.DomainException("SERVICE_CAPACITY_CONFLICT",sql.getMessage());
    if(sql.getErrorCode()==53802)throw new com.hospitality.mis.common.exception.DomainException("INVALID_SERVICE_CONFIGURATION",sql.getMessage());
   }throw e;
  }
 }
}

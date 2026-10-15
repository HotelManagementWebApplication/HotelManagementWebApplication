package com.hospitality.mis.dao.identity;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.identity.PersonnelDtos.*;
import com.hospitality.mis.entity.identity.EmployeeRole;
import com.hospitality.mis.persistence.VietnameseEnumConverters.EmployeeRoleConverter;
import com.hospitality.mis.persistence.VietnameseEnumConverters.EmploymentStatusConverter;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import java.sql.*;
import java.time.*;
import java.util.*;

/** SQL owns personnel writes, optimistic versions and onboarding transitions. */
@Repository
public class PersonnelDatabase {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final EmployeeRoleConverter roles = new EmployeeRoleConverter();
    private final EmploymentStatusConverter employment = new EmploymentStatusConverter();
    public PersonnelDatabase(JdbcTemplate jdbc, ObjectMapper mapper) { this.jdbc=jdbc; this.mapper=mapper; }
    private Instant instant(ResultSet r,String name)throws SQLException { var value=r.getObject(name,OffsetDateTime.class);return value==null?null:value.toInstant(); }
    private final RowMapper<Profile> profiles = (r,n) -> new Profile(r.getString("maNhanVien"),roles.convertToEntityAttribute(r.getString("vaiTro")),employment.convertToEntityAttribute(r.getString("trangThaiLamViec")).name(),r.getBoolean("duocKichHoat"),
        read(r.getString("duLieuHoSo")),r.getLong("phienBan"),instant(r,"thoiDiemCapNhat"),r.getString("nguoiCapNhat"));
    private final RowMapper<Onboarding> requests = (r,n) -> new Onboarding(r.getString("maDeNghi"),read(r.getString("duLieuHoSo")),roles.convertToEntityAttribute(r.getString("vaiTroDeXuat")),r.getString("lyDo"),status(r.getString("trangThai")),r.getString("nguoiDeNghi"),r.getString("nguoiXetDuyet"),r.getString("lyDoQuyetDinh"),r.getString("maNhanVien"),r.getLong("phienBan"),instant(r,"thoiDiemTao"),instant(r,"thoiDiemGui"),instant(r,"thoiDiemQuyetDinh"),false,false);
    public List<Profile> profiles(){ return jdbc.query("SELECT * FROM dbo.vwHoSoNhanSu ORDER BY maNhanVien",profiles); }
    public Optional<Profile> profile(String id){return jdbc.query("SELECT * FROM dbo.vwHoSoNhanSu WHERE maNhanVien=?",profiles,id).stream().findFirst();}
    public Profile update(String id,Details details,long version,String actor,Instant now){
        run(() -> jdbc.update("EXEC dbo.uspCapNhatHoSoNhanSu ?,?,?,?,?,?",id,json(details),version,actor,now.atOffset(ZoneOffset.UTC),false));
        return profile(id).orElseThrow();
    }
    public void initialize(String id,Details details,String actor,Instant now){
        run(() -> jdbc.update("EXEC dbo.uspCapNhatHoSoNhanSu ?,?,?,?,?,?",id,json(details),0,actor,now.atOffset(ZoneOffset.UTC),true));
    }
    public List<Onboarding> requests(){return jdbc.query("SELECT * FROM dbo.vwDeNghiNhanVien ORDER BY thoiDiemTao DESC,maDeNghi",requests);}
    public Optional<Onboarding> request(String id,boolean lock){return jdbc.query(lock?"EXEC dbo.uspKhoaDeNghiNhanVien ?":"SELECT * FROM dbo.vwDeNghiNhanVien WHERE maDeNghi=?",requests,id).stream().findFirst();}
    public Onboarding command(String command,String id,Draft draft,long version,String actor,String reason,String employeeId,Instant now){
        run(() -> jdbc.update("EXEC dbo.uspLenhDeNghiNhanVien ?,?,?,?,?,?,?,?,?,?",command,id,draft==null?null:json(draft.details()),draft==null?null:roles.convertToDatabaseColumn(draft.proposedRole()),reason,version,actor,employeeId,now.atOffset(ZoneOffset.UTC),draft==null?null:draft.reason()));
        return request(id,false).orElseThrow();
    }
    public String json(Object value){try{return mapper.writeValueAsString(value);}catch(JsonProcessingException e){throw new IllegalStateException(e);}}
    private Details read(String json){try{return mapper.readValue(json,Details.class);}catch(JsonProcessingException e){throw new IllegalStateException("Hồ sơ nhân sự không hợp lệ",e);}}
    private Status status(String value){return switch(value){case "Bản nháp"->Status.DRAFT;case "Chờ duyệt"->Status.PENDING;case "Cần bổ sung"->Status.NEEDS_REVISION;case "Bị từ chối"->Status.REJECTED;case "Đã duyệt"->Status.APPROVED;default->throw new IllegalStateException("Trạng thái đề nghị không hợp lệ");};}
    private void run(Runnable work){try{work.run();}catch(DataAccessException error){
        for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException sql){
            String code=switch(sql.getErrorCode()){case 53701->"PERSONNEL_NOT_FOUND";case 53702->"PERSONNEL_VERSION_CONFLICT";case 53703->"INVALID_PERSONNEL_STATE";case 53704->"ACCESS_DENIED";case 53705->"PHONE_ALREADY_IN_USE";case 53706->"IDENTITY_ALREADY_IN_USE";case 53707->"SELF_APPROVAL_FORBIDDEN";case 53708->"INVALID_PERSONNEL_PROFILE";default->null;};
            if(code!=null)throw new DomainException(code,sql.getMessage());
        }throw error;
    }}
}

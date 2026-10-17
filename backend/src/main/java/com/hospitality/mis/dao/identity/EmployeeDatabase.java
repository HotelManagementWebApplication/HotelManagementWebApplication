package com.hospitality.mis.dao.identity;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.auth.EmployeeAdminDtos;
import com.hospitality.mis.entity.identity.Employee;
import com.hospitality.mis.entity.identity.EmployeeRole;
import com.hospitality.mis.persistence.VietnameseEnumConverters.*;
import org.springframework.jdbc.core.*;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Repository;
import java.sql.*;
import java.time.*;
import java.util.*;

/** Immutable employee projections; all writes execute the SQL command owner. */
@Repository
public class EmployeeDatabase {
    public record Snapshot(String employeeId,String fullName,String password,EmployeeRole role,String phone,String address,String email,boolean mustChangePassword,boolean enabled,boolean accountNonLocked,int failedLoginAttempts,Instant lastLoginAt,Instant lastFailedLoginAt,Employee.EmploymentStatus employmentStatus,LocalDate leaveStart,LocalDate leaveEnd){
        public EmployeeAdminDtos.Response response(){return new EmployeeAdminDtos.Response(employeeId,fullName,phone,address,role,enabled,accountNonLocked,failedLoginAttempts,lastLoginAt,lastFailedLoginAt,employmentStatus,leaveStart,leaveEnd,email,mustChangePassword);}
    }
    private static final String COLUMNS="maNhanVien,hoVaTen,matKhau,vaiTro,soDienThoai,diaChi,email,phaiDoiMatKhau,duocKichHoat,taiKhoanKhongBiKhoa,soLanDangNhapThatBai,thoiDiemDangNhapGanNhat,thoiDiemDangNhapThatBaiGanNhat,trangThaiLamViec,ngayBatDauNghi,ngayKetThucNghi";
    private final JdbcTemplate jdbc;
    private final EmployeeRoleConverter roles=new EmployeeRoleConverter();
    private final EmploymentStatusConverter employment=new EmploymentStatusConverter();
    private final LoginOutcomeConverter outcomes=new LoginOutcomeConverter();
    private final RowMapper<Snapshot> rows=(r,n)->new Snapshot(r.getString(1),r.getString(2),r.getString(3),roles.convertToEntityAttribute(r.getString(4)),r.getString(5),r.getString(6),r.getString(7),r.getBoolean(8),r.getBoolean(9),r.getBoolean(10),r.getInt(11),instant(r,12),instant(r,13),employment.convertToEntityAttribute(r.getString(14)),r.getObject(15,LocalDate.class),r.getObject(16,LocalDate.class));
    public EmployeeDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}
    private static Instant instant(ResultSet row,int column)throws SQLException{var value=row.getObject(column,OffsetDateTime.class);return value==null?null:value.toInstant();}
    public Optional<Snapshot> find(String id){return jdbc.query("SELECT "+COLUMNS+" FROM dbo.vwNhanVien WHERE maNhanVien=?",rows,id).stream().findFirst();}
    public Optional<Snapshot> lock(String id){return jdbc.query("EXEC dbo.uspKhoaNhanVien ?",rows,id).stream().findFirst();}
    public List<Snapshot> list(){return jdbc.query("SELECT "+COLUMNS+" FROM dbo.vwNhanVien ORDER BY maNhanVien",rows);}
    public Snapshot create(String id,String name,String password,EmployeeRole role,String phone,String address,String email,boolean temporary,boolean auto){
        String created=command(auto?"auto":"create",id,name,password,role,phone,address,email,temporary,null,null,null,null);return find(created).orElseThrow();
    }
    public Snapshot write(String command,String id,String password,EmployeeRole role,Boolean flag,Employee.EmploymentStatus status,LocalDate start,LocalDate end,Instant now){
        command(command,id,null,password,role,null,null,null,flag,status,start,end,now);return find(id).orElseThrow();
    }
    private String command(String command,String id,String name,String password,EmployeeRole role,String phone,String address,String email,Boolean flag,Employee.EmploymentStatus status,LocalDate start,LocalDate end,Instant now){
        try{return jdbc.queryForObject("DECLARE @id NVARCHAR(MAX)=?;EXEC dbo.uspLenhNhanVien ?,@id OUTPUT,?,?,?,?,?,?,?,?,?,?,?;SELECT @id",String.class,id,command,name,password,roles.convertToDatabaseColumn(role),phone,address,email,flag,employment.convertToDatabaseColumn(status),start,end,now==null?null:now.atOffset(ZoneOffset.UTC));}
        catch(DataAccessException error){for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException sql){String code=switch(sql.getErrorCode()){case 52601->"EMPLOYEE_EXISTS";case 52602->"PHONE_ALREADY_IN_USE";case 52603->"EMPLOYEE_NOT_FOUND";case 52604->"INVALID_LEAVE_PERIOD";default->null;};if(code!=null)throw new DomainException(code,sql.getMessage());}throw error;}
    }
    public EmployeeAdminDtos.LoginHistoryResponse loginHistory(String id,int page,int size){
        Long total=jdbc.queryForObject("SELECT COUNT_BIG(*) FROM dbo.vwSuKienDangNhapNhanVien WHERE maNhanVien=?",Long.class,id);
        var events=jdbc.query("SELECT maSuKienDangNhap,maNhanVien,thoiDiemPhatSinh,ketQua FROM dbo.vwSuKienDangNhapNhanVien WHERE maNhanVien=? ORDER BY thoiDiemPhatSinh DESC,maSuKienDangNhap DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",(r,n)->new EmployeeAdminDtos.LoginEventResponse(r.getLong(1),r.getString(2),instant(r,3),outcomes.convertToEntityAttribute(r.getString(4)).name()),id,(long)page*size,size);
        return new EmployeeAdminDtos.LoginHistoryResponse(events,page,size,total,(int)((total+size-1)/size));
    }
}

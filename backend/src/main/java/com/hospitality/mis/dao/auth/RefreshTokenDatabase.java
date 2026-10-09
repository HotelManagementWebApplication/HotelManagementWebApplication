package com.hospitality.mis.dao.auth;

import com.hospitality.mis.dto.auth.EmployeeAdminDtos;
import com.hospitality.mis.service.auth.AuthFailureException;
import com.hospitality.mis.service.auth.JwtTokenService;
import org.springframework.stereotype.Repository;
import org.springframework.jdbc.core.*;
import org.springframework.dao.DataAccessException;
import java.sql.*;
import java.time.*;
import java.util.*;

@Repository
public class RefreshTokenDatabase {
    public record Token(Long id,String employeeId,Long customerAccountId,String hash,String familyId,Instant issuedAt,Instant expiresAt,Instant revokedAt,String replacementHash){
        public Token{if((employeeId==null)==(customerAccountId==null))throw new IllegalStateException("Refresh token owner is invalid");}
        public JwtTokenService.PrincipalType principalType(){return employeeId==null?JwtTokenService.PrincipalType.CUSTOMER:JwtTokenService.PrincipalType.EMPLOYEE;}
        public String principalId(){return employeeId==null?customerAccountId.toString():employeeId;}
        public String auditActor(){return employeeId==null?"customer:"+customerAccountId:employeeId;}
    }
    private final JdbcTemplate jdbc;
    private final RowMapper<Token> rows=(r,n)->new Token(r.getLong(1),r.getString(2),r.getObject(3,Long.class),r.getString(4),r.getString(5),instant(r,6),instant(r,7),instant(r,8),r.getString(9));
    public RefreshTokenDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}
    private static Instant instant(ResultSet row,int index)throws SQLException{var value=row.getObject(index,OffsetDateTime.class);return value==null?null:value.toInstant();}
    public Optional<Token> lock(String hash){return jdbc.query("EXEC dbo.uspKhoaMaLamMoiDangNhap ?",rows,hash).stream().findFirst();}
    public List<EmployeeAdminDtos.SessionResponse> sessions(String employee){
        return jdbc.query("SELECT maMaLamMoiDangNhap,maNhanVien,thoiDiemPhatHanh,thoiDiemHetHan,thoiDiemThuHoi,maNhomPhien FROM dbo.vwMaLamMoiDangNhap WHERE maNhanVien=? ORDER BY thoiDiemPhatHanh DESC,maMaLamMoiDangNhap DESC",(r,n)->new EmployeeAdminDtos.SessionResponse(r.getLong(1),r.getString(2),instant(r,3),instant(r,4),instant(r,5),r.getString(6)),employee);
    }
    public Optional<Token> find(Long id){return jdbc.query("SELECT maMaLamMoiDangNhap,maNhanVien,maTaiKhoanKhachHang,maBamToken,maNhomPhien,thoiDiemPhatHanh,thoiDiemHetHan,thoiDiemThuHoi,maBamThayThe FROM dbo.vwMaLamMoiDangNhap WHERE maMaLamMoiDangNhap=?",rows,id).stream().findFirst();}
    public List<Token> activeFamily(String family,Instant now){return jdbc.query("SELECT maMaLamMoiDangNhap,maNhanVien,maTaiKhoanKhachHang,maBamToken,maNhomPhien,thoiDiemPhatHanh,thoiDiemHetHan,thoiDiemThuHoi,maBamThayThe FROM dbo.vwMaLamMoiDangNhap WHERE maNhomPhien=? AND thoiDiemThuHoi IS NULL AND thoiDiemHetHan>?",rows,family,offset(now));}
    public void issue(JwtTokenService.PrincipalType type,String principal,JwtTokenService.IssuedTokens issued,String family){command("issue",type==JwtTokenService.PrincipalType.EMPLOYEE?principal:null,type==JwtTokenService.PrincipalType.CUSTOMER?Long.valueOf(principal):null,null,issued.refreshTokenHash(),family,issued.issuedAt(),issued.refreshExpiresAt(),issued.issuedAt());}
    public void rotate(Token current,JwtTokenService.IssuedTokens issued,Instant now){command("rotate",current.employeeId(),current.customerAccountId(),current.id(),issued.refreshTokenHash(),current.familyId(),issued.issuedAt(),issued.refreshExpiresAt(),now);}
    public void revoke(Token current,Instant now){command("revoke",current.employeeId(),current.customerAccountId(),current.id(),null,null,null,null,now);}
    public void revokeFamily(Token current,Instant now){command("family",current.employeeId(),current.customerAccountId(),null,null,current.familyId(),null,null,now);}
    public void revokeEmployee(String employee,Instant now){command("all",employee,null,null,null,null,null,null,now);}
    public void revokeCustomer(Long customer,Instant now){command("all",null,customer,null,null,null,null,null,now);}
    private void command(String command,String employee,Long customer,Long current,String hash,String family,Instant issued,Instant expires,Instant now){
        try{jdbc.update("EXEC dbo.uspLenhMaLamMoiDangNhap ?,?,?,?,?,?,?,?,?",command,employee,customer,current,hash,family,offset(issued),offset(expires),offset(now));}
        catch(DataAccessException error){for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException sql){if(sql.getErrorCode()==52501)throw new AuthFailureException();if(sql.getErrorCode()==52502)throw new AuthFailureException("ACCOUNT_DISABLED");if(sql.getErrorCode()==52503)throw new AuthFailureException("ACCOUNT_LOCKED");}throw error;}
    }
    private static OffsetDateTime offset(Instant value){return value==null?null:value.atOffset(ZoneOffset.UTC);}
}

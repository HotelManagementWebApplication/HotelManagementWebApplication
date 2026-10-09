package com.hospitality.mis.dao.identity;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.identity.EmployeeShiftDtos;
import com.hospitality.mis.entity.identity.EmployeeShift;
import com.hospitality.mis.persistence.VietnameseCodeConverters.ShiftCodeConverter;
import com.hospitality.mis.persistence.VietnameseEnumConverters.EmployeeShiftStatusConverter;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;

@Repository
public class EmployeeShiftDatabase {
    private static final String READ="SELECT maCaLamViecNhanVien,maNhanVien,ngayLamCa,maCa,thoiDiemBatDau,thoiDiemKetThuc,trangThai,nguoiTao FROM dbo.vwLichLamViecNhanVien";
    private final JdbcTemplate jdbc;
    private final ShiftCodeConverter codes=new ShiftCodeConverter();
    private final EmployeeShiftStatusConverter statuses=new EmployeeShiftStatusConverter();
    public EmployeeShiftDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public List<EmployeeShiftDtos.Response> list(LocalDate from,LocalDate to,String employee){
        return jdbc.query(READ+" WHERE ngayLamCa BETWEEN ? AND ? AND (? IS NULL OR maNhanVien=?) ORDER BY ngayLamCa,thoiDiemBatDau",this::row,from,to,employee,employee);
    }
    public EmployeeShiftDtos.Response find(long id){
        return jdbc.query(READ+" WHERE maCaLamViecNhanVien=?",this::row,id).stream().findFirst().orElseThrow(()->new DomainException("SHIFT_NOT_FOUND","Không tìm thấy ca làm việc"));
    }
    public long coverage(LocalDate date,String code){
        return jdbc.queryForObject("SELECT COUNT_BIG(*) FROM dbo.vwLichLamViecNhanVien WHERE ngayLamCa=? AND maCa=? AND trangThai<>N'Đã hủy' AND duocKichHoat=1 AND (trangThaiLamViec=N'Đang làm việc' OR (trangThaiLamViec=N'Đang nghỉ phép' AND (ngayBatDauNghi>? OR ngayKetThucNghi<?)))",Long.class,date,codes.convertToDatabaseColumn(code),date,date);
    }
    public EmployeeShiftDtos.Response assign(EmployeeShiftDtos.Request request,String actor){
        try {
            long id=jdbc.queryForObject("EXEC dbo.uspPhanCongCa ?,?,?,?,?,?",Long.class,request.employeeId(),request.shiftDate(),codes.convertToDatabaseColumn(request.shiftCode()),request.startsAt(),request.endsAt(),actor);
            return find(id);
        }catch(DataAccessException error){throw translate(error);}
    }
    public EmployeeShiftDtos.Response update(long id,EmployeeShiftDtos.UpdateRequest request,String actor){
        try {
            jdbc.update("EXEC dbo.uspSuaCaLamViec ?,?,?,?,?,?",id,request.shiftDate(),codes.convertToDatabaseColumn(request.shiftCode()),request.startsAt(),request.endsAt(),actor);
            return find(id);
        }catch(DataAccessException error){throw translate(error);}
    }
    public EmployeeShiftDtos.Response status(long id,EmployeeShift.Status next,String actor){
        try {
            jdbc.update("EXEC dbo.uspChuyenTrangThaiCa ?,?,?",id,statuses.convertToDatabaseColumn(next),actor);
            return find(id);
        }catch(DataAccessException error){throw translate(error);}
    }
    private EmployeeShiftDtos.Response row(ResultSet rs,int n)throws SQLException {
        return new EmployeeShiftDtos.Response(rs.getLong(1),rs.getString(2),rs.getDate(3).toLocalDate(),codes.convertToEntityAttribute(rs.getString(4)),rs.getTimestamp(5).toLocalDateTime(),rs.getTimestamp(6).toLocalDateTime(),statuses.convertToEntityAttribute(rs.getString(7)).name(),rs.getString(8));
    }
    private RuntimeException translate(DataAccessException error){
        for(Throwable cause=error;cause!=null;cause=cause.getCause()) if(cause instanceof SQLException sql){
            String code=switch(sql.getErrorCode()){
                case 51004 -> "SHIFT_OVERLAP";case 51008 -> "INVALID_SHIFT_INTERVAL";
                case 51301 -> "EMPLOYEE_NOT_FOUND";case 51302 -> "SHIFT_NOT_FOUND";
                case 51303 -> "SHIFT_NOT_EDITABLE";case 51304 -> "INVALID_SHIFT_STATUS";
                case 51305 -> "INVALID_SHIFT_STATUS_TRANSITION";default -> null;
            };
            if(code!=null)return new DomainException(code,sql.getMessage());
        }
        return error;
    }
}

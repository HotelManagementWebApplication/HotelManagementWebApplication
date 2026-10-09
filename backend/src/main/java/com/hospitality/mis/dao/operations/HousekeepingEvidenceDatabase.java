package com.hospitality.mis.dao.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.operations.HousekeepingChecklistDtos;
import com.hospitality.mis.dto.operations.HousekeepingInspectionDtos;
import com.hospitality.mis.persistence.VietnameseEnumConverters.InspectionTypeConverter;
import com.hospitality.mis.persistence.VietnameseEnumConverters.ItemConditionConverter;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;

/** Explicit read projections and atomic checklist/inspection commands. */
@Repository
public class HousekeepingEvidenceDatabase {
    private static final String RESULTS="maKetQuaChecklist,maNhiemVuBuongPhong,hangMuc,datYeuCau,ghiChu,nguoiHoanThanh,thoiDiemHoanThanh";
    private static final String INSPECTIONS="maKiemTraBuongPhong,maNhiemVuBuongPhong,loaiKiemTra,hangMuc,soLuong,tinhTrangHangMuc,ghiChu,nguoiHoanThanh,thoiDiemHoanThanh";
    private final JdbcTemplate jdbc;
    private final InspectionTypeConverter types=new InspectionTypeConverter();
    private final ItemConditionConverter conditions=new ItemConditionConverter();
    private final RowMapper<HousekeepingChecklistDtos.TemplateResponse> templates=(r,n)->new HousekeepingChecklistDtos.TemplateResponse(r.getLong(1),r.getString(2),r.getBoolean(3));
    private final RowMapper<HousekeepingChecklistDtos.ResultResponse> results=(r,n)->new HousekeepingChecklistDtos.ResultResponse(r.getLong(1),r.getLong(2),r.getString(3),r.getBoolean(4),r.getString(5),r.getString(6),r.getTimestamp(7).toLocalDateTime());
    private final RowMapper<HousekeepingInspectionDtos.Response> inspections=(r,n)->new HousekeepingInspectionDtos.Response(r.getLong(1),r.getLong(2),types.convertToEntityAttribute(r.getString(3)),r.getString(4),r.getInt(5),conditions.convertToEntityAttribute(r.getString(6)),r.getString(7),r.getString(8),r.getTimestamp(9).toLocalDateTime());
    public HousekeepingEvidenceDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public void requireAccess(Long task,String actor,boolean management,boolean writing){
        var rows=jdbc.query("SELECT nguoiDuocPhanCong,trangThai FROM dbo.vwPhamViNhiemVuBuongPhong WHERE maNhiemVuBuongPhong=?",(r,n)->new String[]{r.getString(1),r.getString(2)},task);
        if(rows.isEmpty())throw new DomainException("HOUSEKEEPING_TASK_NOT_FOUND","Không tìm thấy task dọn phòng");
        if(!management&&!actor.equals(rows.get(0)[0]))throw new DomainException("HOUSEKEEPING_TASK_SCOPE_FORBIDDEN","Chỉ người được phân công hoặc quản lý mới được truy cập task");
        if(writing&&"Sẵn sàng".equals(rows.get(0)[1]))throw new DomainException("HOUSEKEEPING_TASK_CLOSED","Không thể thay đổi task đã READY");
    }
    public List<HousekeepingChecklistDtos.TemplateResponse> templates(){return jdbc.query("SELECT maMauChecklist,ten,dangHoatDong FROM dbo.vwMauChecklistBuongPhong WHERE dangHoatDong=1 ORDER BY ten,maMauChecklist",templates);}
    public HousekeepingChecklistDtos.TemplateResponse createTemplate(String name,String actor,LocalDateTime now){return command("EXEC dbo.uspTaoMauChecklistBuongPhong ?,?,?",templates,name,actor,now);}
    public HousekeepingChecklistDtos.ResultResponse addResult(Long task,HousekeepingChecklistDtos.ResultRequest request,String actor,boolean management,LocalDateTime now){return command("EXEC dbo.uspGhiKetQuaChecklistBuongPhong ?,?,?,?,?,?,?",results,task,request.item().trim(),request.passed(),request.note(),actor,management,now);}
    public HousekeepingInspectionDtos.Response addInspection(Long task,HousekeepingInspectionDtos.Request request,String actor,boolean management,LocalDateTime now){return command("EXEC dbo.uspGhiKiemTraBuongPhong ?,?,?,?,?,?,?,?,?,?",inspections,task,types.convertToDatabaseColumn(request.inspectionType()),request.item().trim(),request.quantity(),conditions.convertToDatabaseColumn(request.itemCondition()),request.note(),actor,management,now,request.inspectionType().name());}
    public List<HousekeepingChecklistDtos.ResultResponse> results(Long task){return jdbc.query("SELECT "+RESULTS+" FROM dbo.vwKetQuaChecklistBuongPhong WHERE maNhiemVuBuongPhong=? ORDER BY maKetQuaChecklist",results,task);}
    public List<HousekeepingInspectionDtos.Response> inspections(Long task){return jdbc.query("SELECT "+INSPECTIONS+" FROM dbo.vwKiemTraBuongPhong WHERE maNhiemVuBuongPhong=? ORDER BY thoiDiemHoanThanh DESC,maKiemTraBuongPhong DESC",inspections,task);}
    private <T>T command(String sql,RowMapper<T> mapper,Object...args){
        try{return jdbc.queryForObject(sql,mapper,args);}
        catch(DataAccessException error){
            for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException failure){
                if(failure.getErrorCode()==2628||failure.getErrorCode()==8152)throw new org.springframework.dao.DataIntegrityViolationException("Dữ liệu vượt độ dài cột",error);
                String code=switch(failure.getErrorCode()){case 51801->"HOUSEKEEPING_TASK_NOT_FOUND";case 51802->"HOUSEKEEPING_TASK_SCOPE_FORBIDDEN";case 51803->"HOUSEKEEPING_TASK_CLOSED";case 51804->"HOUSEKEEPING_CHECKLIST_ITEM_NOT_ACTIVE";case 51805->"INVALID_REQUEST";default->null;};
                if(code!=null)throw new DomainException(code,failure.getMessage());
            }
            throw error;
        }
    }
}

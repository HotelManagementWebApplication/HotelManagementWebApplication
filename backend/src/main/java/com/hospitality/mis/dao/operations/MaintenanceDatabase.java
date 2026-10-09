package com.hospitality.mis.dao.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.operations.MaintenanceDtos;
import com.hospitality.mis.entity.operations.MaintenanceStatus;
import com.hospitality.mis.persistence.VietnameseEnumConverters.MaintenanceStatusConverter;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import java.sql.SQLException;
import java.util.List;

@Repository
public class MaintenanceDatabase {
    private final JdbcTemplate jdbc;
    private final MaintenanceStatusConverter statuses=new MaintenanceStatusConverter();
    private final RowMapper<MaintenanceDtos.Response> rows=(r,n)->new MaintenanceDtos.Response(r.getString(1),r.getString(2),r.getString(3),r.getDate(4).toLocalDate(),statuses.convertToEntityAttribute(r.getString(5)).name(),r.getString(6));
    public MaintenanceDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public MaintenanceDtos.Response create(MaintenanceDtos.CreateRequest request,String actor){return command("EXEC dbo.uspTaoPhieuBaoTri ?,?,?,?,?,?",request.id(),request.roomId(),request.type(),request.scheduledDate(),request.description(),actor);}
    public MaintenanceDtos.Response update(String id,MaintenanceStatus status,String actor){return command("EXEC dbo.uspChuyenTrangThaiBaoTri ?,?,?",id,statuses.convertToDatabaseColumn(status),actor);}
    public List<MaintenanceDtos.Response> list(String room){return jdbc.query("SELECT maPhieuBaoTri,maPhong,loaiBaoTri,ngayDuKien,trangThai,moTa FROM dbo.vwPhieuBaoTri WHERE maPhong=? ORDER BY ngayDuKien DESC,maPhieuBaoTri",rows,room);}
    private MaintenanceDtos.Response command(String sql,Object... args){
        try{return jdbc.queryForObject(sql,rows,args);}
        catch(DataAccessException error){
            for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof SQLException failure){
                String code=switch(failure.getErrorCode()){case 51601->"ROOM_NOT_FOUND";case 51701->"MAINTENANCE_EXISTS";case 51702->"ROOM_OCCUPIED";case 51703->"MAINTENANCE_NOT_FOUND";case 51704->"INVALID_MAINTENANCE_TRANSITION";default->null;};
                if(code!=null)throw new DomainException(code,failure.getMessage());
            }
            throw error;
        }
    }
}

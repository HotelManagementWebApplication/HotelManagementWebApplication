package com.hospitality.mis.service.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.operations.MaintenanceDatabase;
import com.hospitality.mis.dto.operations.MaintenanceDtos;
import com.hospitality.mis.entity.operations.MaintenanceStatus;
import com.hospitality.mis.middleware.security.SecurityActor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

/** Authorization and API parsing; SQL owns state, room version and audit. */
@Service
public class MaintenanceService {
    private final MaintenanceDatabase database;
    public MaintenanceService(MaintenanceDatabase database){this.database=database;}
    public MaintenanceDtos.Response create(MaintenanceDtos.CreateRequest request,String actor){return database.create(request,authenticatedActor(actor));}
    public MaintenanceDtos.Response updateStatus(String id,MaintenanceDtos.StatusRequest request,String actor){
        String boundActor=authenticatedActor(actor);
        MaintenanceStatus next;
        try{next=MaintenanceStatus.valueOf(request.status().trim().toUpperCase(java.util.Locale.ROOT));}
        catch(IllegalArgumentException error){throw new DomainException("INVALID_MAINTENANCE_STATUS","Trạng thái bảo trì không hợp lệ");}
        return database.update(id,next,boundActor);
    }
    @Transactional(readOnly=true)
    public List<MaintenanceDtos.Response> byRoom(String roomId){return database.list(roomId);}
    private String authenticatedActor(String supplied){
        try{return SecurityActor.requireBoundActor(supplied);}
        catch(org.springframework.security.authentication.AuthenticationCredentialsNotFoundException error){throw new DomainException("ACTOR_REQUIRED","Thiếu actor đã xác thực");}
        catch(org.springframework.security.access.AccessDeniedException error){throw new DomainException("ACTOR_MISMATCH","Actor không khớp principal hiện tại");}
    }
}

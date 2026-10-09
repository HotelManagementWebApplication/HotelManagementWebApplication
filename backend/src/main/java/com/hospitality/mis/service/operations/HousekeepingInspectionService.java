package com.hospitality.mis.service.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.operations.HousekeepingEvidenceDatabase;
import com.hospitality.mis.dto.operations.HousekeepingInspectionDtos;
import com.hospitality.mis.middleware.security.SecurityActor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class HousekeepingInspectionService {
    private final HousekeepingEvidenceDatabase database;
    private final Clock clock;
    public HousekeepingInspectionService(HousekeepingEvidenceDatabase database,Clock clock){this.database=database;this.clock=clock;}

    public HousekeepingInspectionDtos.Response add(Long taskId,HousekeepingInspectionDtos.Request request,String actor){
        String bound=authenticatedActor(actor);boolean management=hasManagementRole();
        database.requireAccess(taskId,bound,management,true);
        if(request==null||request.inspectionType()==null||request.item()==null||request.item().isBlank()||request.itemCondition()==null||request.quantity()<0)throw new DomainException("INVALID_REQUEST","Inspection không hợp lệ");
        return database.addInspection(taskId,request,bound,management,LocalDateTime.now(clock));
    }
    @Transactional(readOnly=true)
    public List<HousekeepingInspectionDtos.Response> list(Long taskId){return list(taskId,SecurityActor.currentActor());}
    @Transactional(readOnly=true)
    public List<HousekeepingInspectionDtos.Response> list(Long taskId,String actor){
        String bound=authenticatedActor(actor);database.requireAccess(taskId,bound,hasManagementRole(),false);return database.inspections(taskId);
    }
    private boolean hasManagementRole(){
        var authentication=SecurityContextHolder.getContext().getAuthentication();
        return authentication!=null&&authentication.getAuthorities().stream().anyMatch(a->
            a.getAuthority().equals("ROLE_ADMIN")||a.getAuthority().equals("ROLE_DIRECTOR")||a.getAuthority().equals("ROLE_MANAGER"));
    }
    private String authenticatedActor(String actor){
        try{return SecurityActor.requireBoundActor(actor);}
        catch(AuthenticationCredentialsNotFoundException e){throw new DomainException("ACTOR_REQUIRED","Thiếu actor đã xác thực");}
        catch(AccessDeniedException e){throw new DomainException("ACTOR_MISMATCH","Actor không khớp principal hiện tại");}
    }
}

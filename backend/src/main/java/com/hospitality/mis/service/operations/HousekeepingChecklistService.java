package com.hospitality.mis.service.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.operations.HousekeepingEvidenceDatabase;
import com.hospitality.mis.dto.operations.HousekeepingChecklistDtos;
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
public class HousekeepingChecklistService {
    private final HousekeepingEvidenceDatabase database;
    private final Clock clock;
    public HousekeepingChecklistService(HousekeepingEvidenceDatabase database,Clock clock){this.database=database;this.clock=clock;}

    @Transactional(readOnly=true)
    public List<HousekeepingChecklistDtos.TemplateResponse> templates(){return database.templates();}
    public HousekeepingChecklistDtos.TemplateResponse createTemplate(HousekeepingChecklistDtos.TemplateRequest request,String actor){
        String bound=authenticatedActor(actor);
        if(request==null||request.name()==null||request.name().isBlank())throw new DomainException("HOUSEKEEPING_CHECKLIST_TEMPLATE_REQUIRED","Tên checklist template là bắt buộc");
        return database.createTemplate(request.name().trim(),bound,LocalDateTime.now(clock));
    }
    public HousekeepingChecklistDtos.ResultResponse addResult(Long taskId,HousekeepingChecklistDtos.ResultRequest request,String actor){
        String bound=authenticatedActor(actor);boolean management=hasManagementRole();
        database.requireAccess(taskId,bound,management,true);
        if(request==null||request.item()==null||request.item().isBlank()||request.passed()==null)throw new DomainException("INVALID_REQUEST","Checklist result không hợp lệ");
        return database.addResult(taskId,request,bound,management,LocalDateTime.now(clock));
    }
    @Transactional(readOnly=true)
    public List<HousekeepingChecklistDtos.ResultResponse> results(Long taskId){return results(taskId,SecurityActor.currentActor());}
    @Transactional(readOnly=true)
    public List<HousekeepingChecklistDtos.ResultResponse> results(Long taskId,String actor){
        String bound=authenticatedActor(actor);database.requireAccess(taskId,bound,hasManagementRole(),false);return database.results(taskId);
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

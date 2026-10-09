package com.hospitality.mis.service.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.operations.HousekeepingTaskDatabase;
import com.hospitality.mis.dto.operations.HousekeepingDtos;
import com.hospitality.mis.entity.operations.HousekeepingTaskStatus;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Service
public class HousekeepingService {
    private final HousekeepingTaskDatabase database;
    private final Clock clock;
    public HousekeepingService(HousekeepingTaskDatabase database,Clock clock){this.database=database;this.clock=clock;}
    public HousekeepingDtos.Response create(HousekeepingDtos.CreateRequest request,String actor,String key){
        String bound=authenticatedActor(actor);
        if(!hasManagementRole())throw new DomainException("HOUSEKEEPING_ASSIGNMENT_FORBIDDEN","Chỉ Manager mới được phân công task housekeeping");
        if(request==null||request.roomId()==null||request.roomId().isBlank()||request.assignee()==null||request.assignee().isBlank())
            throw new DomainException("HOUSEKEEPING_ASSIGNEE_REQUIRED","Task phải có nhân viên housekeeping được phân công");
        return database.create(request,bound,IdempotencySupport.requireKey(key),IdempotencySupport.fingerprint("HOUSEKEEPING_CREATE|"+request),LocalDateTime.now(clock));
    }
    public HousekeepingDtos.Response update(Long id,HousekeepingDtos.UpdateRequest request,String actor,String key){
        String bound=authenticatedActor(actor);
        HousekeepingTaskStatus status=null;
        if(request!=null&&request.status()!=null){try{status=HousekeepingTaskStatus.valueOf(request.status().trim().toUpperCase(Locale.ROOT));}catch(IllegalArgumentException ignored){/* SQL returns the stable domain error after checking task existence. */}}
        if(status==HousekeepingTaskStatus.READY&&!hasManagementRole())
            throw new DomainException("HOUSEKEEPING_ACCEPTANCE_FORBIDDEN","Chỉ quản lý mới được nghiệm thu phòng");
        return database.update(id,request,status,bound,hasManagementRole(),IdempotencySupport.requireKey(key),IdempotencySupport.fingerprint("HOUSEKEEPING_UPDATE|"+id+"|"+request),LocalDateTime.now(clock));
    }
    @Transactional(readOnly=true)
    public List<HousekeepingDtos.Response> list(String room,String assignee,HousekeepingTaskStatus status){return list(room,assignee,status,SecurityActor.currentActor());}
    @Transactional(readOnly=true)
    public List<HousekeepingDtos.Response> list(String room,String assignee,HousekeepingTaskStatus status,String suppliedActor){
        String actor=authenticatedActor(suppliedActor);boolean management=hasManagementRole();
        if(!management&&assignee!=null&&!actor.equals(assignee))throw new DomainException("HOUSEKEEPING_TASK_SCOPE_FORBIDDEN","Không được xem task của nhân viên khác");
        return database.list(room,management?assignee:actor,status);
    }
    private boolean hasManagementRole(){
        var authentication=SecurityContextHolder.getContext().getAuthentication();
        return authentication!=null&&authentication.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_ADMIN")||a.getAuthority().equals("ROLE_DIRECTOR")||a.getAuthority().equals("ROLE_MANAGER"));
    }
    private String authenticatedActor(String actor){
        try{return SecurityActor.requireBoundActor(actor);}
        catch(AuthenticationCredentialsNotFoundException e){throw new DomainException("ACTOR_REQUIRED","Thiếu actor đã xác thực");}
        catch(AccessDeniedException e){throw new DomainException("ACTOR_MISMATCH","Actor không khớp principal hiện tại");}
    }
}

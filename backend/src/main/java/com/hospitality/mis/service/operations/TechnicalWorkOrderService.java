package com.hospitality.mis.service.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.operations.TechnicalWorkOrderDatabase;
import com.hospitality.mis.dto.operations.TechnicalWorkOrderDtos;
import com.hospitality.mis.entity.operations.TechnicalWorkOrderStatus;
import com.hospitality.mis.persistence.VietnameseEnumConverters.TechnicalWorkOrderStatusConverter;
import com.hospitality.mis.persistence.VietnameseCodeConverters.PriorityConverter;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.Locale;

@Service
public class TechnicalWorkOrderService {
    private final TechnicalWorkOrderDatabase database;
    private final Clock clock;
    private final TechnicalWorkOrderStatusConverter statuses=new TechnicalWorkOrderStatusConverter();
    private final PriorityConverter priorities=new PriorityConverter();
    public TechnicalWorkOrderService(TechnicalWorkOrderDatabase database,Clock clock){this.database=database;this.clock=clock;}
    public TechnicalWorkOrderDtos.Response create(TechnicalWorkOrderDtos.CreateRequest request,String actor,String key){
        String bound=authenticatedActor(actor);var payload=new HashMap<String,Object>();
        payload.put("room",request.roomId());payload.put("equipment",request.equipmentId());
        payload.put("assignee",request.assignee()==null||request.assignee().isBlank()?null:request.assignee().trim());
        String priority=request.priority()==null?null:request.priority().trim().toUpperCase(Locale.ROOT);
        payload.put("priority",List.of("LOW","MEDIUM","HIGH","CRITICAL").contains(priority==null?"":priority)?priorities.convertToDatabaseColumn(priority):null);
        payload.put("sla",request.slaDueAt());payload.put("materials",request.materials());
        return execute("create",null,payload,bound,key,"TECHNICAL_CREATE|"+request);
    }
    public TechnicalWorkOrderDtos.Response update(Long id,TechnicalWorkOrderDtos.UpdateRequest request,String actor,String key){
        String bound=authenticatedActor(actor);var payload=new HashMap<String,Object>();TechnicalWorkOrderStatus status=null;
        if(request!=null&&request.status()!=null){try{status=TechnicalWorkOrderStatus.valueOf(request.status().trim().toUpperCase(Locale.ROOT));}catch(IllegalArgumentException ignored){/* Procedure translates invalid status after scope checks. */}}
        payload.put("status",statuses.convertToDatabaseColumn(status));
        payload.put("assignee",request==null||request.assignee()==null?null:request.assignee().trim());
        payload.put("materials",request==null?null:request.materials());payload.put("result",request==null?null:request.resultNote());
        payload.put("resultBlank",request==null||request.resultNote()==null||request.resultNote().isBlank());
        return execute("update",id,payload,bound,key,"TECHNICAL_UPDATE|"+id+"|"+request);
    }
    public TechnicalWorkOrderDtos.Response accept(Long id,TechnicalWorkOrderDtos.AcceptanceRequest request,String actor,String key){
        String bound=authenticatedActor(actor);var payload=new HashMap<String,Object>();
        payload.put("acceptance",request==null||request.acceptanceNote()==null?null:request.acceptanceNote().trim());
        payload.put("acceptanceBlank",request==null||request.acceptanceNote()==null||request.acceptanceNote().isBlank());
        payload.put("reason",request==null?null:request.acceptanceNote());
        return execute("accept",id,payload,bound,key,"TECHNICAL_ACCEPT|"+id+"|"+request);
    }
    public TechnicalWorkOrderDtos.Response release(Long id,String actor,String key){return execute("release",id,Map.of(),authenticatedActor(actor),key,"TECHNICAL_RELEASE|"+id);}
    private TechnicalWorkOrderDtos.Response execute(String command,Long id,Map<String,Object> payload,String actor,String key,String canonical){
        return database.execute(command,id,payload,actor,hasManagementRole(),hasRole("ROLE_TECHNICAL"),IdempotencySupport.requireKey(key),IdempotencySupport.fingerprint(canonical),LocalDateTime.now(clock));
    }
    @Transactional(readOnly=true)
    public List<TechnicalWorkOrderDtos.Response> list(String room,TechnicalWorkOrderStatus status){return list(room,status,SecurityActor.currentActor());}
    @Transactional(readOnly=true)
    public List<TechnicalWorkOrderDtos.Response> list(String room,TechnicalWorkOrderStatus status,String suppliedActor){
        String actor=authenticatedActor(suppliedActor);return database.list(room,status,hasManagementRole()?null:actor);
    }
    private boolean hasManagementRole(){return hasRole("ROLE_ADMIN")||hasRole("ROLE_DIRECTOR")||hasRole("ROLE_MANAGER");}
    private boolean hasRole(String role){var authentication=SecurityContextHolder.getContext().getAuthentication();return authentication!=null&&authentication.getAuthorities().stream().anyMatch(a->a.getAuthority().equals(role));}
    private String authenticatedActor(String actor){
        try{return SecurityActor.requireBoundActor(actor);}
        catch(AuthenticationCredentialsNotFoundException e){throw new DomainException("ACTOR_REQUIRED","Thiếu actor đã xác thực");}
        catch(AccessDeniedException e){throw new DomainException("ACTOR_MISMATCH","Actor không khớp principal hiện tại");}
    }
}

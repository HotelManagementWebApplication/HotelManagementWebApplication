package com.hospitality.mis.service.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.operations.EquipmentIncidentDatabase;
import com.hospitality.mis.dto.operations.EquipmentIncidentDtos;
import com.hospitality.mis.dto.room.RoomEquipmentDtos;
import com.hospitality.mis.entity.operations.IncidentHandoffStatus;
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

/** SQL owns state, compensation, snapshots, audit and outbox; Java binds the actor and exact name comparison. */
@Service
public class EquipmentIncidentService {
    private final EquipmentIncidentDatabase database;
    private final Clock clock;
    public EquipmentIncidentService(EquipmentIncidentDatabase database,Clock clock){this.database=database;this.clock=clock;}

    @Transactional
    public EquipmentIncidentDtos.Response record(Long reservation,EquipmentIncidentDtos.CreateRequest request,String suppliedActor,String suppliedKey){
        String actor=actor(suppliedActor);
        if(request==null)throw new DomainException("INVALID_REQUEST","Thiếu nội dung báo sự cố");
        String hash=IdempotencySupport.fingerprint("EQUIPMENT_INCIDENT|"+reservation+"|"+request.roomId()+"|"+request.equipmentName()+"|"+request.equipmentId()+"|"+request.quantity()+"|"+request.severity());
        String key=IdempotencySupport.requireKey(suppliedKey);
        var context=database.prepare("reservation",reservation,request.roomId(),null,actor,key,hash);
        if(context.replay()!=null)return context.replay();
        Long equipment=resolve(context.equipment(),request.equipmentId(),request.equipmentName());
        if(equipment==null)throw new DomainException("EQUIPMENT_NOT_FOUND","Không xác định được duy nhất thiết bị active trong phòng");
        return database.execute("reservation",null,reservation,request.roomId(),equipment,request.equipmentName(),request.quantity(),request.severity(),null,null,false,actor,key,hash,LocalDateTime.now(clock));
    }

    @Transactional
    public EquipmentIncidentDtos.Response recordRoomIncident(EquipmentIncidentDtos.RoomIncidentRequest request,String suppliedActor,String suppliedKey){
        String actor=actor(suppliedActor);
        if(request==null)throw new DomainException("INVALID_REQUEST","Thiếu nội dung báo sự cố");
        String hash=IdempotencySupport.fingerprint("ROOM_INCIDENT|"+request.roomId()+"|"+request.equipmentName()+"|"+request.equipmentId()+"|"+request.resolvedQuantity()+"|"+request.severity()+"|"+request.description());
        String key=IdempotencySupport.requireKey(suppliedKey);
        var context=database.prepare("room",null,request.roomId(),null,actor,key,hash);
        if(context.replay()!=null)return context.replay();
        return database.execute("room",null,null,request.roomId(),resolve(context.equipment(),request.equipmentId(),request.equipmentName()),request.equipmentName(),request.resolvedQuantity(),request.severity(),request.description(),null,false,actor,key,hash,LocalDateTime.now(clock));
    }

    @Transactional
    public EquipmentIncidentDtos.Response handoff(Long id,EquipmentIncidentDtos.HandoffRequest request,String suppliedActor,String suppliedKey){
        String actor=actor(suppliedActor);
        String hash=IdempotencySupport.fingerprint("EQUIPMENT_INCIDENT_HANDOFF|"+id+"|"+request);
        String key=IdempotencySupport.requireKey(suppliedKey);
        var context=database.prepare("handoff",null,null,id,actor,key,hash);
        if(context.replay()!=null)return context.replay();
        var authentication=SecurityContextHolder.getContext().getAuthentication();
        boolean mayResolve=authentication!=null&&authentication.getAuthorities().stream().anyMatch(a->List.of("ROLE_TECHNICAL","ROLE_ADMIN","ROLE_DIRECTOR","ROLE_MANAGER").contains(a.getAuthority()));
        return database.execute("handoff",id,null,null,null,null,0,null,request.note(),request.status(),mayResolve,actor,key,hash,LocalDateTime.now(clock));
    }

    @Transactional(readOnly=true)
    public List<EquipmentIncidentDtos.Response> find(String roomId,Long reservationId,IncidentHandoffStatus status){return database.list(roomId,reservationId,status);}

    private Long resolve(List<RoomEquipmentDtos.Response> registry,Long id,String name){
        if(id!=null)return registry.stream().filter(x->id.equals(x.id())).map(RoomEquipmentDtos.Response::id).findFirst().orElse(null);
        var matches=registry.stream().filter(x->x.name().equalsIgnoreCase(name.trim())).toList();
        return matches.size()==1?matches.get(0).id():null;
    }
    private String actor(String supplied){
        try{return SecurityActor.requireBoundActor(supplied);}
        catch(AuthenticationCredentialsNotFoundException error){throw new DomainException("ACTOR_REQUIRED","Thiếu actor đã xác thực");}
        catch(AccessDeniedException error){throw new DomainException("ACTOR_MISMATCH","Actor không khớp principal hiện tại");}
    }
}

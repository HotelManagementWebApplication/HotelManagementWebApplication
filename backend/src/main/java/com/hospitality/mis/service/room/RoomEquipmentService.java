package com.hospitality.mis.service.room;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.room.RoomEquipmentDatabase;
import com.hospitality.mis.dto.room.RoomEquipmentDtos;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;

/** The database owns equipment, audit and durable replay in one atomic command. */
@Service
public class RoomEquipmentService {
    private final RoomEquipmentDatabase database;
    private final Clock clock;
    public RoomEquipmentService(RoomEquipmentDatabase database,Clock clock){this.database=database;this.clock=clock;}
    public RoomEquipmentDtos.Response add(RoomEquipmentDtos.CreateRequest request,String suppliedActor,String key){
        String actor=authenticatedActor(suppliedActor);
        String normalizedKey=IdempotencySupport.requireKey(key);
        String fingerprint=IdempotencySupport.fingerprint("ROOM_EQUIPMENT|"+request.roomId()+"|"+request.name()
                +"|"+request.originalValue()+"|"+request.purchasedOn()+"|"+request.quantity());
        return database.add(request,actor,normalizedKey,fingerprint,LocalDateTime.now(clock));
    }
    @Transactional(readOnly=true)
    public List<RoomEquipmentDtos.Response> list(String roomId){return database.list(roomId);}
    public RoomEquipmentDtos.Response update(String roomId,Long equipmentId,RoomEquipmentDtos.UpdateRequest request,String actor){
        String boundActor=authenticatedActor(actor);
        if(request==null || request.active()==null)throw new DomainException("INVALID_REQUEST","Thiếu nội dung cập nhật thiết bị");
        return database.update(roomId,equipmentId,request,boundActor);
    }
    private String authenticatedActor(String supplied){
        try{return SecurityActor.requireBoundActor(supplied);}
        catch(org.springframework.security.authentication.AuthenticationCredentialsNotFoundException error){throw new DomainException("ACTOR_REQUIRED","Thiếu actor đã xác thực");}
        catch(org.springframework.security.access.AccessDeniedException error){throw new DomainException("ACTOR_MISMATCH","Actor không khớp principal hiện tại");}
    }
}

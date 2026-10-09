package com.hospitality.mis.service.room;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.room.RoomDatabase;
import com.hospitality.mis.dto.room.RoomDtos;
import com.hospitality.mis.entity.room.RoomStatus;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.governance.AuditService;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.List;

/** Immutable room reads and guarded SQL operational status commands. */
@Service
public class RoomService {
    private final RoomDatabase rooms;
    private final AuditService audit;
    private final Clock clock;
    public RoomService(RoomDatabase rooms,AuditService audit,Clock clock){this.rooms=rooms;this.audit=audit;this.clock=clock;}
    @Transactional(readOnly=true)
    public List<RoomDtos.Response> search(String type,RoomStatus status){return rooms.search(type,status).stream().map(RoomDatabase.Snapshot::response).toList();}
    @Transactional(readOnly=true)
    public List<RoomDtos.Availability> availability(LocalDateTime from,LocalDateTime to,String type){
        if(from==null||to==null||!from.isBefore(to))throw new DomainException("INVALID_INTERVAL","Thời gian nhận phải trước thời gian trả");
        var now=LocalDateTime.now(clock);
        return rooms.search(type,null).stream().map(room->new RoomDtos.Availability(room.id(),room.roomTypeId(),room.roomTypeName(),room.dailyPrice(),room.floor(),!room.status().blocksAvailability()&&!rooms.overlap(room.id(),from,to,now))).toList();
    }
    @Transactional
    public RoomDtos.Response updateStatus(String id,RoomStatus status,String suppliedActor){
        String actor;
        try{actor=SecurityActor.requireBoundActor(suppliedActor);}
        catch(AuthenticationCredentialsNotFoundException error){throw new DomainException("ACTOR_REQUIRED","Authenticated actor is required");}
        catch(AccessDeniedException error){throw new DomainException("ACTOR_MISMATCH","Actor does not match the current principal");}
        if(status==null||!status.isOperationalStatus())throw new DomainException("INVALID_ROOM_STATUS","Trạng thái phòng không hợp lệ");
        var old=rooms.lock(id).orElseThrow(()->new DomainException("ROOM_NOT_FOUND","Không tìm thấy phòng: "+id));
        if(old.status()==status)return old.response();
        var result=rooms.status(old,status,hasRole("ROLE_TECHNICAL"),hasRole("ROLE_ADMIN")||hasRole("ROLE_DIRECTOR")||hasRole("ROLE_MANAGER"),LocalDateTime.now(clock));
        audit.record(actor,"ROOM_STATUS_CHANGED","ROOM",id,old.status().databaseCode(),status.databaseCode(),null);return result.response();
    }
    private boolean hasRole(String role){var auth=SecurityContextHolder.getContext().getAuthentication();return auth!=null&&auth.getAuthorities().stream().anyMatch(a->role.equals(a.getAuthority()));}
}

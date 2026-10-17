package com.hospitality.mis.service.room;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.room.RoomDatabase;
import com.hospitality.mis.dto.room.RoomAdminDtos;
import com.hospitality.mis.service.governance.AuditService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class RoomAdminService {
    private final RoomDatabase rooms;
    private final AuditService audit;
    private final RoomService commands;
    public RoomAdminService(RoomDatabase rooms,AuditService audit,RoomService commands){this.rooms=rooms;this.audit=audit;this.commands=commands;}
    @Transactional(readOnly=true)
    public List<RoomAdminDtos.Response> list(){return rooms.search(null,null).stream().map(RoomDatabase.Snapshot::admin).toList();}
    @Transactional
    public RoomAdminDtos.Response create(RoomAdminDtos.Request request,String actor){
        var result=rooms.admin("create",request.id(),request,null);
        audit.record(actor,"ROOM_CREATED","ROOM",request.id(),null,request.roomTypeId(),null);return result.admin();
    }
    @Transactional
    public RoomAdminDtos.Response update(String id,RoomAdminDtos.Request request,String actor){
        rooms.catalogLock();
        var old=rooms.lock(id).orElseThrow(()->new DomainException("ROOM_NOT_FOUND","Không tìm thấy phòng"));
        var result=rooms.admin("update",id,request,old.version());
        if(request.status()!=null&&request.status()!=old.status()){commands.updateStatus(id,request.status(),actor);result=rooms.find(id).orElseThrow();}
        audit.record(actor,"ROOM_UPDATED","ROOM",id,null,request.roomTypeId(),null);return result.admin();
    }
}

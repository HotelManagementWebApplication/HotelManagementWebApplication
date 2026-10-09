package com.hospitality.mis.service.room;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.room.RoomTypeDatabase;
import com.hospitality.mis.dto.governance.ApprovalDtos;
import com.hospitality.mis.dto.room.RoomTypeAdminDtos;
import com.hospitality.mis.entity.room.RoomTypeCatalogStatus;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.governance.*;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.List;

/** Catalog mutex, durable commands and exact approval binding on SQL projections. */
@Service
public class RoomTypeCatalogService {
    private static final String ACTION="ROOM_TYPE_ACTIVATE";
    private final RoomTypeDatabase types;
    private final ApprovalService approvals;
    private final AuditService audit;
    private final DurableIdempotencyService durable;
    private final Clock clock;
    public RoomTypeCatalogService(RoomTypeDatabase types,ApprovalService approvals,AuditService audit,DurableIdempotencyService durable,Clock clock){
        this.types=types;this.approvals=approvals;this.audit=audit;this.durable=durable;this.clock=clock;
    }
    @Transactional
    public RoomTypeAdminDtos.Response create(RoomTypeAdminDtos.Request request,String actor,String key){
        String principal=SecurityActor.requireBoundActor(actor),hash=fingerprint("CREATE|"+canonical(request));types.catalogLock();
        return durable.execute("room-type-create",key,principal,hash,RoomTypeAdminDtos.Response.class,()->{
            if(types.find(request.id().trim()).isPresent())throw error("ROOM_TYPE_EXISTS","Loại phòng đã tồn tại");
            var result=types.save("create",request.id().trim(),request,principal,LocalDateTime.now(clock),null,null,null);
            audit.record(principal,"ROOM_TYPE_DRAFT_CREATED","ROOM_TYPE",result.id(),null,result.catalogStatus().name(),null);return result;
        });
    }
    @Transactional
    public RoomTypeAdminDtos.Response update(String id,RoomTypeAdminDtos.Request request,String actor,String key){
        String principal=SecurityActor.requireBoundActor(actor),normalized=id.trim();
        if(!normalized.equals(request.id().trim()))throw error("ROOM_TYPE_ID_MISMATCH","ID path và body không khớp");
        String hash=fingerprint("UPDATE|"+canonical(request));types.catalogLock();
        return durable.execute("room-type-update",key,principal,hash,RoomTypeAdminDtos.Response.class,()->{
            var old=types.required(normalized);
            if(old.catalogStatus()==RoomTypeCatalogStatus.ACTIVE)throw error("ROOM_TYPE_ACTIVE_IMMUTABLE","Không sửa trực tiếp loại phòng ACTIVE; tạo draft thay đổi mới");
            var result=types.save("update",normalized,request,principal,LocalDateTime.now(clock),null,null,null);
            audit.record(principal,"ROOM_TYPE_DRAFT_UPDATED","ROOM_TYPE",normalized,old.catalogStatus().name(),result.catalogStatus().name(),null);return result;
        });
    }
    @Transactional
    public RoomTypeAdminDtos.Response createRevision(String sourceId,RoomTypeAdminDtos.Request request,String actor,String key){
        String principal=SecurityActor.requireBoundActor(actor),source=sourceId.trim();var current=types.locked(source);
        if(current.catalogStatus()!=RoomTypeCatalogStatus.ACTIVE)throw error("ROOM_TYPE_REVISION_SOURCE_INVALID","Chỉ loại phòng ACTIVE mới được tạo revision");
        if(request==null||request.id()==null||request.id().isBlank())throw error("ROOM_TYPE_ID_REQUIRED","Revision phải có mã loại phòng mới");
        String id=request.id().trim(),hash=fingerprint("REVISION|"+source+"|"+canonical(request));
        return durable.execute("room-type-revision",key,principal,hash,RoomTypeAdminDtos.Response.class,()->{
            if(types.find(id).isPresent())throw error("ROOM_TYPE_EXISTS","Mã revision đã tồn tại");
            var result=types.save("revision",id,request,principal,LocalDateTime.now(clock),source,null,null);
            audit.record(principal,"ROOM_TYPE_REVISION_CREATED","ROOM_TYPE",id,source,result.catalogStatus().name(),null);return result;
        });
    }
    @Transactional
    public ApprovalDtos.Response submit(String id,String actor,String key){
        String principal=SecurityActor.requireBoundActor(actor);var type=types.locked(id.trim());
        if(type.catalogStatus()==RoomTypeCatalogStatus.ACTIVE)throw error("ROOM_TYPE_ALREADY_ACTIVE","Loại phòng đã ACTIVE");
        return approvals.request(principal,ACTION,type.id(),canonical(type),null,"Đưa loại phòng vào catalog công khai",key);
    }
    @Transactional
    public RoomTypeAdminDtos.Response activate(String id,String actor,String key){
        String principal=SecurityActor.requireBoundActor(actor);var type=types.locked(id.trim());String payload=canonical(type),hash=fingerprint("ACTIVATE|"+type.id()+"|"+payload);
        return durable.execute("room-type-activate",key,principal,hash,RoomTypeAdminDtos.Response.class,()->{
            var approval=approvals.consumeApprovedByApprover(ACTION,type.id(),payload,null,principal);
            var result=types.save("activate",type.id(),null,principal,LocalDateTime.now(clock),null,approval.id(),approval.approver());
            audit.record(principal,"ROOM_TYPE_ACTIVATED","ROOM_TYPE",type.id(),RoomTypeCatalogStatus.DRAFT.name(),RoomTypeCatalogStatus.ACTIVE.name(),null);return result;
        });
    }
    @Transactional
    public void markRejected(String id,String actor){
        var type=types.locked(id.trim());
        if(type.catalogStatus()!=RoomTypeCatalogStatus.ACTIVE){types.save("reject",type.id(),null,actor,LocalDateTime.now(clock),null,null,null);audit.record(actor,"ROOM_TYPE_REJECTED","ROOM_TYPE",type.id(),RoomTypeCatalogStatus.DRAFT.name(),RoomTypeCatalogStatus.REJECTED.name(),null);}
    }
    @Transactional(readOnly=true)
    public RoomTypeAdminDtos.Response get(String id){return types.required(id.trim());}
    @Transactional(readOnly=true)
    public List<RoomTypeAdminDtos.PriceHistoryResponse> priceHistory(String id){return types.history(id.trim());}
    private static String canonical(RoomTypeAdminDtos.Request request){
        return String.join("|",request.id().trim(),request.name().trim(),request.dailyPrice().toPlainString(),
            request.description()==null?"":request.description().trim(),request.area()==null?"":request.area().stripTrailingZeros().toPlainString(),
            request.view()==null?"":request.view().trim(),request.hourlyPrice()==null?"0":request.hourlyPrice().stripTrailingZeros().toPlainString(),request.bedType()==null?"":request.bedType().trim());
    }
    private static String canonical(RoomTypeAdminDtos.Response type){
        return String.join("|",type.id(),type.name(),type.dailyPrice().toPlainString(),type.description()==null?"":type.description(),
            type.area()==null?"":type.area().stripTrailingZeros().toPlainString(),type.view()==null?"":type.view(),
            type.hourlyPrice()==null?"0":type.hourlyPrice().stripTrailingZeros().toPlainString(),type.bedType()==null?"":type.bedType());
    }
    private static String fingerprint(String value){return IdempotencySupport.fingerprint(value);}
    private static DomainException error(String code,String message){return new DomainException(code,message);}
}

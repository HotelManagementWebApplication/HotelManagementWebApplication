package com.hospitality.mis.service.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.billing.ServiceCatalogDatabase;
import com.hospitality.mis.dao.operations.ServiceInventoryDatabase;
import com.hospitality.mis.dao.operations.ServiceInventoryDatabase.StockReturnDatabase;
import com.hospitality.mis.dto.billing.ServiceDtos;
import com.hospitality.mis.dto.operations.InventoryMovementDtos;
import com.hospitality.mis.dto.operations.InventoryMovementDtos.StockReturnDtos;
import com.hospitality.mis.entity.operations.InventoryMovement;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import java.time.*;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.List;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Authorization and API validation; the database owns the atomic stock command. */
@Service
public class InventoryMovementService {
    private final ServiceInventoryDatabase database;
    private final Clock clock;
    public InventoryMovementService(ServiceInventoryDatabase database,Clock clock){this.database=database;this.clock=clock;}
    public InventoryMovementDtos.Response record(InventoryMovementDtos.CreateRequest request,String actor){return record(request,actor,null);}
    public InventoryMovementDtos.Response record(InventoryMovementDtos.CreateRequest request,String actor,String key){
        String boundActor=SecurityActor.requireBoundActor(actor);
        if(request!=null && request.type()==InventoryMovement.MovementType.RETURN)
            throw new DomainException("RETURN_APPROVAL_REQUIRED","Buồng phòng gửi yêu cầu trả hàng; nhân viên Kho duyệt trước khi cộng tồn.");
        if(request==null || request.type()==null || request.serviceId()==null || request.serviceId().isBlank())
            throw new DomainException("INVALID_INVENTORY_MOVEMENT","Movement phải có service_id và type");
        if(request.quantity()==0 || (request.type()!=InventoryMovement.MovementType.ADJUST && request.quantity()<0))
            throw new DomainException("INVALID_INVENTORY_QUANTITY","Chỉ ADJUST được dùng số lượng âm và số lượng không được bằng 0");
        String normalizedKey=IdempotencySupport.requireKey(key);
        String hash=IdempotencySupport.fingerprint("INVENTORY|"+request.serviceId()+"|"+request.type()+"|"+request.quantity()+"|"+request.reason());
        return database.record(request,boundActor,normalizedKey,hash,LocalDateTime.now(clock));
    }
    @Transactional(readOnly=true)
    public List<InventoryMovementDtos.Response> list(String serviceId){return database.list(serviceId);}
    @Transactional(readOnly=true)
    public InventoryMovementDtos.ReportResponse report(String serviceId,LocalDate from,LocalDate to){
        database.requireService(serviceId);
        LocalDate start=from==null?LocalDate.now(clock).minusDays(30):from;
        LocalDate end=to==null?LocalDate.now(clock):to;
        if(start.isAfter(end))throw new DomainException("INVALID_DATE_RANGE","Khoảng ngày không hợp lệ");
        LocalDateTime fromAt=start.atStartOfDay(),toAt=end.plusDays(1).atStartOfDay();
        int[] totals=database.totals(serviceId,fromAt,toAt);
        return new InventoryMovementDtos.ReportResponse(serviceId,fromAt,toAt,totals[0],totals[1],totals[2],totals[3],totals[4],totals[0]+totals[3]+totals[4]-totals[1]-totals[2]);
    }


    // StockReturnService
    @Service
    public static class StockReturnService {
        private final StockReturnDatabase database;
        private final ServiceCatalogDatabase catalog;
        private final Clock clock;
        public StockReturnService(StockReturnDatabase database,ServiceCatalogDatabase catalog,Clock clock){this.database=database;this.catalog=catalog;this.clock=clock;}
        @Transactional(readOnly=true)
        public List<StockReturnDtos.Response> list(){
            String actor=SecurityActor.currentActor();
            boolean warehouse=SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_KITCHEN"));
            return database.list(warehouse?null:actor);
        }
        @Transactional(readOnly=true)
        public List<ServiceDtos.Response> catalog(){return catalog.all().stream().filter(item->Set.of("food","beverage","room-amenity").contains(item.category())).toList();}
        @Transactional
        public StockReturnDtos.Response create(StockReturnDtos.CreateRequest request,String key){
            String room=request.roomId()==null||request.roomId().isBlank()?null:request.roomId().trim();
            return database.command("create",null,request.serviceId().trim(),request.quantity(),room,SecurityActor.currentActor(),request.reason().trim(),IdempotencySupport.requireKey(key),LocalDateTime.now(clock));
        }
        @Transactional
        public StockReturnDtos.Response decide(long id,boolean approve,String reason){
            return database.command(approve?"approve":"reject",id,null,null,null,SecurityActor.currentActor(),reason==null?null:reason.trim(),null,LocalDateTime.now(clock));
        }
    }
}

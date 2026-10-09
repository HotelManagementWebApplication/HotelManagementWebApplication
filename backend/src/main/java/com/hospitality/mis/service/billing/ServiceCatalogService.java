
package com.hospitality.mis.service.billing;

import com.hospitality.mis.dao.billing.ServiceCatalogDatabase;
import com.hospitality.mis.dto.billing.ServiceDtos;
import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.service.governance.*;
import com.hospitality.mis.service.operations.InventoryMovementService;
import com.hospitality.mis.dto.operations.InventoryMovementDtos;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.persistence.VietnameseCodeConverters;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.math.BigDecimal;
import java.util.List;

/** API validation and authorization; SQL owns catalog, prices and stock writes. */
@org.springframework.stereotype.Service
public class ServiceCatalogService {
    private final ServiceCatalogDatabase database;
    private final AuditService audit;
    private final ApprovalService approvals;
    private final Clock clock;
    private final InventoryMovementService inventoryMovements;
    private final DurableIdempotencyService durable;
    public ServiceCatalogService(ServiceCatalogDatabase database,AuditService audit,ApprovalService approvals,Clock clock,InventoryMovementService inventoryMovements,DurableIdempotencyService durable){
        this.database=database;this.audit=audit;this.approvals=approvals;this.clock=clock;this.inventoryMovements=inventoryMovements;this.durable=durable;
    }
    @Transactional(readOnly=true)
    public List<ServiceDtos.Response> findAll(){return database.all();}
    @Transactional
    public ServiceDtos.Response create(ServiceDtos.CreateRequest request,String actor){
        if(database.find(request.id()).isPresent())throw new DomainException("SERVICE_EXISTS","Mã dịch vụ đã tồn tại");
        String unit=normalizeUnit(request.unit()),category=normalizeCategory(request.category());
        database.create(request,unit,category,LocalDateTime.now(clock));
        if(request.openingStock()>0)inventoryMovements.record(new InventoryMovementDtos.CreateRequest(request.id(),com.hospitality.mis.entity.operations.InventoryMovement.MovementType.RECEIVE,request.openingStock(),"SERVICE_OPENING_STOCK"),actor,"service-create:"+request.id());
        audit.record(actor,"SERVICE_CREATED","SERVICE",request.id(),null,request.name(),null);
        return database.required(request.id());
    }
    @Transactional
    public ServiceDtos.Response restock(String id,ServiceDtos.StockRequest request,String actor,String key){
        inventoryMovements.record(new InventoryMovementDtos.CreateRequest(id,com.hospitality.mis.entity.operations.InventoryMovement.MovementType.RECEIVE,request.quantity(),"SERVICE_RESTOCK"),actor,key);
        return database.required(id);
    }
    @Transactional
    public com.hospitality.mis.dto.governance.ApprovalDtos.Response requestPriceChange(String id,ServiceDtos.PriceChangeRequest request,String actor,String key){
        database.required(id);
        return approvals.request(actor,"SERVICE_PRICE_CHANGE",id,priceMutationPayload(request.price()),request.price(),request.reason(),key);
    }
    @Transactional
    public ServiceDtos.Response activatePriceChange(String id,ServiceDtos.PriceChangeRequest request,String actor,String key){
        String principal=SecurityActor.requireBoundActor(actor),payload=priceMutationPayload(request.price());
        String hash=IdempotencySupport.fingerprint("SERVICE_PRICE_ACTIVATE|"+id+"|"+payload+"|"+request.reason().trim());
        // Match inventory's service-first order before taking any shared idempotency bucket.
        // Missing service is deliberately checked after approval consumption, as in the API contract.
        database.lock(id);
        return durable.execute("service-price-activate",key,principal,hash,ServiceDtos.Response.class,()->{
            var approval=approvals.consumeApprovedByApprover("SERVICE_PRICE_CHANGE",id,payload,request.price(),principal);
            database.price(id,request.price(),approval.approver(),approval.id(),LocalDateTime.now(clock));
            audit.record(principal,"SERVICE_PRICE_CHANGED","SERVICE",id,null,request.price().toPlainString(),approval.reason());
            return database.required(id);
        });
    }
    @Transactional(readOnly=true)
    public List<ServiceDtos.PriceHistoryResponse> priceHistory(String id){return database.history(id);}
    @Transactional
    public List<com.hospitality.mis.dto.governance.ApprovalDtos.Response> priceRequestsFor(String actor){return approvals.requestedServicePriceChanges(actor);}
    @Transactional(readOnly=true)
    public List<ServiceDtos.Response> lowStock(){return database.lowStock();}
    private static String normalizeCategory(String value){
        String category=value==null||value.isBlank()?"other":value.trim();
        try{new VietnameseCodeConverters.ServiceCategoryConverter().convertToDatabaseColumn(category);return category;}
        catch(IllegalArgumentException error){throw new DomainException("INVALID_SERVICE_CATEGORY","Nhóm dịch vụ không hợp lệ");}
    }
    private static String normalizeUnit(String value){
        String unit=value==null||value.isBlank()?"lần":value.trim();
        try{return new VietnameseCodeConverters.ServiceUnitConverter().convertToDatabaseColumn(unit);}
        catch(IllegalArgumentException error){throw new DomainException("INVALID_SERVICE_UNIT","Đơn vị tính không được hỗ trợ");}
    }
    private static String priceMutationPayload(BigDecimal price){return price.stripTrailingZeros().toPlainString();}
}

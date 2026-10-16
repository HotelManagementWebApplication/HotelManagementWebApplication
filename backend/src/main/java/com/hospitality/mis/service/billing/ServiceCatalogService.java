
package com.hospitality.mis.service.billing;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.billing.ServiceCatalogDatabase.ServiceAvailabilityDatabase;
import com.hospitality.mis.dao.billing.ServiceCatalogDatabase;
import com.hospitality.mis.dao.billing.ServiceCatalogDatabase.ServiceConsumptionDatabase;
import com.hospitality.mis.dao.billing.ServiceCatalogDatabase.ServiceScheduleDatabase;
import com.hospitality.mis.dao.governance.ApprovalDatabase;
import com.hospitality.mis.dto.billing.ServiceDtos.CatalogProposalDtos;
import com.hospitality.mis.dto.billing.ServiceDtos.ServiceAvailabilityDtos;
import com.hospitality.mis.dto.billing.ServiceDtos.ServiceConsumptionDto;
import com.hospitality.mis.dto.billing.ServiceDtos;
import com.hospitality.mis.dto.billing.ServiceDtos.ServiceScheduleDtos;
import com.hospitality.mis.dto.governance.ApprovalDtos;
import com.hospitality.mis.dto.operations.InventoryMovementDtos;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.persistence.VietnameseCodeConverters.*;
import com.hospitality.mis.persistence.VietnameseCodeConverters;
import com.hospitality.mis.service.governance.*;
import com.hospitality.mis.service.governance.ApprovalService;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.service.operations.InventoryMovementService;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import jakarta.validation.Validator;
import java.math.BigDecimal;
import java.time.*;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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


    // CatalogProposalService
    /** Catalog additions use the existing independent manager approval and audit trail. */
    @Service
    public static class CatalogProposalService {
        private final ApprovalService approvals;
        private final ApprovalDatabase approvalDatabase;
        private final ServiceCatalogDatabase catalog;
        private final ObjectMapper mapper;
        private final Validator validator;
        private final AuditService audit;
        private final Clock clock;
        public CatalogProposalService(ApprovalService approvals,ApprovalDatabase approvalDatabase,ServiceCatalogDatabase catalog,ObjectMapper mapper,Validator validator,AuditService audit,Clock clock){
            this.approvals=approvals;this.approvalDatabase=approvalDatabase;this.catalog=catalog;this.mapper=mapper;this.validator=validator;this.audit=audit;this.clock=clock;
        }
        private void validate(CatalogProposalDtos.Request request){
            if(!validator.validate(request).isEmpty())throw invalid();
            var goods=Set.of("food","beverage","room-amenity");
            var services=Set.of("business","inroom","recreation","fine-dining","spa","transport","laundry","other");
            if(!("WAREHOUSE".equals(request.kind())?goods:services).contains(request.category()))throw invalid();
            try{new ServiceUnitConverter().convertToDatabaseColumn(request.unit());new ServiceCategoryConverter().convertToDatabaseColumn(request.category());}
            catch(IllegalArgumentException error){throw invalid();}
        }
        @Transactional public ApprovalDtos.Response submit(CatalogProposalDtos.Request request,String actor,String key){
            validate(request);
            if(catalog.find(request.id()).isPresent())throw new DomainException("SERVICE_EXISTS","Mã danh mục đã tồn tại");
            try{return approvals.request(actor,"SERVICE_CATALOG_CREATE",request.id(),mapper.writeValueAsString(request),request.price(),request.reason(),key);}
            catch(JsonProcessingException error){throw invalid();}
        }
        @Transactional public List<ApprovalDtos.Response> mine(String actor){return approvals.requestedCatalogAdditions(actor);}
        @Transactional public ApprovalDtos.Response approve(Long id,String actor,String key){
            var approval=key==null||key.isBlank()?approvals.approve(id,actor):approvals.approve(id,actor,key);
            if(!"SERVICE_CATALOG_CREATE".equals(approval.action())||approval.consumedAt()!=null)return approval;
            CatalogProposalDtos.Request request;
            try{request=mapper.readValue(approval.payload(),CatalogProposalDtos.Request.class);}
            catch(JsonProcessingException error){throw invalid();}
            validate(request);
            if(!request.id().equals(approval.targetId())||request.price().compareTo(approval.amount())!=0)throw invalid();
            // A duplicate ID fails the entire approval transaction, leaving it pending.
            approvals.consumeApprovedByApprover("SERVICE_CATALOG_CREATE",request.id(),approval.payload(),request.price(),actor);
            catalog.createApprovedCatalog(new ServiceDtos.CreateRequest(request.id(),request.name().trim(),request.price(),request.unit(),0,0,request.category(),null,null),"WAREHOUSE".equals(request.kind()),actor,approval.id(),LocalDateTime.now(clock));
            audit.record(actor,"SERVICE_CATALOG_APPROVED","SERVICE",request.id(),null,approval.payload(),approval.reason());
            return approvalDatabase.find(id).orElseThrow(CatalogProposalService::invalid);
        }
        private static DomainException invalid(){return new DomainException("INVALID_CATALOG_PROPOSAL","Thông tin đề xuất danh mục không hợp lệ");}
    }

    // ServiceAvailabilityService
    @Service
    public static class ServiceAvailabilityService {
        private final ServiceAvailabilityDatabase database;
        public ServiceAvailabilityService(ServiceAvailabilityDatabase database){this.database=database;}
        @Transactional(readOnly=true)
        public List<ServiceAvailabilityDtos.Response> list(LocalDateTime from,LocalDateTime to){
            if(from==null||to==null||!from.isBefore(to)||to.isAfter(from.plusDays(31)))
                throw new DomainException("INVALID_AVAILABILITY_WINDOW","Chọn thời gian kết thúc sau thời gian bắt đầu, tối đa 31 ngày.");
            return database.list(from,to);
        }
    }

    // ServiceConsumptionService
    @Service
    public static class ServiceConsumptionService {
        private final ServiceConsumptionDatabase database;
        public ServiceConsumptionService(ServiceConsumptionDatabase database) { this.database=database; }
        @Transactional(readOnly=true)
        public List<ServiceConsumptionDto> list(LocalDate from,LocalDate to) {
            if(from==null||to==null||from.isAfter(to)||to.isAfter(from.plusDays(30)))
                throw new DomainException("INVALID_DATE_RANGE","Chọn khoảng báo cáo tối đa 31 ngày");
            return database.list(from,to);
        }
    }

    // ServiceScheduleService
    @Service
    public static class ServiceScheduleService {
        private final ServiceScheduleDatabase database;
        public ServiceScheduleService(ServiceScheduleDatabase database) { this.database=database; }
        @Transactional(readOnly=true)
        public ServiceScheduleDtos.Response get(String id) { return encode(database.get(id)); }
        public ServiceScheduleDtos.Response save(String id,ServiceScheduleDtos.Request request) {
            String mode=switch(request.mode()) {
                case "DURATION" -> "Theo thời lượng"; case "UNITS" -> "Theo lượt";
                case "STAY" -> "Theo kỳ lưu trú"; case "DAILY" -> "Theo ngày";
                case "OVERNIGHT" -> "Qua đêm"; case "STOCK" -> "Theo tồn kho";
                default -> throw new DomainException("INVALID_SCHEDULE_MODE","Cách tính khả dụng không hợp lệ");
            };
            if(request.mode().equals("STOCK")&&!request.consumesStock())
                throw new DomainException("INVALID_SCHEDULE_MODE","Khả dụng theo tồn kho phải bật trừ tồn khi sử dụng");
            return encode(database.save(id,request,mode,SecurityActor.currentActor()));
        }
        private ServiceScheduleDtos.Response encode(ServiceScheduleDtos.Response row) {
            String mode=row.mode()==null ? null : switch(row.mode()) {
                case "Theo thời lượng" -> "DURATION"; case "Theo kỳ lưu trú" -> "STAY";
                case "Theo ngày" -> "DAILY"; case "Qua đêm" -> "OVERNIGHT";
                case "Theo tồn kho" -> "STOCK"; default -> "UNITS";
            };
            return new ServiceScheduleDtos.Response(row.serviceId(),row.capacity(),row.unit(),row.minutesPerUnit(),mode,row.consumesStock());
        }
    }
}

package com.hospitality.mis.service.billing;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.billing.ServiceCatalogDatabase;
import com.hospitality.mis.dao.governance.ApprovalDatabase;
import com.hospitality.mis.dto.billing.CatalogProposalDtos;
import com.hospitality.mis.dto.billing.ServiceDtos;
import com.hospitality.mis.dto.governance.ApprovalDtos;
import com.hospitality.mis.persistence.VietnameseCodeConverters.*;
import com.hospitality.mis.service.governance.ApprovalService;
import com.hospitality.mis.service.governance.AuditService;
import jakarta.validation.Validator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/** Catalog additions use the existing independent manager approval and audit trail. */
@Service
public class CatalogProposalService {
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
        catalog.createApprovedCatalog(new ServiceDtos.CreateRequest(request.id(),request.name().trim(),request.price(),request.unit(),0,request.safetyThreshold(),request.category(),null,null),"WAREHOUSE".equals(request.kind()),actor,approval.id(),LocalDateTime.now(clock));
        audit.record(actor,"SERVICE_CATALOG_APPROVED","SERVICE",request.id(),null,approval.payload(),approval.reason());
        return approvalDatabase.find(id).orElseThrow(CatalogProposalService::invalid);
    }
    private static DomainException invalid(){return new DomainException("INVALID_CATALOG_PROPOSAL","Thông tin đề xuất danh mục không hợp lệ");}
}

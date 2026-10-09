package com.hospitality.mis.service.governance;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.governance.ApprovalDatabase;
import com.hospitality.mis.dto.governance.ApprovalDtos;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.data.domain.Page;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;

@Service
public class ApprovalService {
    private static final Set<String> ACTIONS=Set.of("INVOICE_DELETE","DEPOSIT_REFUND","PRICE_OVERRIDE","PAYMENT_REFUND","BILLING_ADJUSTMENT","ROOM_TYPE_ACTIVATE","SERVICE_PRICE_CHANGE");
    private final ApprovalDatabase database;
    private final DurableIdempotencyService idempotency;
    private final Clock clock;
    public ApprovalService(ApprovalDatabase database,DurableIdempotencyService idempotency,Clock clock){this.database=database;this.idempotency=idempotency;this.clock=clock;}
    @Transactional
    public ApprovalDtos.Response request(String requester,String action,String target,String payload,BigDecimal amount,String reason,String correlation){
        String actor=SecurityActor.requireBoundActor(requester);
        requireText(action,"INVALID_APPROVAL_REQUEST");
        if(!ACTIONS.contains(action))throw error("UNSUPPORTED_APPROVAL");
        requireText(target,"INVALID_APPROVAL_REQUEST");requireText(payload,"INVALID_APPROVAL_REQUEST");requireText(reason,"INVALID_APPROVAL_REQUEST");
        if(amount!=null&&amount.signum()<0)throw error("INVALID_APPROVAL_REQUEST");
        String key=IdempotencySupport.requireKey(correlation);
        String hash=IdempotencySupport.fingerprint("APPROVAL_REQUEST|"+action+"|"+target+"|"+payload+"|"+amount+"|"+reason.trim());
        return idempotency.executeWithReplay("approval-request",key,actor,hash,
            ()->database.command("create",null,actor,action,target,payload,fingerprintFor(payload),amount,reason,riskFor(action,amount),key,false,Instant.now(clock)),
            ()->database.replayRequest(actor,key));
    }
    @Transactional public ApprovalDtos.Response approve(Long id,String actor){return approve(id,actor,"approval-approve-"+id);}
    @Transactional public ApprovalDtos.Response approve(Long id,String actor,String key){return decide("approve",id,actor,key);}
    @Transactional public ApprovalDtos.Response reject(Long id,String actor){return reject(id,actor,"approval-reject-"+id);}
    @Transactional public ApprovalDtos.Response reject(Long id,String actor,String key){return decide("reject",id,actor,key);}
    private ApprovalDtos.Response decide(String command,Long id,String actor,String key){
        String principal=SecurityActor.requireBoundActor(actor);
        String hash=IdempotencySupport.fingerprint("APPROVAL_"+command.toUpperCase()+"|"+id);
        return idempotency.executeWithReplay("approval-"+command,key,principal,hash,
            ()->database.command(command,id,principal,null,null,null,null,null,null,null,null,director(),Instant.now(clock)),
            ()->database.find(id).orElseThrow(()->error("APPROVAL_NOT_FOUND")));
    }
    @Transactional public List<ApprovalDtos.Response> list(String status){database.expire(Instant.now(clock));return database.list(selected(status),null,null);}
    @Transactional public List<ApprovalDtos.Response> requestedServicePriceChanges(String requester){
        String actor=SecurityActor.requireBoundActor(requester);database.expire(Instant.now(clock));return database.list(null,actor,"SERVICE_PRICE_CHANGE");
    }
    @Transactional public Page<ApprovalDtos.Response> page(String status,String action,String target,int page,int size){return page(status,action,target,null,null,null,null,page,size);}
    @Transactional public Page<ApprovalDtos.Response> page(String status,String action,String target,String requester,Instant from,Instant to,int page,int size){return page(status,action,target,requester,null,from,to,page,size);}
    @Transactional public Page<ApprovalDtos.Response> page(String status,String action,String target,String requester,String risk,Instant from,Instant to,int page,int size){
        database.expire(Instant.now(clock));String selectedRisk=risk==null||risk.isBlank()?null:risk.trim().toUpperCase();
        if(selectedRisk!=null&&!Set.of("LOW","MEDIUM","HIGH").contains(selectedRisk))throw error("INVALID_APPROVAL_RISK");
        return database.page(selected(status),action,target,requester,selectedRisk,from,to,Math.max(0,page),Math.max(1,Math.min(100,size)));
    }
    @Transactional public void requireApproved(String action,String target,String payload,BigDecimal amount,String actor){binding("require",action,target,payload,amount,actor);}
    @Transactional public ApprovalDtos.Response consumeApproved(String action,String target,String payload,BigDecimal amount,String actor){return binding("consume-requester",action,target,payload,amount,actor);}
    @Transactional public ApprovalDtos.Response consumeApprovedByApprover(String action,String target,String payload,BigDecimal amount,String actor){return binding("consume-approver",action,target,payload,amount,actor);}
    private ApprovalDtos.Response binding(String command,String action,String target,String payload,BigDecimal amount,String actor){
        String principal=SecurityActor.requireBoundActor(actor);requireText(action,"APPROVAL_REQUIRED");requireText(target,"APPROVAL_REQUIRED");requireText(payload,"APPROVAL_REQUIRED");
        return database.command(command,null,principal,action,target,null,fingerprintFor(payload),amount,null,null,null,false,Instant.now(clock));
    }
    @Transactional public void requireApproved(String action,String target,String actor){SecurityActor.requireBoundActor(actor);throw error("APPROVAL_PAYLOAD_REQUIRED");}
    @Transactional public void consumeApproved(String action,String target,String actor){SecurityActor.requireBoundActor(actor);throw error("APPROVAL_PAYLOAD_REQUIRED");}
    public static String fingerprintFor(String payload){
        if(payload==null||payload.isBlank())throw new IllegalArgumentException("payload must not be blank");
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(payload.getBytes(StandardCharsets.UTF_8)));}
        catch(NoSuchAlgorithmException error){throw new IllegalStateException("SHA-256 is required",error);}
    }
    private static String riskFor(String action,BigDecimal amount){
        if(Set.of("PAYMENT_REFUND","DEPOSIT_REFUND","INVOICE_DELETE").contains(action)||amount!=null&&amount.compareTo(new BigDecimal("10000000"))>=0)return "HIGH";
        if(Set.of("PRICE_OVERRIDE","BILLING_ADJUSTMENT","SERVICE_PRICE_CHANGE").contains(action)||amount!=null&&amount.compareTo(new BigDecimal("1000000"))>=0)return "MEDIUM";
        return "LOW";
    }
    private static String selected(String status){return status==null||status.isBlank()?"PENDING":status.toUpperCase();}
    private static void requireText(String value,String code){if(value==null||value.isBlank())throw error(code);}
    private static DomainException error(String code){return new DomainException(code,"Yêu cầu phê duyệt không hợp lệ: "+code);}
    private static boolean director(){var auth=SecurityContextHolder.getContext().getAuthentication();return auth!=null&&auth.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_DIRECTOR"));}
}

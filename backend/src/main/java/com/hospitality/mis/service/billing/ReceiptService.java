package com.hospitality.mis.service.billing;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.billing.*;
import com.hospitality.mis.dto.billing.ReceiptDtos;
import com.hospitality.mis.entity.billing.PaymentMethod;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.governance.*;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

/** Authorization around SQL-owned receipt issue and immutable read models. */
@Service
public class ReceiptService {
    private final ReceiptDatabase database;
    private final AuditService audit;
    private final DurableIdempotencyService durable;
    private final Clock clock;
    public ReceiptService(ReceiptDatabase database,AuditService audit,DurableIdempotencyService durable,Clock clock){this.database=database;this.audit=audit;this.durable=durable;this.clock=clock;}
    @Transactional public ReceiptDtos.Response issue(Long invoice,ReceiptDtos.CreateRequest request,String actor){return issue(invoice,request,actor,null);}
    @Transactional
    public ReceiptDtos.Response issue(Long invoice,ReceiptDtos.CreateRequest request,String actor,String key){
        if(request==null||request.receiptNumber()==null||request.receiptNumber().isBlank()||request.amount()==null||request.amount().signum()<=0||request.method()==null)
            throw new DomainException("INVALID_RECEIPT","Biên lai phải có số, số tiền và phương thức");
        String principal=SecurityActor.requireBoundActor(actor);var scope=database.invoice(invoice);requireScope(scope,principal);
        String hash=IdempotencySupport.fingerprint("RECEIPT|"+invoice+"|"+request.receiptNumber().trim()+"|"+request.amount()+"|"+request.method());
        return durable.execute("receipt-issue",key,principal,hash,ReceiptDtos.Response.class,()->{
            var saved=database.issue(invoice,request.receiptNumber().trim(),request.amount(),request.method(),principal,LocalDateTime.now(clock));
            audit.record(principal,"RECEIPT_ISSUED","RECEIPT",String.valueOf(saved.id()),null,request.amount().toPlainString(),"TENDER:"+request.method().name());
            return saved;
        });
    }
    @Transactional(readOnly=true)
    public List<ReceiptDtos.Response> listByInvoice(Long invoice){var scope=database.invoice(invoice);requireScope(scope,SecurityActor.currentActor());return database.page(invoice,null,null,null,null,0,100,true).items();}
    @Transactional(readOnly=true)
    public ReceiptDtos.PageResponse pageByInvoice(Long invoice,int page,int size){var scope=database.invoice(invoice);requireScope(scope,SecurityActor.currentActor());return database.page(invoice,null,null,null,null,page,size,true);}
    @Transactional(readOnly=true)
    public ReceiptDtos.PageResponse search(Long invoice,PaymentMethod method,String issuedBy,LocalDate from,LocalDate to,int page,int size){
        if(invoice!=null){var scope=database.invoice(invoice);requireScope(scope,SecurityActor.currentActor());}
        String actor=issuedBy==null||issuedBy.isBlank()?null:issuedBy.trim();
        return database.page(invoice,method,actor,from==null?null:from.atStartOfDay(),to==null?null:to.plusDays(1).atStartOfDay(),page,size,false);
    }
    private static void requireScope(PaymentDatabase.InvoiceScope scope,String actor){
        var auth=SecurityContextHolder.getContext().getAuthentication();
        boolean global=auth!=null&&auth.getAuthorities().stream().map(x->x.getAuthority()).anyMatch(x->Set.of("ROLE_ADMIN","ROLE_DIRECTOR","ROLE_MANAGER","ROLE_ACCOUNTING","ROLE_FRONT_DESK").contains(x));
        if(!global&&!Objects.equals(actor,scope.employeeId()))throw new AccessDeniedException("Không được phép thao tác ngoài phạm vi đặt phòng");
    }
}

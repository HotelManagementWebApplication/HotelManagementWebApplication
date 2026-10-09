package com.hospitality.mis.service.billing;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.billing.PaymentDatabase;
import com.hospitality.mis.dto.billing.PaymentTransactionDtos;
import com.hospitality.mis.entity.billing.*;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.governance.*;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

/** Authorization around the SQL-owned immutable payment/refund ledger. */
@Service
public class PaymentTransactionService {
    private final PaymentDatabase database;
    private final ApprovalService approvals;
    private final AuditService audit;
    private final DurableIdempotencyService durable;
    private final Clock clock;
    public PaymentTransactionService(PaymentDatabase database,ApprovalService approvals,AuditService audit,DurableIdempotencyService durable,Clock clock){
        this.database=database;this.approvals=approvals;this.audit=audit;this.durable=durable;this.clock=clock;
    }
    @Transactional
    public PaymentTransactionDtos.Response record(Long invoiceId,PaymentTransactionDtos.CreateRequest request,String actor,String key){
        if(request==null||request.amount()==null||request.amount().signum()<=0||request.method()==null||request.type()==null)
            throw new DomainException("INVALID_TRANSACTION","Giao dịch phải có số tiền, phương thức và loại");
        String principal=SecurityActor.requireBoundActor(actor);
        PaymentDatabase.InvoiceScope scope=database.invoice(invoiceId);requireScope(scope,principal);
        String normalized=IdempotencySupport.requireKey(key);
        if(normalized.length()>35||!normalized.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,34}"))
            throw new DomainException("IDEMPOTENCY_KEY_INVALID","Idempotency-Key chứa ký tự không hợp lệ");
        if(request.type()==PaymentTransaction.TransactionType.REFUND&&(request.reference()==null||request.reference().isBlank()))
            throw new DomainException("REFUND_REASON_REQUIRED","Refund phải có lý do");
        String canonicalReference="invoice:"+invoiceId+"|reference:"+(request.reference()==null?"":request.reference());
        String stored=PaymentTransaction.storageIdempotencyKey(normalized,principal,request.amount(),request.method(),request.type(),canonicalReference);
        String payload=request.type()==PaymentTransaction.TransactionType.REFUND?request.approvalPayload(invoiceId,normalized):"";
        String hash=IdempotencySupport.fingerprint("PAYMENT|"+invoiceId+"|"+request.amount().toPlainString()+"|"+request.method()+"|"+request.type()+"|"+canonicalReference);
        try{
            return durable.execute("payment-transaction",normalized,principal,hash,PaymentTransactionDtos.Response.class,()->{
                database.lock(invoiceId);
                Long approval=null;
                if(request.type()==PaymentTransaction.TransactionType.REFUND)
                    approval=approvals.consumeApproved("PAYMENT_REFUND",String.valueOf(invoiceId),payload,request.amount(),principal).id();
                var saved=database.record(request.type()==PaymentTransaction.TransactionType.PAYMENT?"payment":"refund",invoiceId,request.amount(),request.method(),
                    request.reference(),stored,principal,approval,LocalDateTime.now(clock));
                audit.record(principal,request.type()==PaymentTransaction.TransactionType.PAYMENT?"PAYMENT_RECORDED":"PAYMENT_REFUNDED",
                    "PAYMENT_TRANSACTION",String.valueOf(saved.id()),null,request.amount().toPlainString(),saved.reference());
                return saved;
            });
        }catch(DomainException error){
            if("IDEMPOTENCY_KEY_CONFLICT".equals(error.getCode()))
                throw new DomainException("IDEMPOTENCY_MISMATCH","Idempotency key đã được dùng cho payload khác");
            throw error;
        }
    }
    @Transactional(readOnly=true)
    public List<PaymentTransactionDtos.Response> listByInvoice(Long invoiceId){var scope=database.invoice(invoiceId);requireScope(scope,SecurityActor.currentActor());return database.list(invoiceId);}
    @Transactional(readOnly=true)
    public PaymentTransactionDtos.PageResponse pageByInvoice(Long invoiceId,int page,int size){var scope=database.invoice(invoiceId);requireScope(scope,SecurityActor.currentActor());return database.page(invoiceId,null,null,null,null,null,page,size,true);}
    @Transactional(readOnly=true)
    public PaymentTransactionDtos.LedgerPageResponse search(Long invoiceId,PaymentMethod method,PaymentTransaction.TransactionType type,PaymentTransaction.TransactionStatus status,LocalDate from,LocalDate to,String search,int page,int size){
        String actor=SecurityActor.currentActor();
        if(invoiceId!=null&&!globalRead()){var scope=database.invoice(invoiceId);requireScope(scope,actor);}
        if(from!=null&&to!=null&&from.isAfter(to))throw new DomainException("INVALID_DATE_RANGE","Ngày bắt đầu phải trước hoặc bằng ngày kết thúc");
        String query=search==null||search.isBlank()?null:search.trim();
        if(query!=null&&query.length()>200)throw new DomainException("INVALID_SEARCH_QUERY","Nội dung tìm kiếm tối đa 200 ký tự");
        return database.ledgerPage(invoiceId,method,type,status,from==null?null:from.atStartOfDay(),to==null?null:to.plusDays(1).atStartOfDay(),query,page,size);
    }
    private static void requireScope(PaymentDatabase.InvoiceScope scope,String actor){
        var auth=SecurityContextHolder.getContext().getAuthentication();
        boolean global=auth!=null&&auth.getAuthorities().stream().map(x->x.getAuthority()).anyMatch(x->Set.of("ROLE_ADMIN","ROLE_DIRECTOR","ROLE_MANAGER","ROLE_ACCOUNTING","ROLE_FRONT_DESK").contains(x));
        if(!global&&!Objects.equals(actor,scope.employeeId()))throw new AccessDeniedException("Không được phép thao tác ngoài phạm vi đặt phòng");
    }
    private static boolean globalRead(){
        var auth=SecurityContextHolder.getContext().getAuthentication();
        return auth!=null&&auth.getAuthorities().stream().anyMatch(a->Set.of("ROLE_ADMIN","ROLE_DIRECTOR","ROLE_MANAGER","ROLE_ACCOUNTING","ROLE_FRONT_DESK").contains(a.getAuthority()));
    }
}

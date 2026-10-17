package com.hospitality.mis.service.billing;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.billing.InvoiceDatabase;
import com.hospitality.mis.dto.billing.InvoiceDtos;
import com.hospitality.mis.entity.billing.*;
import com.hospitality.mis.middleware.security.*;
import com.hospitality.mis.service.governance.*;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

/** Authorization and exact approval binding; SQL owns invoice and checkout writes. */
@Service
public class BillingService {
    private final InvoiceDatabase database;
    private final ApprovalService approvals;
    private final DurableIdempotencyService durable;
    private final Clock clock;
    public BillingService(InvoiceDatabase database,ApprovalService approvals,DurableIdempotencyService durable,Clock clock){
        this.database=database;this.approvals=approvals;this.durable=durable;this.clock=clock;
    }
    @Transactional public InvoiceDtos.Response checkOut(Long reservation,LocalDateTime at,PaymentMethod method,String actor){
        String bound=SecurityActor.requireBoundActor(actor);ReservationAccess.requireOperator(bound);
        database.command("checkout",reservation,null,at,method,null,null,null,bound,null,null,null,LocalDateTime.now(clock));
        return database.reservation(reservation).response();
    }
    @Transactional public void registerDeposit(Long reservation,String actor){
        String bound=SecurityActor.requireBoundActor(actor);ReservationAccess.requireOperator(bound);
        database.command("deposit",reservation,null,null,null,null,null,null,bound,null,null,null,LocalDateTime.now(clock));
    }
    @Transactional public void settleCancellationDeposit(Long reservation,String actor){
        String bound=SecurityActor.requireBoundActor(actor);
        var invoice=database.reservation(reservation);scope(invoice,bound);
        refund(invoice,bound,"cancel-refund","CANCELLATION_DEPOSIT:"+reservation);
    }
    @Transactional(readOnly=true) public InvoiceDtos.Response getByReservation(Long id){var invoice=database.reservation(id);scope(invoice,SecurityActor.currentActor());return invoice.response();}
    @Transactional public InvoiceDtos.Response refundDeposit(Long reservation,String actor){
        String bound=SecurityActor.requireBoundActor(actor);
        var invoice=database.reservation(reservation);scope(invoice,bound);
        return refund(invoice,bound,"refund-deposit","DEPOSIT_REFUND:"+invoice.response().id());
    }
    private InvoiceDtos.Response refund(InvoiceDatabase.Snapshot invoice,String actor,String command,String key){
        long id=invoice.response().id();
        return durable.executeWithReplay("billing-"+command,key,actor,IdempotencySupport.fingerprint(command+"|"+id),()->{
            database.lock(id);var deposit=database.deposit(id);
            String payload=command.equals("cancel-refund")?key+":"+deposit.sourceId():"DEPOSIT_REFUND:"+id+":"+deposit.sourceId();
            Long customer=SecurityActor.currentPrincipal().isCustomer()?Long.parseLong(actor):null;
            Long approval=customer==null?approvals.consumeApproved("DEPOSIT_REFUND",Long.toString(id),payload,deposit.amount(),actor).id():null;
            database.command(command,null,id,null,null,null,null,"DR:"+ApprovalService.fingerprintFor(key),actor,approval,ApprovalService.fingerprintFor(payload),customer,LocalDateTime.now(clock));
            return database.get(id).response();
        },()->database.get(id).response());
    }
    @Transactional public InvoiceDtos.Response adjust(Long id,BigDecimal delta,String reason,String actor,String key){
        String bound=SecurityActor.requireBoundActor(actor);
        if(delta==null||delta.signum()==0||reason==null||reason.isBlank())throw new DomainException("INVALID_ADJUSTMENT","Điều chỉnh phải có số tiền khác 0 và lý do");
        String normalized=IdempotencySupport.requireKey(key);
        if(normalized.length()>35)throw new DomainException("INVALID_IDEMPOTENCY_KEY","Idempotency-Key không được vượt quá 35 ký tự");
        scope(database.get(id),bound);
        String payload="delta="+delta.stripTrailingZeros().toPlainString()+"|reason="+reason.trim();
        String hash=ApprovalService.fingerprintFor(id+"|"+bound+"|"+payload);
        try{return durable.executeWithReplay("billing-adjustment",normalized,bound,hash,()->{
            database.lock(id);
            Long approval=approvals.consumeApproved("BILLING_ADJUSTMENT",Long.toString(id),payload,delta.abs(),bound).id();
            database.command("adjust",null,id,null,null,delta,reason.trim(),normalized+"."+hash,bound,approval,ApprovalService.fingerprintFor(payload),null,LocalDateTime.now(clock));
            return database.get(id).response();
        },()->database.get(id).response());}
        catch(DomainException error){if("IDEMPOTENCY_KEY_CONFLICT".equals(error.getCode()))throw new DomainException("IDEMPOTENCY_MISMATCH","Idempotency-Key đã dùng cho điều chỉnh khác");throw error;}
    }
    @Transactional(readOnly=true) public InvoiceDtos.PageResponse list(int page,int size){SecurityActor.currentActor();return database.page(null,null,null,null,page,size);}
    @Transactional(readOnly=true) public InvoiceDtos.PageResponse list(PaymentStatus status,Long reservation,LocalDate from,LocalDate to,int page,int size){SecurityActor.currentActor();return database.page(status,reservation,from,to,page,size);}
    private static void scope(InvoiceDatabase.Snapshot invoice,String actor){
        var auth=SecurityContextHolder.getContext().getAuthentication();
        boolean global=auth!=null&&auth.getAuthorities().stream().anyMatch(a->Set.of("ROLE_ADMIN","ROLE_DIRECTOR","ROLE_MANAGER","ROLE_ACCOUNTING","ROLE_FRONT_DESK").contains(a.getAuthority()));
        boolean customer=SecurityActor.currentPrincipal().isCustomer()&&invoice.customerId()!=null&&invoice.customerId().toString().equals(actor);
        if(!global&&!customer&&!Objects.equals(actor,invoice.employeeId()))throw new AccessDeniedException("Không được phép thao tác ngoài phạm vi đặt phòng");
    }
}

package com.hospitality.mis.service.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.operations.RoomTransferDatabase;
import com.hospitality.mis.dto.operations.RoomTransferDtos;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.governance.DurableIdempotencyService;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;

/** Authorization and validation around the atomic SQL room-transfer command. */
@Service
public class RoomTransferService {
    private final RoomTransferDatabase database;
    private final DurableIdempotencyService durable;
    private final Clock clock;
    public RoomTransferService(RoomTransferDatabase database,DurableIdempotencyService durable,Clock clock){this.database=database;this.durable=durable;this.clock=clock;}
    @Transactional
    public RoomTransferDtos.Response transfer(Long reservationId,RoomTransferDtos.CreateRequest request,String suppliedActor,String key){
        String actor=authenticatedActor(suppliedActor);
        com.hospitality.mis.middleware.security.ReservationAccess.requireOperator(actor);
        if(request==null)throw new DomainException("INVALID_REQUEST","Thiếu nội dung chuyển phòng");
        if(request.fromRoomId().equals(request.toRoomId()))throw new DomainException("SAME_ROOM","Phòng chuyển đến phải khác phòng hiện tại");
        LocalDateTime now=LocalDateTime.now(clock),at=request.transferredAt()==null?now:request.transferredAt();
        String hash=IdempotencySupport.fingerprint("TRANSFER|"+reservationId+"|"+request.fromRoomId()+"|"+request.toRoomId()+"|"+request.transferredAt()+"|"+request.reason());
        return durable.execute("room-transfer",key,actor,hash,RoomTransferDtos.Response.class,
            ()->database.transfer(reservationId,request.fromRoomId(),request.toRoomId(),at,request.reason(),actor,now));
    }
    private static String authenticatedActor(String supplied){
        try{return SecurityActor.requireBoundActor(supplied);}
        catch(AuthenticationCredentialsNotFoundException error){throw new DomainException("ACTOR_REQUIRED","Thiếu actor đã xác thực");}
        catch(AccessDeniedException error){throw new DomainException("ACTOR_MISMATCH","Actor không khớp principal hiện tại");}
    }
}

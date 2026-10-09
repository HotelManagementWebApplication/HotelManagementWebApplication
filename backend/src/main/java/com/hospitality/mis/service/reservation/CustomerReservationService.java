package com.hospitality.mis.service.reservation;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.auth.CustomerAccountDatabase;
import com.hospitality.mis.dao.reservation.ReservationDatabase;
import com.hospitality.mis.dao.reservation.HotelServiceBookingDatabase;
import com.hospitality.mis.dto.reservation.*;
import com.hospitality.mis.entity.reservation.*;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.governance.DurableIdempotencyService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

/** Customer authorization and DTO mapping; SQL Server owns booking state and availability. */
@Service
public class CustomerReservationService {
    private final CustomerAccountDatabase accounts;
    private final ReservationDatabase database;
    private final HotelServiceBookingDatabase services;
    private final ReservationService reservations;
    private final DurableIdempotencyService idempotency;
    private final Clock clock;
    private final long holdMinutes;
    public CustomerReservationService(CustomerAccountDatabase accounts,ReservationDatabase database,
            HotelServiceBookingDatabase services,ReservationService reservations,DurableIdempotencyService idempotency,
            Clock clock,@Value("${hotel.booking.deposit-hold-minutes:30}") long holdMinutes){
        this.accounts=accounts;this.database=database;this.services=services;this.reservations=reservations;
        this.idempotency=idempotency;this.clock=clock;
        if(holdMinutes<=0)throw new IllegalArgumentException("deposit hold minutes must be positive");
        this.holdMinutes=holdMinutes;
    }

    @Transactional
    public CustomerReservationDtos.Response create(CustomerReservationDtos.CreateRequest request,String actor){
        long customer=customer(actor);
        if(request==null||request.rooms()==null||request.rooms().isEmpty()||request.rentalType()==null||request.paymentMethod()==null)
            throw error("INVALID_REQUEST","Booking phải có phòng, hình thức thuê và thanh toán");
        if(request.rooms().size()>3)throw error("ROOM_LIMIT_EXCEEDED","Mỗi booking chỉ được đặt tối đa 3 phòng");
        var rooms=request.rooms().stream().map(r->new ReservationDtos.RoomStay(r.roomId(),r.expectedCheckIn(),r.expectedCheckOut(),r.guestCount())).toList();
        ReservationService.validateRooms(rooms);
        String key=IdempotencySupport.requireKey(request.idempotencyKey());
        String source=request.bookingSource()==null||request.bookingSource().isBlank()?"DIRECT":request.bookingSource().trim().toUpperCase(Locale.ROOT);
        String hash=IdempotencySupport.fingerprint("CUSTOMER_CREATE|"+request.rentalType()+"|"+source+"|"+request.paymentMethod()+"|"
                +(request.confirmationEmail()==null?"":request.confirmationEmail().trim().toLowerCase(Locale.ROOT))+"|"+ReservationService.canonicalRooms(rooms));
        return idempotency.executeWithReplay("customer-reservation-create",key,actor,hash,()->{
            var account=accounts.find(customer).orElseThrow(()->error("CUSTOMER_ACCOUNT_NOT_FOUND","Không tìm thấy tài khoản khách hàng"));
            LocalDateTime now=LocalDateTime.now(clock);boolean online=request.paymentMethod()==CustomerPaymentMethod.VNPAY;
            long id=database.create(account.guestId(),null,customer,request.rentalType(),null,key,rooms,"customer:"+actor,now,
                ReservationStatus.DRAFT,request.paymentMethod(),online?newPaymentCode():null,online?now.plusMinutes(holdMinutes):null,
                request.confirmationEmail()==null?null:request.confirmationEmail().trim(),source);
            return response(database.customer(id,customer));
        },()->response(database.customer(database.byKey(key).response().id(),customer)));
    }

    @Transactional(readOnly=true)
    public List<CustomerReservationDtos.Response> list(String actor){return database.customers(customer(actor)).stream().map(this::response).toList();}
    @Transactional(readOnly=true)
    public CustomerReservationDtos.Response get(Long id,String actor){return response(database.customer(id,customer(actor)));}
    @Transactional(readOnly=true)
    public CustomerReservationDtos.PaymentInstruction payment(Long id,String actor){return get(id,actor).depositPayment();}
    @Transactional
    public CustomerReservationDtos.Response cancel(Long id,ReservationDtos.CancelRequest request,String actor,String key){
        long customer=customer(actor);reservations.cancelForCustomer(id,request,actor,key);return response(database.customer(id,customer));
    }
    @Transactional
    public CustomerReservationDtos.Response changeStay(Long id,CustomerReservationDtos.ChangeRequest request,String actor,String key){
        long customer=customer(actor);
        if(request==null||request.type()==null||request.newCheckOut()==null)throw error("INVALID_CHANGE_REQUEST","Thiếu thông tin thay đổi lịch");
        String hash=IdempotencySupport.fingerprint("CUSTOMER_STAY_CHANGE|"+id+"|"+request.type()+"|"+request.newCheckIn()+"|"+request.newCheckOut());
        return idempotency.executeWithReplay("customer-reservation-stay-change",key,actor,hash,()->{
            LocalDateTime now=LocalDateTime.now(clock);
            database.command(request.type()==CustomerReservationDtos.ChangeType.EXTEND?"customer-extend":"customer-reschedule",id,customer,null,
                request.newCheckOut(),request.newCheckIn(),null,null,null,null,newPaymentCode(),now.plusMinutes(holdMinutes),"customer:"+actor,now);
            return response(database.customer(id,customer));
        },()->response(database.customer(id,customer)));
    }

    private CustomerReservationDtos.Response response(ReservationDatabase.Snapshot snapshot){
        var r=snapshot.response();var status=r.depositPaymentStatus();
        if(status==DepositPaymentStatus.PENDING&&snapshot.expiresAt()!=null&&!snapshot.expiresAt().isAfter(LocalDateTime.now(clock)))status=DepositPaymentStatus.EXPIRED;
        String instruction=snapshot.pendingType()!=null?"Thanh toán phần cọc bổ sung để hoàn tất gia hạn; booking gốc vẫn được giữ.":
            r.customerPaymentMethod()==CustomerPaymentMethod.PAY_AT_HOTEL?"Yêu cầu đang chờ lễ tân xác nhận; phòng chưa được giữ trước khi xác nhận.":"Thanh toán 50% tiền cọc qua cổng VNPay để xác nhận giữ phòng.";
        var payment=new CustomerReservationDtos.PaymentInstruction(snapshot.paymentCode(),snapshot.pendingType()==null?r.deposit():snapshot.additionalDeposit(),status,snapshot.expiresAt(),instruction);
        var bookings=services.reservationServices(r.id());
        BigDecimal total=snapshot.customerRooms().stream().map(CustomerReservationDtos.RoomLine::totalPrice).reduce(BigDecimal.ZERO,BigDecimal::add)
            .add(bookings.stream().filter(b->!"CANCELLED".equals(b.status())).map(HotelServiceBookingService.Response::amountDue).reduce(BigDecimal.ZERO,BigDecimal::add));
        var pending=snapshot.pendingType()==null?null:new CustomerReservationDtos.PendingChange(CustomerReservationDtos.ChangeType.EXTEND,
            snapshot.previousCheckIn(),snapshot.previousCheckOut(),r.rooms().get(0).expectedCheckIn(),r.rooms().get(0).expectedCheckOut(),snapshot.additionalDeposit(),snapshot.expiresAt());
        return new CustomerReservationDtos.Response(r.id(),r.status(),r.rentalType(),r.bookingSource(),r.deposit(),total,r.bookedAt(),snapshot.customerRooms(),payment,bookings,r.cancellationReason(),r.cancellationOutcome(),pending);
    }
    private static long customer(String actor){var principal=SecurityActor.currentPrincipal();
        if(!principal.isCustomer()||!principal.id().equals(actor))throw error("CUSTOMER_REQUIRED","Customer principal required");return Long.parseLong(actor);}
    private static String newPaymentCode(){return "HOS-"+UUID.randomUUID().toString().replace("-","").substring(0,12).toUpperCase(Locale.ROOT);}
    private static DomainException error(String code,String text){return new DomainException(code,text);}
}

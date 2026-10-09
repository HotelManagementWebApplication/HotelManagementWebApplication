package com.hospitality.mis.service.reservation;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.reservation.HotelServiceBookingDatabase;
import com.hospitality.mis.middleware.security.SecurityActor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

/** Authorization and API mapping; SQL Server owns service allowance, inventory and audit. */
@Service
public class HotelServiceBookingService {
    private final HotelServiceBookingDatabase database;
    private final Clock clock;

    public HotelServiceBookingService(HotelServiceBookingDatabase database, Clock clock) {
        this.database = database;
        this.clock = clock;
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Request(Long reservationId, String roomId, String serviceId, LocalDateTime scheduledAt,
                          Integer quantity, String mealPeriod, String note) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Response(Long id, Long reservationId, String roomId, String serviceId, String serviceName,
                           LocalDateTime scheduledAt, int quantity, int freeQuantity, BigDecimal unitPrice,
                           BigDecimal amountDue, String mealPeriod, String status, String note) {
        public Response(Long id, Long reservationId, String roomId, String serviceId, LocalDateTime scheduledAt,
                        int quantity, int freeQuantity, BigDecimal unitPrice, BigDecimal amountDue,
                        String mealPeriod, String status, String note) {
            this(id,reservationId,roomId,serviceId,serviceId,scheduledAt,quantity,freeQuantity,unitPrice,amountDue,mealPeriod,status,note);
        }
    }

    public Response bookForCustomer(Request request, String key) {
        var principal = customer();
        return book(request,key,"customer:"+principal.id(),Long.valueOf(principal.id()),false,LocalDateTime.now(clock));
    }

    @Transactional(readOnly = true)
    public List<Response> customerBookings(long reservationId) {
        return database.list(reservationId,Long.valueOf(customer().id()));
    }

    @Transactional(readOnly = true)
    public List<Response> staffBookings(long reservationId) { return database.list(reservationId,null); }

    @Transactional(readOnly = true)
    public List<Response> restaurantBookings(LocalDate date, String status) {
        String normalized = status==null || status.isBlank() ? null : databaseBookingStatus(status.trim().toUpperCase(Locale.ROOT));
        return database.restaurant(date==null ? LocalDate.now(clock) : date,normalized);
    }

    public Response markRestaurantUsed(long id, String actor) {
        SecurityActor.requireBoundActor(actor);
        return database.use(database.find(id).reservationId(),id,actor,LocalDateTime.now(clock));
    }

    public Response recordAtFrontDesk(Request request, String key, String actor) {
        SecurityActor.requireBoundActor(actor);
        LocalDateTime now=LocalDateTime.now(clock);
        return book(request,key,actor,null,true,now);
    }

    public Response markUsed(long reservationId, long bookingId, String actor) {
        SecurityActor.requireBoundActor(actor);
        return database.use(reservationId,bookingId,actor,LocalDateTime.now(clock));
    }

    public void cancelForReservation(long reservationId, String actor) { database.cancelReservation(reservationId,actor); }

    @Transactional(readOnly = true)
    public BigDecimal usedTotal(long reservationId) { return database.usedTotal(reservationId); }

    public Response cancelForCustomer(long id) {
        var principal=customer();
        return database.cancel(id,"customer:"+principal.id(),Long.parseLong(principal.id()));
    }

    private Response book(Request request, String key, String actor, Long owner, boolean atDesk, LocalDateTime now) {
        if (request==null || request.reservationId()==null || request.roomId()==null || request.serviceId()==null
                || (request.scheduledAt()==null && !atDesk) || request.quantity()==null || request.quantity()<1)
            throw new DomainException("INVALID_SERVICE_BOOKING","Thiếu thông tin đặt dịch vụ");
        String requestKey=IdempotencySupport.requireKey(key);
        String meal=request.mealPeriod()==null ? null : request.mealPeriod().trim().toUpperCase(Locale.ROOT);
        if ("MAMREST".equals(request.serviceId())) {
            if (!"LUNCH".equals(meal) && !"DINNER".equals(meal)) throw new DomainException("MEAL_PERIOD_REQUIRED","Chọn bữa trưa hoặc bữa tối");
        } else if (meal!=null) throw new DomainException("INVALID_MEAL_PERIOD","Dịch vụ này không dùng loại bữa ăn");
        if ("POOL".equals(request.serviceId()) && !atDesk) throw new DomainException("POOL_WALK_IN_ONLY","Hồ bơi chỉ cần xem thông tin, không đặt trước");
        String fingerprint=IdempotencySupport.fingerprint(request.reservationId()+"|"+request.roomId()+"|"+request.serviceId()+"|"
                +request.scheduledAt()+"|"+request.quantity()+"|"+meal+"|"+request.note());
        Request normalized=request.scheduledAt()==null
                ?new Request(request.reservationId(),request.roomId(),request.serviceId(),now,request.quantity(),request.mealPeriod(),request.note())
                :request;
        return database.book(normalized,databaseMealPeriod(meal),requestKey,fingerprint,actor,owner,atDesk,now);
    }

    private SecurityActor.Principal customer() {
        var principal=SecurityActor.currentPrincipal();
        if (!principal.isCustomer()) throw new DomainException("CUSTOMER_REQUIRED","Chỉ khách hàng được thao tác dịch vụ của mình");
        return principal;
    }

    public static Response response(java.sql.ResultSet rs) throws java.sql.SQLException {
        BigDecimal price=rs.getBigDecimal("donGia");
        int quantity=rs.getInt("soLuong"), free=rs.getInt("soLuongMienPhi");
        String name=rs.getString("tenDichVu");
        if (name==null || name.isBlank()) name=rs.getString("maDichVu");
        return new Response(rs.getLong("maDatDichVuKhachSan"),rs.getLong("maPhieuDatPhong"),rs.getString("maPhong"),rs.getString("maDichVu"),
                name,rs.getTimestamp("thoiDiemDuKien").toLocalDateTime(),quantity,free,price,price.multiply(BigDecimal.valueOf(quantity-free)),
                mealPeriodCode(rs.getString("buoiAn")),bookingStatusCode(rs.getString("trangThai")),rs.getString("ghiChu"));
    }

    public static String bookingStatusCode(String value) {
        if (value==null) return null;
        return switch(value) { case "Đã xác nhận" -> "CONFIRMED"; case "Đã sử dụng" -> "USED"; case "Đã hủy" -> "CANCELLED";
            default -> throw new IllegalArgumentException("Trạng thái đặt dịch vụ không hợp lệ: "+value); };
    }

    public static String mealPeriodCode(String value) {
        if (value==null) return null;
        return switch(value) { case "Bữa trưa" -> "LUNCH"; case "Bữa tối" -> "DINNER";
            default -> throw new IllegalArgumentException("Buổi ăn không hợp lệ: "+value); };
    }

    private static String databaseBookingStatus(String value) {
        return switch(value) { case "CONFIRMED" -> "Đã xác nhận"; case "USED" -> "Đã sử dụng"; case "CANCELLED" -> "Đã hủy";
            default -> throw new DomainException("INVALID_STATUS","Trạng thái dịch vụ không hợp lệ"); };
    }

    private static String databaseMealPeriod(String value) {
        if(value==null)return null;
        return switch(value){case "LUNCH"->"Bữa trưa";case "DINNER"->"Bữa tối";
            default->throw new DomainException("INVALID_MEAL_PERIOD","Buổi ăn không hợp lệ");};
    }
}

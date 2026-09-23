package com.hospitality.mis.service.reservation;

import com.hospitality.mis.common.exception.DomainException;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.governance.AuditService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Đặt trước dịch vụ do khách sạn vận hành, giữ hạn mức miễn phí theo phòng và ngày. */
@Service
public class HotelServiceBookingService {
    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private final Clock clock;

    public HotelServiceBookingService(JdbcTemplate jdbc, AuditService audit, Clock clock) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.clock = clock;
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Request(Long reservationId, String roomId, String serviceId, LocalDateTime scheduledAt,
                          Integer quantity, String mealPeriod, String note) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Response(Long id, Long reservationId, String roomId, String serviceId, String serviceName,
                           LocalDateTime scheduledAt,
                           int quantity, int freeQuantity, BigDecimal unitPrice, BigDecimal amountDue,
                           String mealPeriod, String status, String note) {
        public Response(Long id, Long reservationId, String roomId, String serviceId, LocalDateTime scheduledAt,
                        int quantity, int freeQuantity, BigDecimal unitPrice, BigDecimal amountDue,
                        String mealPeriod, String status, String note) {
            this(id, reservationId, roomId, serviceId, serviceId, scheduledAt, quantity, freeQuantity, unitPrice, amountDue, mealPeriod, status, note);
        }
    }

    @Transactional
    public Response bookForCustomer(Request request, String key) {
        SecurityActor.Principal principal = SecurityActor.currentPrincipal();
        if (!principal.isCustomer()) throw new DomainException("CUSTOMER_REQUIRED", "Chỉ khách hàng được đặt dịch vụ trên web");
        return book(request, key, "customer:" + principal.id(), Long.valueOf(principal.id()), false);
    }

    @Transactional(readOnly = true)
    public List<Response> customerBookings(long reservationId) {
        SecurityActor.Principal principal = SecurityActor.currentPrincipal();
        if (!principal.isCustomer()) throw new DomainException("CUSTOMER_REQUIRED", "Chỉ khách hàng được xem dịch vụ của mình");
        Integer owned = jdbc.queryForObject("SELECT COUNT(*) FROM reservations WHERE id=? AND customer_account_id=?",
                Integer.class, reservationId, Long.valueOf(principal.id()));
        if (owned == null || owned == 0) throw new DomainException("RESERVATION_NOT_FOUND", "Không tìm thấy đặt phòng");
        return jdbc.query("""
                SELECT b.id, b.reservation_id, b.room_id, b.service_id, COALESCE(s.name, b.service_id) AS service_name,
                       b.scheduled_at, b.quantity, b.free_quantity, b.unit_price, b.meal_period, b.status, b.note
                FROM hotel_service_bookings b
                LEFT JOIN services s ON b.service_id = s.id
                WHERE b.reservation_id = ?
                ORDER BY b.scheduled_at, b.id
                """, (rs, n) -> response(rs), reservationId);
    }

    @Transactional(readOnly = true)
    public List<Response> staffBookings(long reservationId) {
        Integer exists = jdbc.queryForObject("SELECT COUNT(*) FROM reservations WHERE id=?", Integer.class, reservationId);
        if (exists == null || exists == 0) throw new DomainException("RESERVATION_NOT_FOUND", "Không tìm thấy đặt phòng");
        return jdbc.query("""
                SELECT b.id, b.reservation_id, b.room_id, b.service_id, COALESCE(s.name, b.service_id) AS service_name,
                       b.scheduled_at, b.quantity, b.free_quantity, b.unit_price, b.meal_period, b.status, b.note
                FROM hotel_service_bookings b
                LEFT JOIN services s ON b.service_id = s.id
                WHERE b.reservation_id = ?
                ORDER BY b.scheduled_at, b.id
                """, (rs, n) -> response(rs), reservationId);
    }

    /** Danh sách đơn ăn uống để bộ phận Bếp & F&B điều phối theo ngày và trạng thái. */
    @Transactional(readOnly = true)
    public List<Response> restaurantBookings(LocalDate date, String status) {
        LocalDate businessDate = date == null ? LocalDate.now(clock) : date;
        String normalizedStatus = status == null || status.isBlank() ? null : status.trim().toUpperCase();
        String sql = """
                SELECT b.id, b.reservation_id, b.room_id, b.service_id, COALESCE(s.name, b.service_id) AS service_name,
                       b.scheduled_at, b.quantity, b.free_quantity, b.unit_price, b.meal_period, b.status, b.note
                FROM hotel_service_bookings b
                LEFT JOIN services s ON b.service_id = s.id
                WHERE DATE(b.scheduled_at) = ?
                  AND (b.service_id IN ('MAMREST','BREAKFAST') OR s.category = 'fine-dining')
                """ + (normalizedStatus == null ? "" : " AND b.status = ?\n")
                + "ORDER BY b.scheduled_at, b.room_id, b.id";
        return normalizedStatus == null
                ? jdbc.query(sql, (rs, n) -> response(rs), businessDate)
                : jdbc.query(sql, (rs, n) -> response(rs), businessDate, normalizedStatus);
    }

    /** Xác nhận một đơn nhà hàng đã phục vụ, dùng chung quy tắc tồn kho và hóa đơn hiện hữu. */
    @Transactional
    public Response markRestaurantUsed(long bookingId, String actor) {
        Long reservationId = jdbc.queryForObject("SELECT reservation_id FROM hotel_service_bookings WHERE id=?", Long.class, bookingId);
        if (reservationId == null) throw new DomainException("SERVICE_BOOKING_NOT_FOUND", "Không tìm thấy đơn nhà hàng");
        return markUsed(reservationId, bookingId, actor);
    }

    @Transactional
    public Response recordAtFrontDesk(Request request, String key, String actor) {
        SecurityActor.requireBoundActor(actor);
        // A front-desk entry represents something that has already been consumed.  Capture
        // "now" exactly once: otherwise the persisted timestamp can be fractionally later
        // than the second clock read in markUsed and be incorrectly rejected as not due.
        LocalDateTime recordedAt = LocalDateTime.now(clock);
        Request normalized = new Request(request.reservationId(), request.roomId(), request.serviceId(),
                request.scheduledAt() == null ? recordedAt : request.scheduledAt(), request.quantity(),
                request.mealPeriod(), request.note());
        Response booked = book(normalized, key, actor, null, true);
        return markUsed(booked.reservationId(), booked.id(), actor, recordedAt);
    }

    @Transactional
    public Response markUsed(long reservationId, long bookingId, String actor) {
        return markUsed(reservationId, bookingId, actor, LocalDateTime.now(clock));
    }

    private Response markUsed(long reservationId, long bookingId, String actor, LocalDateTime evaluatedAt) {
        SecurityActor.requireBoundActor(actor);
        String status = jdbc.queryForObject("SELECT status FROM reservations WHERE id=? FOR UPDATE", String.class, reservationId);
        if (!"CHECKED_IN".equals(status)) throw new DomainException("INVALID_STATE", "Khách phải nhận phòng trước khi dùng dịch vụ");
        Response booking = find(bookingId);
        if (booking.reservationId() != reservationId) throw new DomainException("SERVICE_BOOKING_NOT_FOUND", "Không tìm thấy dịch vụ trong booking");
        if ("USED".equals(booking.status())) return booking;
        if (!"CONFIRMED".equals(booking.status())) throw new DomainException("INVALID_STATE", "Dịch vụ đã bị hủy");
        if (booking.scheduledAt().isAfter(evaluatedAt))
            throw new DomainException("SERVICE_NOT_DUE", "Chưa đến thời gian sử dụng dịch vụ");
        int stockChanged = jdbc.update("UPDATE services SET stock_quantity=stock_quantity-? WHERE id=? AND stock_quantity>=? AND active=TRUE",
                booking.quantity(), booking.serviceId(), booking.quantity());
        if (stockChanged != 1) throw new DomainException("INSUFFICIENT_STOCK", "Dịch vụ đã hết khả dụng");
        jdbc.update("UPDATE hotel_service_bookings SET status='USED',used_at=?,used_by=? WHERE id=? AND status='CONFIRMED'",
                LocalDateTime.now(clock), actor, bookingId);
        jdbc.update("INSERT INTO inventory_movements(service_id,type,quantity,actor_id,occurred_at,reason) VALUES (?,'ISSUE',?,?,?,?)",
                booking.serviceId(), booking.quantity(), actor, LocalDateTime.now(clock), "HOTEL_SERVICE_BOOKING:" + bookingId);
        audit.record(actor, "HOTEL_SERVICE_USED", "RESERVATION", String.valueOf(reservationId), null,
                String.valueOf(bookingId), null);
        return find(bookingId);
    }

    @Transactional
    public void cancelForReservation(long reservationId, String actor) {
        if (!hasBookingTable()) return;
        int count = jdbc.update("UPDATE hotel_service_bookings SET status='CANCELLED' WHERE reservation_id=? AND status='CONFIRMED'",
                reservationId);
        if (count > 0) audit.record(actor, "HOTEL_SERVICES_CANCELLED", "RESERVATION", String.valueOf(reservationId),
                null, String.valueOf(count), null);
    }

    @Transactional(readOnly = true)
    public BigDecimal usedTotal(long reservationId) {
        if (!hasBookingTable()) return BigDecimal.ZERO;
        BigDecimal total = jdbc.queryForObject("SELECT COALESCE(SUM((quantity-free_quantity)*unit_price),0) FROM hotel_service_bookings WHERE reservation_id=? AND status='USED'",
                BigDecimal.class, reservationId);
        return total == null ? BigDecimal.ZERO : total;
    }

    @Transactional
    public Response cancelForCustomer(long id) {
        SecurityActor.Principal principal = SecurityActor.currentPrincipal();
        if (!principal.isCustomer()) throw new DomainException("CUSTOMER_REQUIRED", "Chỉ khách hàng được hủy dịch vụ của mình");
        Response booking = find(id);
        Integer owned = jdbc.queryForObject("SELECT COUNT(*) FROM reservations WHERE id=? AND customer_account_id=?",
                Integer.class, booking.reservationId(), Long.valueOf(principal.id()));
        if (owned == null || owned == 0) throw new DomainException("SERVICE_BOOKING_NOT_FOUND", "Không tìm thấy dịch vụ");
        if ("USED".equals(booking.status())) throw new DomainException("INVALID_STATE", "Dịch vụ đã sử dụng không thể hủy");
        if ("CONFIRMED".equals(booking.status())) {
            jdbc.update("UPDATE hotel_service_bookings SET status='CANCELLED' WHERE id=? AND status='CONFIRMED'", id);
            audit.record("customer:" + principal.id(), "HOTEL_SERVICE_CANCELLED", "RESERVATION",
                    String.valueOf(booking.reservationId()), null, String.valueOf(id), null);
        }
        return find(id);
    }

    private Response book(Request request, String key, String actor, Long customerAccountId, boolean atDesk) {
        if (request == null || request.reservationId() == null || request.roomId() == null || request.serviceId() == null
                || request.scheduledAt() == null || request.quantity() == null || request.quantity() < 1)
            throw new DomainException("INVALID_SERVICE_BOOKING", "Thiếu thông tin đặt dịch vụ");
        String requestKey = IdempotencySupport.requireKey(key);
        String meal = request.mealPeriod() == null ? null : request.mealPeriod().trim().toUpperCase();
        if ("MAMREST".equals(request.serviceId())) {
            if (!"LUNCH".equals(meal) && !"DINNER".equals(meal))
                throw new DomainException("MEAL_PERIOD_REQUIRED", "Chọn bữa trưa hoặc bữa tối");
        } else if (meal != null) throw new DomainException("INVALID_MEAL_PERIOD", "Dịch vụ này không dùng loại bữa ăn");
        if ("POOL".equals(request.serviceId()) && !atDesk)
            throw new DomainException("POOL_WALK_IN_ONLY", "Hồ bơi chỉ cần xem thông tin, không đặt trước");
        String fingerprint = IdempotencySupport.fingerprint(request.reservationId() + "|" + request.roomId() + "|"
                + request.serviceId() + "|" + request.scheduledAt() + "|" + request.quantity() + "|" + meal + "|" + request.note());
        List<Response> replay = jdbc.query("SELECT id,reservation_id,room_id,service_id,scheduled_at,quantity,free_quantity,unit_price,meal_period,status,note FROM hotel_service_bookings WHERE request_key=?",
                (rs, n) -> response(rs), requestKey);
        if (!replay.isEmpty()) {
            String bound = jdbc.queryForObject("SELECT request_hash FROM hotel_service_bookings WHERE id=?", String.class, replay.get(0).id());
            String creator = jdbc.queryForObject("SELECT created_by FROM hotel_service_bookings WHERE id=?", String.class, replay.get(0).id());
            if (!fingerprint.equals(bound) || !actor.equals(creator)) throw new DomainException("IDEMPOTENCY_KEY_CONFLICT", "Mã yêu cầu đã dùng cho thao tác khác");
            return replay.get(0);
        }
        var rows = jdbc.query("""
                SELECT r.status,r.rental_type,r.deposit_payment_status,rr.check_in,rr.check_out,rr.guest_count
                FROM reservations r JOIN reservation_rooms rr ON rr.reservation_id=r.id
                WHERE r.id=? AND rr.room_id=? AND (? IS NULL OR r.customer_account_id=?) FOR UPDATE
                """, (rs, n) -> new Stay(rs.getString(1), rs.getString(2), rs.getString(3),
                rs.getTimestamp(4).toLocalDateTime(), rs.getTimestamp(5).toLocalDateTime(), rs.getInt(6)),
                request.reservationId(), request.roomId(), customerAccountId, customerAccountId);
        if (rows.isEmpty()) throw new DomainException("RESERVATION_NOT_FOUND", "Không tìm thấy phòng trong booking của khách");
        Stay stay = rows.get(0);
        if (!("DEPOSIT_PAID".equals(stay.status()) || "CONFIRMED".equals(stay.status()) || "CHECKED_IN".equals(stay.status())))
            throw new DomainException("INVALID_STATE", "Booking chưa xác nhận tiền cọc");
        if (customerAccountId != null && !"PAID".equals(stay.depositStatus()))
            throw new DomainException("DEPOSIT_NOT_PAID", "Cần xác nhận tiền cọc trước khi đặt dịch vụ");
        if (atDesk && !"CHECKED_IN".equals(stay.status()))
            throw new DomainException("INVALID_STATE", "Khách chưa nhận phòng");
        if (request.scheduledAt().isBefore(stay.checkIn()) || !request.scheduledAt().isBefore(stay.checkOut()))
            throw new DomainException("SERVICE_OUTSIDE_STAY", "Thời gian dịch vụ phải nằm trong kỳ lưu trú");
        var catalog = jdbc.query("SELECT price,stock_quantity FROM services WHERE id=? AND active=TRUE",
                (rs, n) -> new Catalog(rs.getBigDecimal(1), rs.getInt(2)), request.serviceId());
        if (catalog.isEmpty()) throw new DomainException("SERVICE_NOT_FOUND", "Dịch vụ không còn phục vụ");
        Catalog service = catalog.get(0);
        if (service.price().signum() <= 0) throw new DomainException("SERVICE_PRICE_NOT_SET", "Dịch vụ chưa có giá niêm yết");
        if (service.stock() < request.quantity()) throw new DomainException("INSUFFICIENT_STOCK", "Dịch vụ đã hết khả dụng");
        int allowance = "PACKAGE".equals(stay.rentalType()) ? switch (request.serviceId()) {
            case "BREAKFAST", "MAMREST" -> stay.guestCount();
            case "LNDRYSTD" -> 1;
            case "POOL" -> stay.guestCount();
            default -> 0;
        } : 0;
        int free = 0;
        if (allowance > 0) {
            if ("POOL".equals(request.serviceId())) {
                free = Math.min(request.quantity(), allowance); // Unlimited visits; only registered guests are free.
            } else {
                Integer allocated = jdbc.queryForObject("""
                        SELECT COALESCE(SUM(free_quantity),0) FROM hotel_service_bookings
                        WHERE reservation_id=? AND room_id=? AND service_id=? AND DATE(scheduled_at)=?
                          AND (meal_period=? OR (meal_period IS NULL AND ? IS NULL))
                          AND status IN ('CONFIRMED','USED')
                        """, Integer.class, request.reservationId(), request.roomId(), request.serviceId(),
                        LocalDate.from(request.scheduledAt()), meal, meal);
                int historicalFree = 0;
                if ("BREAKFAST".equals(request.serviceId()) || "LNDRYSTD".equals(request.serviceId())) {
                    Integer legacy = jdbc.queryForObject("""
                            SELECT COALESCE(SUM(quantity),0) FROM service_usages
                            WHERE reservation_id=? AND service_id=? AND used_on=? AND unit_price=0
                            """, Integer.class, request.reservationId(), request.serviceId(),
                            LocalDate.from(request.scheduledAt()));
                    historicalFree = legacy == null ? 0 : legacy;
                }
                free = Math.min(request.quantity(), Math.max(0, allowance - (allocated == null ? 0 : allocated) - historicalFree));
            }
        }
        jdbc.update("""
                INSERT INTO hotel_service_bookings(reservation_id,room_id,service_id,scheduled_at,meal_period,
                    quantity,free_quantity,unit_price,status,note,request_key,request_hash,created_by)
                VALUES (?,?,?,?,?,?,?,?,'CONFIRMED',?,?,?,?)
                """, request.reservationId(), request.roomId(), request.serviceId(), request.scheduledAt(), meal,
                request.quantity(), free, service.price(), request.note(), requestKey, fingerprint, actor);
        Long id = jdbc.queryForObject("SELECT id FROM hotel_service_bookings WHERE request_key=?", Long.class, requestKey);
        audit.record(actor, "HOTEL_SERVICE_BOOKED", "RESERVATION", String.valueOf(request.reservationId()),
                null, String.valueOf(id), null);
        return find(id);
    }

    private Response find(long id) {
        List<Response> rows = jdbc.query("""
                SELECT b.id, b.reservation_id, b.room_id, b.service_id, COALESCE(s.name, b.service_id) AS service_name,
                       b.scheduled_at, b.quantity, b.free_quantity, b.unit_price, b.meal_period, b.status, b.note
                FROM hotel_service_bookings b
                LEFT JOIN services s ON b.service_id = s.id
                WHERE b.id = ?
                """, (rs, n) -> response(rs), id);
        if (rows.isEmpty()) throw new DomainException("SERVICE_BOOKING_NOT_FOUND", "Không tìm thấy dịch vụ");
        return rows.get(0);
    }

    private static Response response(java.sql.ResultSet rs) throws java.sql.SQLException {
        BigDecimal price = rs.getBigDecimal("unit_price");
        int quantity = rs.getInt("quantity");
        int free = rs.getInt("free_quantity");
        String serviceName;
        try {
            serviceName = rs.getString("service_name");
        } catch (java.sql.SQLException e) {
            serviceName = rs.getString("service_id");
        }
        if (serviceName == null || serviceName.isBlank()) {
            serviceName = rs.getString("service_id");
        }
        return new Response(rs.getLong("id"), rs.getLong("reservation_id"), rs.getString("room_id"),
                rs.getString("service_id"), serviceName, rs.getTimestamp("scheduled_at").toLocalDateTime(), quantity, free,
                price, price.multiply(BigDecimal.valueOf(quantity - free)), rs.getString("meal_period"),
                rs.getString("status"), rs.getString("note"));
    }

    private record Stay(String status, String rentalType, String depositStatus, LocalDateTime checkIn,
                        LocalDateTime checkOut, int guestCount) {}
    private record Catalog(BigDecimal price, int stock) {}

    /** Các test nghiệp vụ cũ dùng H2/JPA schema trước V39; khi đó không có bảng mới. */
    private boolean hasBookingTable() {
        Boolean exists = jdbc.execute((org.springframework.jdbc.core.ConnectionCallback<Boolean>) connection -> {
            try (var tables = connection.getMetaData().getTables(null, null, "hotel_service_bookings", new String[]{"TABLE"})) {
                return tables.next();
            }
        });
        return Boolean.TRUE.equals(exists);
    }
}

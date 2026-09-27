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
        Integer owned = jdbc.queryForObject("SELECT COUNT(*) FROM PhieuDatPhong WHERE maPhieuDatPhong=? AND maTaiKhoanKhachHang=?",
                Integer.class, reservationId, Long.valueOf(principal.id()));
        if (owned == null || owned == 0) throw new DomainException("RESERVATION_NOT_FOUND", "Không tìm thấy đặt phòng");
        return jdbc.query("""
                SELECT b.maDatDichVuKhachSan, b.maPhieuDatPhong, b.maPhong, b.maDichVu, COALESCE(s.ten, b.maDichVu) AS service_name,
                       b.thoiDiemDuKien, b.soLuong, b.soLuongMienPhi, b.donGia, b.buoiAn, b.trangThai, b.ghiChu
                FROM DatDichVuKhachSan b
                LEFT JOIN DichVu s ON b.maDichVu = s.maDichVu
                WHERE b.maPhieuDatPhong = ?
                ORDER BY b.thoiDiemDuKien, b.maDatDichVuKhachSan
                """, (rs, n) -> response(rs), reservationId);
    }

    @Transactional(readOnly = true)
    public List<Response> staffBookings(long reservationId) {
        Integer exists = jdbc.queryForObject("SELECT COUNT(*) FROM PhieuDatPhong WHERE maPhieuDatPhong=?", Integer.class, reservationId);
        if (exists == null || exists == 0) throw new DomainException("RESERVATION_NOT_FOUND", "Không tìm thấy đặt phòng");
        return jdbc.query("""
                SELECT b.maDatDichVuKhachSan, b.maPhieuDatPhong, b.maPhong, b.maDichVu, COALESCE(s.ten, b.maDichVu) AS service_name,
                       b.thoiDiemDuKien, b.soLuong, b.soLuongMienPhi, b.donGia, b.buoiAn, b.trangThai, b.ghiChu
                FROM DatDichVuKhachSan b
                LEFT JOIN DichVu s ON b.maDichVu = s.maDichVu
                WHERE b.maPhieuDatPhong = ?
                ORDER BY b.thoiDiemDuKien, b.maDatDichVuKhachSan
                """, (rs, n) -> response(rs), reservationId);
    }

    /** Danh sách đơn ăn uống để bộ phận Bếp & F&B điều phối theo ngày và trạng thái. */
    @Transactional(readOnly = true)
    public List<Response> restaurantBookings(LocalDate date, String status) {
        LocalDate businessDate = date == null ? LocalDate.now(clock) : date;
        String normalizedStatus = status == null || status.isBlank() ? null : status.trim().toUpperCase();
        String sql = """
                SELECT b.maDatDichVuKhachSan, b.maPhieuDatPhong, b.maPhong, b.maDichVu, COALESCE(s.ten, b.maDichVu) AS service_name,
                       b.thoiDiemDuKien, b.soLuong, b.soLuongMienPhi, b.donGia, b.buoiAn, b.trangThai, b.ghiChu
                FROM DatDichVuKhachSan b
                LEFT JOIN DichVu s ON b.maDichVu = s.maDichVu
                WHERE CAST(b.thoiDiemDuKien AS DATE) = ?
                  AND (b.maDichVu IN ('MAMREST','BREAKFAST') OR s.danhMuc = N'Nhà hàng cao cấp')
                """ + (normalizedStatus == null ? "" : " AND b.trangThai = ?\n")
                + "ORDER BY b.thoiDiemDuKien, b.maPhong, b.maDatDichVuKhachSan";
        return normalizedStatus == null
                ? jdbc.query(sql, (rs, n) -> response(rs), businessDate)
                : jdbc.query(sql, (rs, n) -> response(rs), businessDate, databaseBookingStatus(normalizedStatus));
    }

    /** Xác nhận một đơn nhà hàng đã phục vụ, dùng chung quy tắc tồn kho và hóa đơn hiện hữu. */
    @Transactional
    public Response markRestaurantUsed(long bookingId, String actor) {
        Long reservationId = jdbc.queryForObject("SELECT maPhieuDatPhong FROM DatDichVuKhachSan WHERE maDatDichVuKhachSan=?", Long.class, bookingId);
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
        String status = jdbc.queryForObject(lockReservationSql(), String.class, reservationId);
        if (!"Đã nhận phòng".equals(status)) throw new DomainException("INVALID_STATE", "Khách phải nhận phòng trước khi dùng dịch vụ");
        Response booking = find(bookingId);
        if (booking.reservationId() != reservationId) throw new DomainException("SERVICE_BOOKING_NOT_FOUND", "Không tìm thấy dịch vụ trong booking");
        if ("USED".equals(booking.status())) return booking;
        if (!"CONFIRMED".equals(booking.status())) throw new DomainException("INVALID_STATE", "Dịch vụ đã bị hủy");
        if (booking.scheduledAt().isAfter(evaluatedAt))
            throw new DomainException("SERVICE_NOT_DUE", "Chưa đến thời gian sử dụng dịch vụ");
        int stockChanged = jdbc.update("UPDATE DichVu SET soLuongTonKho=soLuongTonKho-? WHERE maDichVu=? AND soLuongTonKho>=? AND dangHoatDong=1",
                booking.quantity(), booking.serviceId(), booking.quantity());
        if (stockChanged != 1) throw new DomainException("INSUFFICIENT_STOCK", "Dịch vụ đã hết khả dụng");
        jdbc.update("UPDATE DatDichVuKhachSan SET trangThai=N'Đã sử dụng',thoiDiemSuDung=?,nguoiXacNhanSuDung=? WHERE maDatDichVuKhachSan=? AND trangThai=N'Đã xác nhận'",
                LocalDateTime.now(clock), actor, bookingId);
        jdbc.update("INSERT INTO BienDongKhoDichVu(maDichVu,loai,soLuong,maNguoiThucHien,thoiDiemPhatSinh,lyDo) VALUES (?,N'Xuất kho',?,?,?,?)",
                booking.serviceId(), booking.quantity(), actor, LocalDateTime.now(clock), "HOTEL_SERVICE_BOOKING:" + bookingId);
        audit.record(actor, "HOTEL_SERVICE_USED", "RESERVATION", String.valueOf(reservationId), null,
                String.valueOf(bookingId), null);
        return find(bookingId);
    }

    @Transactional
    public void cancelForReservation(long reservationId, String actor) {
        if (!hasBookingTable()) return;
        int count = jdbc.update("UPDATE DatDichVuKhachSan SET trangThai=N'Đã hủy' WHERE maPhieuDatPhong=? AND trangThai=N'Đã xác nhận'",
                reservationId);
        if (count > 0) audit.record(actor, "HOTEL_SERVICES_CANCELLED", "RESERVATION", String.valueOf(reservationId),
                null, String.valueOf(count), null);
    }

    @Transactional(readOnly = true)
    public BigDecimal usedTotal(long reservationId) {
        if (!hasBookingTable()) return BigDecimal.ZERO;
        BigDecimal total = jdbc.queryForObject("SELECT COALESCE(SUM((soLuong-soLuongMienPhi)*donGia),0) FROM DatDichVuKhachSan WHERE maPhieuDatPhong=? AND trangThai=N'Đã sử dụng'",
                BigDecimal.class, reservationId);
        return total == null ? BigDecimal.ZERO : total;
    }

    @Transactional
    public Response cancelForCustomer(long id) {
        SecurityActor.Principal principal = SecurityActor.currentPrincipal();
        if (!principal.isCustomer()) throw new DomainException("CUSTOMER_REQUIRED", "Chỉ khách hàng được hủy dịch vụ của mình");
        Response booking = find(id);
        Integer owned = jdbc.queryForObject("SELECT COUNT(*) FROM PhieuDatPhong WHERE maPhieuDatPhong=? AND maTaiKhoanKhachHang=?",
                Integer.class, booking.reservationId(), Long.valueOf(principal.id()));
        if (owned == null || owned == 0) throw new DomainException("SERVICE_BOOKING_NOT_FOUND", "Không tìm thấy dịch vụ");
        if ("USED".equals(booking.status())) throw new DomainException("INVALID_STATE", "Dịch vụ đã sử dụng không thể hủy");
        if ("CONFIRMED".equals(booking.status())) {
            jdbc.update("UPDATE DatDichVuKhachSan SET trangThai=N'Đã hủy' WHERE maDatDichVuKhachSan=? AND trangThai=N'Đã xác nhận'", id);
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
        List<Response> replay = jdbc.query("SELECT maDatDichVuKhachSan,maPhieuDatPhong,maPhong,maDichVu,thoiDiemDuKien,soLuong,soLuongMienPhi,donGia,buoiAn,trangThai,ghiChu FROM DatDichVuKhachSan WHERE khoaYeuCau=?",
                (rs, n) -> response(rs), requestKey);
        if (!replay.isEmpty()) {
            String bound = jdbc.queryForObject("SELECT maBamYeuCau FROM DatDichVuKhachSan WHERE maDatDichVuKhachSan=?", String.class, replay.get(0).id());
            String creator = jdbc.queryForObject("SELECT nguoiTao FROM DatDichVuKhachSan WHERE maDatDichVuKhachSan=?", String.class, replay.get(0).id());
            if (!fingerprint.equals(bound) || !actor.equals(creator)) throw new DomainException("IDEMPOTENCY_KEY_CONFLICT", "Mã yêu cầu đã dùng cho thao tác khác");
            return replay.get(0);
        }
        String staySql = """
                SELECT r.trangThai,r.hinhThucThue,r.trangThaiThanhToanCoc,rr.thoiDiemNhanPhong,rr.thoiDiemTraPhong,rr.soLuongKhach
                FROM PhieuDatPhong r WITH (UPDLOCK, ROWLOCK)
                JOIN ChiTietDatPhong rr WITH (UPDLOCK, ROWLOCK) ON rr.maPhieuDatPhong=r.maPhieuDatPhong
                WHERE r.maPhieuDatPhong=? AND rr.maPhong=? AND (? IS NULL OR r.maTaiKhoanKhachHang=?)
                """;
        var rows = jdbc.query(staySql, (rs, n) -> new Stay(rs.getString(1), rs.getString(2), rs.getString(3),
                rs.getTimestamp(4).toLocalDateTime(), rs.getTimestamp(5).toLocalDateTime(), rs.getInt(6)),
                request.reservationId(), request.roomId(), customerAccountId, customerAccountId);
        if (rows.isEmpty()) throw new DomainException("RESERVATION_NOT_FOUND", "Không tìm thấy phòng trong booking của khách");
        Stay stay = rows.get(0);
        if (!("Đã thanh toán cọc".equals(stay.status()) || "Đã xác nhận".equals(stay.status()) || "Đã nhận phòng".equals(stay.status())))
            throw new DomainException("INVALID_STATE", "Booking chưa xác nhận tiền cọc");
        if (customerAccountId != null && !"Đã thanh toán".equals(stay.depositStatus()))
            throw new DomainException("DEPOSIT_NOT_PAID", "Cần xác nhận tiền cọc trước khi đặt dịch vụ");
        if (atDesk && !"Đã nhận phòng".equals(stay.status()))
            throw new DomainException("INVALID_STATE", "Khách chưa nhận phòng");
        if (request.scheduledAt().isBefore(stay.checkIn()) || !request.scheduledAt().isBefore(stay.checkOut()))
            throw new DomainException("SERVICE_OUTSIDE_STAY", "Thời gian dịch vụ phải nằm trong kỳ lưu trú");
        var catalog = jdbc.query("SELECT gia,soLuongTonKho FROM DichVu WHERE maDichVu=? AND dangHoatDong=1",
                (rs, n) -> new Catalog(rs.getBigDecimal(1), rs.getInt(2)), request.serviceId());
        if (catalog.isEmpty()) throw new DomainException("SERVICE_NOT_FOUND", "Dịch vụ không còn phục vụ");
        Catalog service = catalog.get(0);
        if (service.price().signum() <= 0) throw new DomainException("SERVICE_PRICE_NOT_SET", "Dịch vụ chưa có giá niêm yết");
        if (service.stock() < request.quantity()) throw new DomainException("INSUFFICIENT_STOCK", "Dịch vụ đã hết khả dụng");
        int allowance = "Theo gói".equals(stay.rentalType()) ? switch (request.serviceId()) {
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
                        SELECT COALESCE(SUM(soLuongMienPhi),0) FROM DatDichVuKhachSan
                        WHERE maPhieuDatPhong=? AND maPhong=? AND maDichVu=? AND CAST(thoiDiemDuKien AS DATE)=?
                          AND (buoiAn=? OR (buoiAn IS NULL AND ? IS NULL))
                          AND trangThai IN (N'Đã xác nhận',N'Đã sử dụng')
                        """, Integer.class, request.reservationId(), request.roomId(), request.serviceId(),
                        LocalDate.from(request.scheduledAt()), meal, meal);
                int historicalFree = 0;
                if ("BREAKFAST".equals(request.serviceId()) || "LNDRYSTD".equals(request.serviceId())) {
                    Integer legacy = jdbc.queryForObject("""
                            SELECT COALESCE(SUM(soLuong),0) FROM SuDungDichVu
                            WHERE maPhieuDatPhong=? AND maDichVu=? AND ngaySuDung=? AND donGia=0
                            """, Integer.class, request.reservationId(), request.serviceId(),
                            LocalDate.from(request.scheduledAt()));
                    historicalFree = legacy == null ? 0 : legacy;
                }
                free = Math.min(request.quantity(), Math.max(0, allowance - (allocated == null ? 0 : allocated) - historicalFree));
            }
        }
        jdbc.update("""
                INSERT INTO DatDichVuKhachSan(maPhieuDatPhong,maPhong,maDichVu,thoiDiemDuKien,buoiAn,
                    soLuong,soLuongMienPhi,donGia,trangThai,ghiChu,khoaYeuCau,maBamYeuCau,nguoiTao)
                VALUES (?,?,?,?,?,?,?,? ,N'Đã xác nhận',?,?,?,?)
                """, request.reservationId(), request.roomId(), request.serviceId(), request.scheduledAt(), databaseMealPeriod(meal),
                request.quantity(), free, service.price(), request.note(), requestKey, fingerprint, actor);
        Long id = jdbc.queryForObject("SELECT maDatDichVuKhachSan FROM DatDichVuKhachSan WHERE khoaYeuCau=?", Long.class, requestKey);
        audit.record(actor, "HOTEL_SERVICE_BOOKED", "RESERVATION", String.valueOf(request.reservationId()),
                null, String.valueOf(id), null);
        return find(id);
    }

    private Response find(long id) {
        List<Response> rows = jdbc.query("""
                SELECT b.maDatDichVuKhachSan, b.maPhieuDatPhong, b.maPhong, b.maDichVu, COALESCE(s.ten, b.maDichVu) AS service_name,
                       b.thoiDiemDuKien, b.soLuong, b.soLuongMienPhi, b.donGia, b.buoiAn, b.trangThai, b.ghiChu
                FROM DatDichVuKhachSan b
                LEFT JOIN DichVu s ON b.maDichVu = s.maDichVu
                WHERE b.maDatDichVuKhachSan = ?
                """, (rs, n) -> response(rs), id);
        if (rows.isEmpty()) throw new DomainException("SERVICE_BOOKING_NOT_FOUND", "Không tìm thấy dịch vụ");
        return rows.get(0);
    }

    private static Response response(java.sql.ResultSet rs) throws java.sql.SQLException {
        BigDecimal price = rs.getBigDecimal("donGia");
        int quantity = rs.getInt("soLuong");
        int free = rs.getInt("soLuongMienPhi");
        String serviceName;
        try {
            serviceName = rs.getString("service_name");
        } catch (java.sql.SQLException e) {
            serviceName = rs.getString("maDichVu");
        }
        if (serviceName == null || serviceName.isBlank()) {
            serviceName = rs.getString("maDichVu");
        }
        return new Response(rs.getLong("maDatDichVuKhachSan"), rs.getLong("maPhieuDatPhong"), rs.getString("maPhong"),
                rs.getString("maDichVu"), serviceName, rs.getTimestamp("thoiDiemDuKien").toLocalDateTime(), quantity, free,
                price, price.multiply(BigDecimal.valueOf(quantity - free)), mealPeriodCode(rs.getString("buoiAn")),
                bookingStatusCode(rs.getString("trangThai")), rs.getString("ghiChu"));
    }

    public static String bookingStatusCode(String databaseValue) {
        if (databaseValue == null) return null;
        return switch (databaseValue) {
            case "Đã xác nhận" -> "CONFIRMED";
            case "Đã sử dụng" -> "USED";
            case "Đã hủy" -> "CANCELLED";
            default -> throw new IllegalArgumentException("Trạng thái đặt dịch vụ không hợp lệ: " + databaseValue);
        };
    }

    public static String mealPeriodCode(String databaseValue) {
        if (databaseValue == null) return null;
        return switch (databaseValue) {
            case "Bữa trưa" -> "LUNCH";
            case "Bữa tối" -> "DINNER";
            default -> throw new IllegalArgumentException("Buổi ăn không hợp lệ: " + databaseValue);
        };
    }

    private static String databaseBookingStatus(String apiCode) {
        return switch (apiCode) {
            case "CONFIRMED" -> "Đã xác nhận";
            case "USED" -> "Đã sử dụng";
            case "CANCELLED" -> "Đã hủy";
            default -> throw new DomainException("INVALID_STATUS", "Trạng thái dịch vụ không hợp lệ");
        };
    }

    private static String databaseMealPeriod(String apiCode) {
        if (apiCode == null) return null;
        return switch (apiCode) {
            case "LUNCH" -> "Bữa trưa";
            case "DINNER" -> "Bữa tối";
            default -> throw new DomainException("INVALID_MEAL_PERIOD", "Buổi ăn không hợp lệ");
        };
    }

    private record Stay(String status, String rentalType, String depositStatus, LocalDateTime checkIn,
                        LocalDateTime checkOut, int guestCount) {}
    private record Catalog(BigDecimal price, int stock) {}

    private String lockReservationSql() {
        return "SELECT trangThai FROM PhieuDatPhong WITH (UPDLOCK, ROWLOCK) WHERE maPhieuDatPhong=?";
    }

    /** Các test nghiệp vụ cũ dùng H2/JPA schema trước V39; khi đó không có bảng mới. */
    private boolean hasBookingTable() {
        Boolean exists = jdbc.execute((org.springframework.jdbc.core.ConnectionCallback<Boolean>) connection -> {
            try (var tables = connection.getMetaData().getTables(null, null, "DatDichVuKhachSan", new String[]{"TABLE"})) {
                return tables.next();
            }
        });
        return Boolean.TRUE.equals(exists);
    }
}

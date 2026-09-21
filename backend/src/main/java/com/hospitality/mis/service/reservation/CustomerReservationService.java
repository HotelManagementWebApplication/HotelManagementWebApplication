package com.hospitality.mis.service.reservation;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.auth.CustomerAccountRepository;
import com.hospitality.mis.dao.reservation.ReservationRepository;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.dto.reservation.CustomerReservationDtos;
import com.hospitality.mis.dto.reservation.ReservationDtos;
import com.hospitality.mis.entity.auth.CustomerAccount;
import com.hospitality.mis.entity.guest.BookingPolicy;
import com.hospitality.mis.entity.guest.Guest;
import com.hospitality.mis.entity.reservation.DepositPaymentStatus;
import com.hospitality.mis.entity.reservation.Reservation;
import com.hospitality.mis.entity.reservation.ReservationRoom;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomStatus;
import com.hospitality.mis.entity.room.RoomTypeCatalogStatus;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.governance.AuditService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.Clock;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Use case booking online, tách khỏi command đặt phòng của nhân viên. */
@Service
public class CustomerReservationService {
    private static final List<ReservationStatus> IGNORED =
            List.of(ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW, ReservationStatus.CHECKED_OUT);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final CustomerAccountRepository accounts;
    private final ReservationRepository reservations;
    private final RoomRepository rooms;
    private final AuditService audit;
    private final BookingPolicy bookingPolicy = BookingPolicy.defaults();
    private final long depositHoldMinutes;
    private Clock clock = Clock.system(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));

    public CustomerReservationService(CustomerAccountRepository accounts, ReservationRepository reservations,
                                      RoomRepository rooms, AuditService audit,
                                      @Value("${hotel.booking.deposit-hold-minutes:15}") long depositHoldMinutes) {
        this.accounts = accounts;
        this.reservations = reservations;
        this.rooms = rooms;
        this.audit = audit;
        if (depositHoldMinutes <= 0) throw new IllegalArgumentException("deposit hold minutes must be positive");
        this.depositHoldMinutes = depositHoldMinutes;
    }

    @org.springframework.beans.factory.annotation.Autowired
    void setBusinessClock(Clock clock) { this.clock = clock; }

    /** Tạo booking ở trạng thái DRAFT và phát hành hướng dẫn cọc đang chờ xác nhận. */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public CustomerReservationDtos.Response create(CustomerReservationDtos.CreateRequest request,
                                                    String actor) {
        SecurityActor.Principal principal = SecurityActor.currentPrincipal();
        if (!principal.isCustomer() || !principal.id().equals(actor)) throw new DomainException("CUSTOMER_REQUIRED", "Customer principal required");
        if (request == null || request.rooms() == null || request.rooms().isEmpty()) throw error("INVALID_REQUEST", "Booking phải có ít nhất một phòng");
        String key = IdempotencySupport.requireKey(request.idempotencyKey());
        String fingerprint = fingerprint(request);
        var prior = reservations.findByIdempotencyKey(key);
        if (prior.isPresent()) return retryOrConflict(prior.get(), principal.id(), fingerprint);
        if (request.rooms().size() > 3) throw error("ROOM_LIMIT_EXCEEDED", "Mỗi booking chỉ được đặt tối đa 3 phòng");

        CustomerAccount account = accounts.findByIdWithGuest(Long.valueOf(principal.id()))
                .orElseThrow(() -> error("CUSTOMER_ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản khách hàng"));
        Guest guest = account.getGuest();
        if (!bookingPolicy.allows(guest)) throw error("GUEST_BOOKING_BLOCKED", "Tài khoản không được phép đặt phòng");
        Set<String> ids = new HashSet<>();
        for (var line : request.rooms()) {
            if (!line.expectedCheckIn().isBefore(line.expectedCheckOut())) throw error("INVALID_INTERVAL", "Thời gian nhận phải trước thời gian trả");
            if (!ids.add(line.roomId().trim())) throw error("DUPLICATE_ROOM", "Không được lặp phòng trong một booking");
        }
        Map<String, Room> locked = lockRooms(ids);
        for (var line : request.rooms()) {
            Room room = locked.get(line.roomId().trim());
            if (room.getRoomType().getCatalogStatus() != RoomTypeCatalogStatus.ACTIVE)
                throw error("ROOM_TYPE_NOT_ACTIVE", "Loại phòng chưa được phê duyệt: " + room.getRoomType().getId());
            if (room.getStatus().blocksAvailability()) throw error("ROOM_NOT_AVAILABLE", "Phòng không sẵn sàng: " + room.getId());
            if (reservations.hasOverlap(room.getId(), line.expectedCheckIn(), line.expectedCheckOut(), RoomStatus.CANCELLED, IGNORED))
                throw error("OVERBOOKING", "Phòng đã có lịch trùng: " + room.getId());
        }

        prior = reservations.findByIdempotencyKey(key);
        if (prior.isPresent()) return retryOrConflict(prior.get(), principal.id(), fingerprint);
        Reservation reservation = new Reservation();
        reservation.setBookedAt(LocalDateTime.now(clock));
        reservation.setGuest(guest);
        reservation.setCustomerAccount(account);
        reservation.setDepositAmount(requiredDeposit(request, locked));
        reservation.setRentalType(request.rentalType().name());
        reservation.setBookingSource(request.bookingSource());
        reservation.setIdempotencyKey(key);
        reservation.setCanonicalRequestFingerprint(fingerprint);
        reservation.setDepositPaymentCode(newPaymentCode());
        reservation.setDepositPaymentStatus(DepositPaymentStatus.PENDING);
        reservation.setDepositPaymentExpiresAt(LocalDateTime.now(clock).plusMinutes(depositHoldMinutes));
        request.rooms().forEach(line -> {
            ReservationRoom rr = new ReservationRoom();
            rr.setRoom(locked.get(line.roomId().trim()));
            rr.setCheckIn(line.expectedCheckIn());
            rr.setCheckOut(line.expectedCheckOut());
            rr.setStatus(RoomStatus.RESERVED);
            reservation.addRoom(rr);
        });
        try {
            Reservation saved = reservations.saveAndFlush(reservation);
            audit.record("customer:" + principal.id(), "CUSTOMER_RESERVATION_CREATED", "RESERVATION",
                    String.valueOf(saved.getId()), null, saved.getStatus().name(), fingerprint);
            return toResponse(saved);
        } catch (DataIntegrityViolationException ex) {
            var duplicate = reservations.findByIdempotencyKey(key);
            if (duplicate.isPresent()) return retryOrConflict(duplicate.get(), principal.id(), fingerprint);
            throw ex;
        }
    }

    @Transactional(readOnly = true)
    public List<CustomerReservationDtos.Response> list(String actor) {
        long accountId = customerAccountId(actor);
        return reservations.findCustomerDetails(accountId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public CustomerReservationDtos.Response get(Long id, String actor) {
        return toResponse(reservations.findCustomerDetails(id, customerAccountId(actor))
                .orElseThrow(() -> error("RESERVATION_NOT_FOUND", "Không tìm thấy booking")));
    }

    @Transactional(readOnly = true)
    public CustomerReservationDtos.PaymentInstruction payment(Long id, String actor) {
        return get(id, actor).depositPayment();
    }

    private long customerAccountId(String actor) {
        SecurityActor.Principal principal = SecurityActor.currentPrincipal();
        if (!principal.isCustomer() || !principal.id().equals(actor)) throw new DomainException("CUSTOMER_REQUIRED", "Customer principal required");
        return Long.parseLong(actor);
    }

    private CustomerReservationDtos.Response retryOrConflict(Reservation reservation, String actor, String fingerprint) {
        CustomerAccount owner = reservation.getCustomerAccount();
        if (owner == null || !Long.valueOf(actor).equals(owner.getId()) || !fingerprint.equals(reservation.getCanonicalRequestFingerprint()))
            throw error("IDEMPOTENCY_KEY_CONFLICT", "Idempotency key đã được dùng cho yêu cầu khác");
        return toResponse(reservation);
    }

    private Map<String, Room> lockRooms(Set<String> ids) {
        Map<String, Room> locked = new HashMap<>();
        for (Room room : rooms.findAllForUpdateOrdered(ids.stream().sorted().toList())) locked.put(room.getId(), room);
        for (String id : ids) if (!locked.containsKey(id)) throw error("ROOM_NOT_FOUND", "Không tìm thấy phòng: " + id);
        return locked;
    }

    private BigDecimal requiredDeposit(CustomerReservationDtos.CreateRequest request, Map<String, Room> locked) {
        BigDecimal total = BigDecimal.ZERO;
        for (var line : request.rooms()) {
            BigDecimal dailyPrice = locked.get(line.roomId().trim()).getRoomType().getDailyPrice();
            long minutes = Math.max(1, Duration.between(line.expectedCheckIn(), line.expectedCheckOut()).toMinutes());
            long units = request.rentalType() == ReservationDtos.RentalType.HOURLY
                    ? Math.max(3, (minutes + 59) / 60) : Math.max(1, (minutes + 1439) / 1440);
            BigDecimal charge = request.rentalType() == ReservationDtos.RentalType.HOURLY
                    ? hourlyCharge(locked.get(line.roomId().trim()), dailyPrice, units)
                    : dailyPrice.multiply(BigDecimal.valueOf(units));
            total = total.add(charge);
        }
        return total.multiply(new BigDecimal("0.50")).setScale(2, java.math.RoundingMode.HALF_UP);
    }

    /** Tiền thuê theo giờ phải dùng đúng hourly_price đã công khai trong catalog. */
    private BigDecimal hourlyCharge(Room room, BigDecimal dailyPrice, long units) {
        BigDecimal hourlyPrice = room.getRoomType().getHourlyPrice();
        if (hourlyPrice == null || hourlyPrice.signum() <= 0)
            hourlyPrice = dailyPrice.divide(BigDecimal.valueOf(24), 2, java.math.RoundingMode.HALF_UP);
        return hourlyPrice.multiply(BigDecimal.valueOf(units));
    }

    private String newPaymentCode() {
        return "HOS-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
    }

    private String fingerprint(CustomerReservationDtos.CreateRequest request) {
        String rooms = request.rooms().stream().map(x -> x.roomId().trim() + "@" + x.expectedCheckIn() + "/" + x.expectedCheckOut())
                .sorted().reduce((a, b) -> a + ";" + b).orElse("");
        return IdempotencySupport.fingerprint("CUSTOMER_CREATE|rental=" + request.rentalType().name()
                + "|source=" + normalizedBookingSource(request.bookingSource()) + "|rooms=" + rooms);
    }

    private String normalizedBookingSource(String source) {
        return source == null || source.isBlank() ? "DIRECT" : source.trim().toUpperCase(Locale.ROOT);
    }

    private CustomerReservationDtos.Response toResponse(Reservation r) {
        DepositPaymentStatus paymentStatus = r.getDepositPaymentStatus();
        if (paymentStatus == DepositPaymentStatus.PENDING && r.getDepositPaymentExpiresAt() != null
                && !r.getDepositPaymentExpiresAt().isAfter(LocalDateTime.now(clock))) paymentStatus = DepositPaymentStatus.EXPIRED;
        var payment = new CustomerReservationDtos.PaymentInstruction(r.getDepositPaymentCode(), r.getDepositAmount(),
                paymentStatus, r.getDepositPaymentExpiresAt(),
                "Dùng mã này khi thanh toán tiền cọc tại kênh thanh toán của khách sạn.");
        return new CustomerReservationDtos.Response(r.getId(), r.getStatus(), ReservationDtos.RentalType.valueOf(r.getRentalType()),
                r.getBookingSource(),
                r.getDepositAmount(), r.getBookedAt(), r.getRooms().stream()
                .map(x -> new CustomerReservationDtos.RoomLine(x.getRoom().getId(), x.getCheckIn(), x.getCheckOut())).toList(), payment);
    }

    private DomainException error(String code, String message) { return new DomainException(code, message); }
}

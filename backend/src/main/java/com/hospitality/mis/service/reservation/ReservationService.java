package com.hospitality.mis.service.reservation;
import com.hospitality.mis.dto.billing.InvoiceDtos;

import com.hospitality.mis.entity.reservation.Reservation;

import com.hospitality.mis.entity.reservation.ReservationRoom;

import com.hospitality.mis.entity.reservation.ReservationStatus;


import com.hospitality.mis.service.billing.BillingService;
import com.hospitality.mis.dao.billing.ServiceLineRepository;
import com.hospitality.mis.dao.billing.ServiceRepository;
import com.hospitality.mis.dao.billing.InvoiceRepository;
import com.hospitality.mis.dao.billing.PaymentTransactionRepository;
import com.hospitality.mis.dao.billing.ReceiptRepository;
import com.hospitality.mis.entity.billing.ServiceUsage;
import com.hospitality.mis.entity.billing.ServiceUsageId;
import com.hospitality.mis.entity.billing.Service;
import com.hospitality.mis.dao.operations.InventoryMovementRepository;
import com.hospitality.mis.entity.operations.InventoryMovement;
import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.dto.governance.AuditDtos;
import com.hospitality.mis.service.governance.DurableIdempotencyService;
import com.hospitality.mis.dao.guest.GuestStore;
import com.hospitality.mis.dao.identity.EmployeeRepository;
import com.hospitality.mis.entity.guest.Guest;
import com.hospitality.mis.entity.guest.BookingPolicy;
import com.hospitality.mis.entity.identity.Employee;
import com.hospitality.mis.dao.reservation.ReservationRepository;
import com.hospitality.mis.dto.reservation.ReservationDtos;
import com.hospitality.mis.entity.reservation.*;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomStatus;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.beans.factory.annotation.Value;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.middleware.security.ReservationAccess;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.Clock;
import java.util.*;

/**
 * Điều phối toàn bộ vòng đời đặt phòng từ tạo, nhận/trả phòng đến hủy, gia hạn,
 * no-show và cộng dịch vụ. Các mutation khóa booking/phòng cần thiết, dùng
 * fingerprint + IdempotencySupport cho retry và ủy quyền giá/thanh toán cho policy/service sở hữu.
 */
@org.springframework.stereotype.Service
public class ReservationService {
    /** Các trạng thái không còn chiếm lịch khi kiểm tra overlap. */
    private static final List<ReservationStatus> IGNORED = List.of(ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW, ReservationStatus.CHECKED_OUT);
    /** Kho booking, hỗ trợ khóa bản ghi và kiểm tra overlap. */
    private final ReservationRepository reservations; private final GuestStore sharedGuests; private final EmployeeRepository employees;
    /** Kho phòng, audit và service thanh toán của booking. */
    private final RoomRepository rooms; private final AuditService audit; private final BillingService billing;
    /** Danh mục dịch vụ, dòng sử dụng và sổ xuất kho khi khách dùng dịch vụ. */
    private final ServiceRepository serviceCatalog; private final ServiceLineRepository serviceLines;
    private final InventoryMovementRepository inventoryMovements;
    /** Fallback only for direct unit construction; production uses the durable database ledger. */
    private final IdempotencySupport idempotency = new IdempotencySupport();
    private DurableIdempotencyService durableIdempotency;
    private InvoiceRepository invoices;
    private PaymentTransactionRepository paymentTransactions;
    private ReceiptRepository receipts;
    private HotelServiceBookingService hotelServiceBookings;
    /** Policy chặn khách bị block và ghi nhận hủy trễ. */
    private final BookingPolicy bookingPolicy = BookingPolicy.defaults();
    /** Đồng hồ múi giờ nghiệp vụ để tính thời điểm nhận/trả/no-show nhất quán. */
    private Clock clock = Clock.system(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));
    @Value("${hotel.policy.late-cancellation-hours:${HOTEL_LATE_CANCELLATION_HOURS:48}}")
    /** Số giờ trước check-in mà hủy được coi là hủy trễ. */
    private long lateCancellationHours = 48;
    public ReservationService(ReservationRepository reservations, GuestStore sharedGuests, EmployeeRepository employees, RoomRepository rooms,
                              AuditService audit, BillingService billing, ServiceRepository serviceCatalog, ServiceLineRepository serviceLines,
                              InventoryMovementRepository inventoryMovements) {
        this.reservations=reservations; this.sharedGuests=sharedGuests; this.employees=employees; this.rooms=rooms; this.audit=audit; this.billing=billing; this.serviceCatalog=serviceCatalog; this.serviceLines=serviceLines;
        this.inventoryMovements = inventoryMovements;
    }

    @org.springframework.beans.factory.annotation.Autowired
    void setDurableIdempotency(DurableIdempotencyService durableIdempotency) {
        this.durableIdempotency = durableIdempotency;
    }

    @org.springframework.beans.factory.annotation.Autowired
    void setBusinessClock(Clock clock) { this.clock = clock; }
    @org.springframework.beans.factory.annotation.Autowired
    void setHotelServiceBookings(HotelServiceBookingService service) { this.hotelServiceBookings = service; }

    @org.springframework.beans.factory.annotation.Autowired
    void setTimelineRepositories(InvoiceRepository invoices, PaymentTransactionRepository paymentTransactions,
                                 ReceiptRepository receipts) {
        this.invoices = invoices; this.paymentTransactions = paymentTransactions; this.receipts = receipts;
    }

    /** Điểm vào tạo booking lấy idempotency key từ request body. */
    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public ReservationDtos.Response create(ReservationDtos.CreateRequest request, String actor) {
        return create(request, actor, request == null ? null : request.idempotencyKey());
    }

    /** Tạo booking: kiểm tra actor/khách, khóa phòng theo thứ tự, chống overlap và ghi cọc. */
    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public ReservationDtos.Response create(ReservationDtos.CreateRequest request, String suppliedActor,
                                           String headerKey) {
        String actor = authenticatedActor(suppliedActor);
        ReservationAccess.requireOperator(actor);
        if (request == null) throw error("INVALID_REQUEST", "Thiếu nội dung đặt phòng");
        requireActor(actor, request.employeeId());
        String key = effectiveKey(request.idempotencyKey(), headerKey);
        String fingerprint = createFingerprint(request);
        // Không khóa idempotency key chưa tồn tại trước khi lấy khóa phòng: mọi yêu cầu
        // phải đi theo cùng thứ tự khóa aggregate phòng rồi mới ghi idempotency record.
        var prior = reservations.findByIdempotencyKey(key);
        if (prior.isPresent()) {
            Reservation existing = prior.get();
            if (!actor.equals(existing.getEmployee().getEmployeeId())
                    || !fingerprint.equals(createFingerprint(existing))) {
                throw error("IDEMPOTENCY_KEY_CONFLICT", "Idempotency key đã được dùng cho yêu cầu khác");
            }
            return toResponse(existing);
        }
        if (request.rooms().size() > 3) throw error("ROOM_LIMIT_EXCEEDED", "Mỗi lượt lưu trú chỉ được đặt tối đa 3 phòng");
        Guest guest = sharedGuest(request.guestId());
        if (!bookingPolicy.allows(guest)) throw error("GUEST_BOOKING_BLOCKED", "Khách hàng đã bị khóa quyền đặt trước");
        Employee employee = employees.findById(request.employeeId()).orElseThrow(() -> error("EMPLOYEE_NOT_FOUND", "Không tìm thấy nhân viên"));
        Set<String> ids = new HashSet<>();
        for (var line : request.rooms()) {
            if (!line.expectedCheckIn().isBefore(line.expectedCheckOut())) throw error("INVALID_INTERVAL", "Thời gian nhận phải trước thời gian trả");
            if (!ids.add(line.roomId())) throw error("DUPLICATE_ROOM", "Không được lặp phòng trong một đơn đặt");
        }
        Map<String, Room> locked = lockRooms(ids);
        prior = reservations.findByIdempotencyKey(key);
        if (prior.isPresent()) {
            Reservation existing = prior.get();
            if (!actor.equals(existing.getEmployee().getEmployeeId())
                    || !fingerprint.equals(createFingerprint(existing))) {
                throw error("IDEMPOTENCY_KEY_CONFLICT", "Idempotency key đã được dùng cho yêu cầu khác");
            }
            return toResponse(existing);
        }
        LocalDateTime now = LocalDateTime.now(clock);
        for (var line : request.rooms()) {
            if (locked.get(line.roomId()).getStatus().blocksAvailability()) throw error("ROOM_NOT_AVAILABLE", "Phòng không sẵn sàng: " + line.roomId());
            int guestCount = line.guestCount() == null ? 1 : line.guestCount();
            var roomType = locked.get(line.roomId()).getRoomType();
            if (guestCount < 1 || (roomType != null && guestCount > roomType.getMaxOccupancy()))
                throw error("INVALID_GUEST_COUNT", "Số khách vượt sức chứa của phòng " + line.roomId());
            if (reservations.hasOverlap(line.roomId(), line.expectedCheckIn(), line.expectedCheckOut(), RoomStatus.CANCELLED, IGNORED, now)) throw error("OVERBOOKING", "Phòng đã có lịch trùng: " + line.roomId());
        }
        BigDecimal requiredDeposit = requiredDeposit(request, locked);
        BigDecimal suppliedDeposit = request.deposit() == null ? BigDecimal.ZERO : request.deposit();
        if (requiredDeposit.signum() > 0 && suppliedDeposit.compareTo(requiredDeposit) != 0)
            throw error("INVALID_DEPOSIT", "Tiền đặt cọc phải bằng 50% tiền phòng dự kiến");
        Reservation reservation = new Reservation(); reservation.setGuest(guest); reservation.setEmployee(employee);
        reservation.setBookedAt(now);
        reservation.setDepositAmount(suppliedDeposit); reservation.setRentalType(request.rentalType().name());
        reservation.setBookingSource(request.bookingSource());
        reservation.setIdempotencyKey(key);
        reservation.setCanonicalRequestFingerprint(fingerprint);
        if (suppliedDeposit.signum() > 0) reservation.setDepositPaymentStatus(DepositPaymentStatus.PAID);
        reservation.transitionTo(reservation.getDepositAmount().signum() > 0 ? ReservationStatus.DEPOSIT_PAID : ReservationStatus.CONFIRMED);
        request.rooms().forEach(line -> { ReservationRoom rr = new ReservationRoom(); rr.setRoom(locked.get(line.roomId())); rr.setCheckIn(line.expectedCheckIn()); rr.setCheckOut(line.expectedCheckOut()); rr.setGuestCount(line.guestCount() == null ? 1 : line.guestCount()); rr.setStatus(RoomStatus.RESERVED); reservation.addRoom(rr); });
        try {
            Reservation saved = reservations.saveAndFlush(reservation);
            billing.registerDeposit(saved);
            audit.record(actor, "RESERVATION_CREATED", "RESERVATION", saved.getId().toString(), null,
                    saved.getStatus().name(), fingerprint);
            return toResponse(saved);
        } catch (DataIntegrityViolationException ex) {
            var duplicate = reservations.findByIdempotencyKey(key);
            if (duplicate.isPresent() && actor.equals(duplicate.get().getEmployee().getEmployeeId())
                    && fingerprint.equals(createFingerprint(duplicate.get()))) return toResponse(duplicate.get());
            throw ex;
        }
    }

    /** Lấy chi tiết booking theo id, chỉ đọc và báo lỗi nếu không tồn tại. */
    @Transactional(readOnly=true) public ReservationDtos.Response get(Long id) { return reservations.findDetails(id).map(reservation -> toResponse(reservation, true)).orElseThrow(() -> error("RESERVATION_NOT_FOUND", "Không tìm thấy đặt phòng: " + id)); }
    /** Tìm phân trang theo trạng thái/khách, giới hạn dữ liệu theo quyền đọc của actor. */
    @Transactional(readOnly = true)
    public ReservationDtos.PageResponse list(ReservationStatus status, Long guestId, int page, int size) {
        String actor = SecurityActor.currentActor();
        boolean global = ReservationAccess.hasGlobalRead();
        if (page < 0 || size < 1 || size > 100 || (guestId != null && guestId <= 0))
            throw error("INVALID_SEARCH", "page phải >= 0, size từ 1 đến 100 và guest_id phải > 0");
        var ids = reservations.searchIds(global ? null : actor, status, guestId,
                org.springframework.data.domain.PageRequest.of(page, size));
        Map<Long, Reservation> details = new HashMap<>();
        if (!ids.isEmpty()) reservations.findPageDetails(ids.getContent()).forEach(r -> details.put(r.getId(), r));
        var items = ids.getContent().stream().map(details::get).map(this::toResponse).toList();
        return new ReservationDtos.PageResponse(items, page, size, ids.getTotalElements(), ids.getTotalPages());
    }

    /** Khóa booking và các phòng, xác nhận thời điểm hợp lệ rồi chuyển sang CHECKED_IN. */
    @Transactional
    public ReservationDtos.Response checkIn(Long id, ReservationDtos.CheckInRequest request, String suppliedActor, String key) {
        String actor = authenticatedActor(suppliedActor);
        ReservationAccess.requireOperator(actor);
        String fingerprint = IdempotencySupport.fingerprint("CHECK_IN|" + id + "|" + (request == null ? "" : request.at()));
        return executeIdempotent("reservation-check-in", key, actor, fingerprint, ReservationDtos.Response.class, () -> {
            Reservation r = locked(id);
            requireState(r, ReservationStatus.CONFIRMED, ReservationStatus.DEPOSIT_PAID);
            LocalDateTime at = request == null || request.at() == null ? LocalDateTime.now(clock) : request.at();
            LocalDateTime now = LocalDateTime.now(clock);
            Map<String, Room> lockedRooms = lockRooms(r.getRooms().stream().map(x -> x.getRoom().getId()).toList());
            for (ReservationRoom rr : r.getRooms()) {
                if (at.isBefore(rr.getCheckIn())) throw error("EARLY_CHECK_IN", "Không thể nhận phòng trước giờ dự kiến");
                if (!at.isBefore(rr.getCheckOut())) throw error("INVALID_CHECK_IN_TIME", "Giờ nhận phải trước giờ trả dự kiến");
                Room room = lockedRooms.get(rr.getRoom().getId());
                if (room.getStatus() != RoomStatus.READY && room.getStatus() != RoomStatus.RESERVED)
                    throw error("ROOM_NOT_AVAILABLE", "Phòng chưa sẵn sàng để nhận khách");
                if (reservations.hasOverlapExcludingReservation(id, room.getId(), at, rr.getCheckOut(),
                        RoomStatus.CANCELLED, IGNORED, now)) throw error("OVERBOOKING", "Phòng có lịch đặt giao nhau");
            }
            for (ReservationRoom rr : r.getRooms()) {
                rr.setStatus(RoomStatus.OCCUPIED);
                rr.getRoom().setStatus(RoomStatus.OCCUPIED);
            }
            r.setActualCheckIn(at);
            r.transitionTo(ReservationStatus.CHECKED_IN);
            audit.record(actor, "RESERVATION_CHECKED_IN", "RESERVATION", id.toString(), null, at.toString(), null);
            return toResponse(r);
        });
    }

    /** Ủy quyền BillingService tính tiền/đối soát và giữ nguyên lịch trả của từng phòng. */
    @Transactional
    public InvoiceDtos.Response checkOut(Long id, ReservationDtos.CheckOutRequest request, String suppliedActor, String key) {
        String actor = authenticatedActor(suppliedActor);
        ReservationAccess.requireOperator(actor);
        String fingerprint = IdempotencySupport.fingerprint("CHECK_OUT|" + id + "|" + (request == null ? "" : request.at())
                + "|" + (request == null ? "" : request.paymentMethod()));
        return executeIdempotent("reservation-check-out", key, actor, fingerprint, InvoiceDtos.Response.class, () -> {
            Reservation r = locked(id);
            requireState(r, ReservationStatus.CHECKED_IN);
            List<LocalDateTime> scheduled = r.getRooms().stream().map(ReservationRoom::getCheckOut).toList();
            if (hotelServiceBookings != null) hotelServiceBookings.cancelForReservation(id, actor);
            InvoiceDtos.Response response = billing.checkOut(id, request == null ? null : request.at(),
                    request == null ? null : request.paymentMethod(), actor);
            // Dịch vụ thanh toán tính toán dựa trên thời điểm trả phòng theo lịch, nhưng không được
            // thay lịch đó bằng dấu thời gian trả phòng thực tế.
            for (int i = 0; i < r.getRooms().size(); i++) r.getRooms().get(i).setCheckOut(scheduled.get(i));
            return response;
        });
    }

    /** Hủy booking theo lý do, phân loại refund/forfeit/retain và xử lý no-show quá hạn. */
    @Transactional
    public ReservationDtos.Response cancel(Long id, ReservationDtos.CancelRequest request,
                                           String suppliedActor, String key) {
        String actor = authenticatedActor(suppliedActor);
        ReservationAccess.requireOperator(actor);
        return cancelInternal(id, request, actor, key, null, "reservation-cancel");
    }

    /** Cho phép chính chủ booking online tự hủy; vẫn dùng chung policy 48 giờ/no-show. */
    @Transactional
    public ReservationDtos.Response cancelForCustomer(Long id, ReservationDtos.CancelRequest request,
                                                      String suppliedActor, String key) {
        String actor = authenticatedActor(suppliedActor);
        SecurityActor.Principal principal = SecurityActor.currentPrincipal();
        if (!principal.isCustomer() || !principal.id().equals(actor))
            throw error("CUSTOMER_REQUIRED", "Chỉ khách hàng được hủy booking của mình");
        return cancelInternal(id, request, actor, key, Long.valueOf(principal.id()), "customer-reservation-cancel");
    }

    private ReservationDtos.Response cancelInternal(Long id, ReservationDtos.CancelRequest request,
                                                     String actor, String key, Long customerAccountId,
                                                     String idempotencyScope) {
        String reason = request == null ? null : request.reason();
        String fingerprint = IdempotencySupport.fingerprint("CANCEL|" + id + "|" + (reason == null ? "" : reason.trim()));
        return executeIdempotent(idempotencyScope, key, actor, fingerprint, ReservationDtos.Response.class, () -> {
            if (reason == null || reason.isBlank()) throw error("CANCELLATION_REASON_REQUIRED", "Hủy đặt phòng phải có lý do");
            Reservation r = locked(id);
            if (customerAccountId != null && (r.getCustomerAccount() == null
                    || !customerAccountId.equals(r.getCustomerAccount().getId())))
                throw error("RESERVATION_NOT_FOUND", "Không tìm thấy booking");
            if (customerAccountId != null && r.getPendingChangeType() != null)
                throw error("PENDING_CHANGE_PAYMENT", "Hãy hoàn tất hoặc chờ hết hạn cọc bổ sung trước khi hủy booking");
            requireState(r, ReservationStatus.DRAFT, ReservationStatus.CONFIRMED, ReservationStatus.DEPOSIT_PAID);
            LocalDateTime now = LocalDateTime.now(clock);
            LocalDateTime checkIn = r.getRooms().stream().map(ReservationRoom::getCheckIn).min(LocalDateTime::compareTo)
                    .orElseThrow(() -> error("INVALID_RESERVATION", "Đặt phòng không có phòng"));
            LocalDateTime scheduledCheckout = r.getRooms().stream().map(ReservationRoom::getCheckOut).max(LocalDateTime::compareTo)
                    .orElseThrow(() -> error("INVALID_RESERVATION", "Đặt phòng không có phòng"));
            if (r.getActualCheckIn() == null && !now.isBefore(scheduledCheckout)) {
                r.transitionTo(ReservationStatus.NO_SHOW);
                r.getRooms().forEach(x -> x.setStatus(RoomStatus.CANCELLED));
                if (hotelServiceBookings != null) hotelServiceBookings.cancelForReservation(id, actor);
                r.setCancellationReason(reason.trim());
                r.setCancellationOutcome(CancellationOutcome.FORFEIT);
                audit.record(actor, "RESERVATION_NO_SHOW", "RESERVATION", id.toString(), null,
                        ReservationStatus.NO_SHOW.name(), "DEPOSIT_FORFEITED");
                billing.settleCancellationDeposit(r, actor, true);
                return toResponse(r);
            }
            boolean late = !now.isBefore(checkIn.minusHours(lateCancellationHours)) && now.isBefore(checkIn);
            CancellationOutcome outcome = late ? CancellationOutcome.FORFEIT
                    : (r.getDepositPaymentStatus() == com.hospitality.mis.entity.reservation.DepositPaymentStatus.PAID
                    && r.getDepositAmount() != null && r.getDepositAmount().signum() > 0
                    ? CancellationOutcome.REFUND : CancellationOutcome.RETAIN);
            r.transitionTo(ReservationStatus.CANCELLED);
            r.getRooms().forEach(x -> x.setStatus(RoomStatus.CANCELLED));
            if (hotelServiceBookings != null) hotelServiceBookings.cancelForReservation(id, actor);
            if (late) bookingPolicy.recordLateCancellation(r.getGuest());
            r.setCancellationReason(reason.trim());
            r.setCancellationOutcome(outcome);
            // Dịch vụ thanh toán vẫn chịu trách nhiệm về hóa đơn và giao dịch thanh toán.
            billing.settleCancellationDeposit(r, actor, outcome == CancellationOutcome.FORFEIT);
            audit.record(actor, "RESERVATION_CANCELLED", "RESERVATION", id.toString(), null,
                    outcome.name(), r.getCancellationReason());
            return toResponse(r);
        });
    }

    /** Gia hạn checkout trước hạn một giờ, khóa phòng và kiểm tra overlap mới. */
    @Transactional
    public ReservationDtos.Response extend(Long id, ReservationDtos.ExtendRequest request,
                                           String suppliedActor, String key) {
        String actor = authenticatedActor(suppliedActor);
        ReservationAccess.requireOperator(actor);
        String fingerprint = IdempotencySupport.fingerprint("EXTEND|" + id + "|"
                + (request == null ? "" : request.newExpectedCheckOut()));
        return executeIdempotent("reservation-extend", key, actor, fingerprint, ReservationDtos.Response.class, () -> {
            Reservation r = locked(id);
            requireState(r, ReservationStatus.CONFIRMED, ReservationStatus.DEPOSIT_PAID, ReservationStatus.CHECKED_IN);
            if (request == null || request.newExpectedCheckOut() == null)
                throw error("INVALID_INTERVAL", "Thời gian gia hạn không hợp lệ");
            LocalDateTime newCheckout = request.newExpectedCheckOut();
            lockRooms(r.getRooms().stream().map(x -> x.getRoom().getId()).toList());
            LocalDateTime now = LocalDateTime.now(clock);
            int delta = -1;
            for (ReservationRoom rr : r.getRooms()) {
                if (!newCheckout.isAfter(rr.getCheckOut())) throw error("INVALID_EXTENSION", "Giờ trả mới phải sau giờ trả hiện tại");
                if (now.isAfter(rr.getCheckOut().minusHours(1)))
                    throw error("EXTENSION_TOO_LATE", "Chỉ được gia hạn trước giờ trả ít nhất 1 tiếng");
                if (reservations.hasOverlapExcludingReservation(id, rr.getRoom().getId(), rr.getCheckIn(), newCheckout,
                        RoomStatus.CANCELLED, IGNORED, now)) throw error("OVERBOOKING", "Khung giờ gia hạn đã có lịch đặt");
                if (delta < 0) delta = (int) Duration.between(rr.getCheckOut(), newCheckout).toMinutes();
            }
            r.setExtensionMinutes(Math.addExact(r.getExtensionMinutes(), delta));
            r.getRooms().forEach(rr -> rr.setCheckOut(newCheckout));
            audit.record(actor, "RESERVATION_EXTENDED", "RESERVATION", id.toString(), null, newCheckout.toString(), null);
            return toResponse(r);
        });
    }

    @Transactional
    public ReservationDtos.Response confirm(Long id, String actor, String key) {
        String principal = authenticatedActor(actor);
        return executeIdempotent("reservation-confirm", key, principal,
                IdempotencySupport.fingerprint("CONFIRM|" + id), ReservationDtos.Response.class, () -> {
                    Reservation r = locked(id);
                    requireState(r, ReservationStatus.DRAFT);
                    if (r.getCustomerAccount() != null
                            && r.getCustomerPaymentMethod() == CustomerPaymentMethod.VNPAY
                            && r.getDepositPaymentStatus() != DepositPaymentStatus.PAID) {
                        throw error("DEPOSIT_PAYMENT_REQUIRED", "Booking VNPay chỉ được xác nhận sau khi thanh toán cọc thành công");
                    }
                    List<String> roomIds = r.getRooms().stream().map(line -> line.getRoom().getId()).sorted().toList();
                    rooms.findAllForUpdateOrdered(roomIds);
                    LocalDateTime now = LocalDateTime.now(clock);
                    for (ReservationRoom line : r.getRooms()) {
                        if (reservations.hasOverlapExcludingReservation(r.getId(), line.getRoom().getId(),
                                line.getCheckIn(), line.getCheckOut(), RoomStatus.CANCELLED, IGNORED, now)) {
                            throw error("OVERBOOKING", "Phòng " + line.getRoom().getId() + " đã được giữ bởi booking khác");
                        }
                    }
                    r.transitionTo(ReservationStatus.CONFIRMED);
                    if (r.getDepositAmount() != null && r.getDepositAmount().signum() > 0
                            && r.getDepositPaymentStatus() != DepositPaymentStatus.PAID) {
                        r.setDepositPaymentStatus(DepositPaymentStatus.PAID);
                        r.setDepositPaymentCode(null);
                        r.setDepositPaymentExpiresAt(null);
                        billing.registerDeposit(r);
                    }
                    r.getRooms().forEach(line -> { line.setStatus(RoomStatus.RESERVED); line.getRoom().setStatus(RoomStatus.RESERVED); });
                    audit.record(principal, "RESERVATION_CONFIRMED", "RESERVATION", id.toString(), ReservationStatus.DRAFT.name(), ReservationStatus.CONFIRMED.name(), null);
                    return toResponse(r);
                });
    }

    /** Cập nhật lịch/phòng của booking trước check-in với kiểm tra overlap dưới row lock. */
    @Transactional
    public ReservationDtos.Response update(Long id, ReservationDtos.UpdateRequest request,
                                           String suppliedActor, String key) {
        String actor = authenticatedActor(suppliedActor);
        ReservationAccess.requireOperator(actor);
        if (request == null || request.rooms() == null || request.rooms().isEmpty())
            throw error("INVALID_RESERVATION", "Booking phải có ít nhất một phòng");
        String canonical = request.rooms().stream().map(x -> x.roomId().trim() + "@" + x.expectedCheckIn() + "/" + x.expectedCheckOut())
                .sorted().reduce((a, b) -> a + ";" + b).orElse("");
        String fingerprint = IdempotencySupport.fingerprint("UPDATE|" + id + "|" + canonical + "|" + request.deposit());
        return executeIdempotent("reservation-update", key, actor, fingerprint, ReservationDtos.Response.class, () -> {
            Reservation reservation = locked(id);
            requireState(reservation, ReservationStatus.DRAFT, ReservationStatus.CONFIRMED, ReservationStatus.DEPOSIT_PAID);
            if (request.rooms().size() != reservation.getRooms().size())
                throw error("ROOM_SET_IMMUTABLE", "Cập nhật booking phải giữ nguyên số phòng đã gán");
            Map<String, ReservationDtos.RoomStay> requested = new HashMap<>();
            for (ReservationDtos.RoomStay line : request.rooms()) {
                if (requested.put(line.roomId().trim(), line) != null)
                    throw error("DUPLICATE_ROOM", "Không được lặp phòng trong booking");
                if (!line.expectedCheckOut().isAfter(line.expectedCheckIn()))
                    throw error("INVALID_INTERVAL", "Giờ trả phải sau giờ nhận");
            }
            lockRooms(reservation.getRooms().stream().map(x -> x.getRoom().getId()).toList());
            LocalDateTime now = LocalDateTime.now(clock);
            for (ReservationRoom line : reservation.getRooms()) {
                ReservationDtos.RoomStay next = requested.get(line.getRoom().getId());
                if (next == null) throw error("ROOM_SET_IMMUTABLE", "Không được đổi phòng trong thao tác cập nhật lịch");
                if (reservations.hasOverlapExcludingReservation(id, line.getRoom().getId(), next.expectedCheckIn(), next.expectedCheckOut(), RoomStatus.CANCELLED, IGNORED, now))
                    throw error("OVERBOOKING", "Phòng có lịch đặt giao nhau");
                line.setCheckIn(next.expectedCheckIn());
                line.setCheckOut(next.expectedCheckOut());
            }
            if (request.deposit() != null) reservation.setDepositAmount(request.deposit());
            audit.record(actor, "RESERVATION_UPDATED", "RESERVATION", id.toString(), null, canonical, null);
            return toResponse(reservation);
        });
    }

    @Transactional(readOnly = true)
    public List<AuditDtos.Response> timeline(Long id) {
        if (!reservations.existsById(id)) throw error("RESERVATION_NOT_FOUND", "Không tìm thấy đặt phòng");
        var entries = new ArrayList<com.hospitality.mis.entity.governance.AuditLog>(audit.timeline("RESERVATION", id.toString()));
        if (invoices != null) invoices.findByReservationId(id).ifPresent(invoice -> {
            entries.addAll(audit.timeline("INVOICE", invoice.getId().toString()));
            paymentTransactions.findByInvoiceIdOrderByOccurredAtAscIdAsc(invoice.getId())
                    .forEach(payment -> entries.addAll(audit.timeline("PAYMENT_TRANSACTION", payment.getId().toString())));
            receipts.findByInvoiceIdOrderByIssuedAtAscIdAsc(invoice.getId())
                    .forEach(receipt -> entries.addAll(audit.timeline("RECEIPT", receipt.getId().toString())));
        });
        return entries.stream().distinct().sorted(Comparator.comparing(com.hospitality.mis.entity.governance.AuditLog::getCreatedAt)
                        .thenComparing(log -> log.getId() == null ? Long.MAX_VALUE : log.getId()))
                .map(AuditDtos.Response::from).toList();
    }

    /**
     * Đóng một đặt phòng chưa đến sau khi thời gian lưu trú theo lịch đã kết thúc.
     * Tiền đặt cọc vẫn được giữ lại; ở đây cố ý không có luồng hoàn tiền.
     */
    /** Đánh dấu no-show sau khi lịch lưu trú kết thúc; cọc bị giữ và phòng bị hủy. */
    @Transactional
    public ReservationDtos.Response markNoShow(Long id, String suppliedActor, String key) {
        String actor = authenticatedActor(suppliedActor);
        ReservationAccess.requireOperator(actor);
        String fingerprint = IdempotencySupport.fingerprint("NO_SHOW|" + id);
        return executeIdempotent("reservation-no-show", key, actor, fingerprint, ReservationDtos.Response.class, () -> {
            Reservation r = locked(id);
            requireState(r, ReservationStatus.CONFIRMED, ReservationStatus.DEPOSIT_PAID);
            if (r.getActualCheckIn() != null)
                throw error("INVALID_STATE", "Đặt phòng đã nhận phòng, không thể đánh dấu no-show");
            LocalDateTime scheduledCheckout = r.getRooms().stream().map(ReservationRoom::getCheckOut)
                    .max(LocalDateTime::compareTo)
                    .orElseThrow(() -> error("INVALID_RESERVATION", "Đặt phòng không có phòng"));
            if (LocalDateTime.now(clock).isBefore(scheduledCheckout))
                throw error("NO_SHOW_TOO_EARLY", "Chỉ được đánh dấu no-show sau khi hết thời gian đặt phòng");
            r.transitionTo(ReservationStatus.NO_SHOW);
            r.getRooms().forEach(x -> x.setStatus(RoomStatus.CANCELLED));
            if (hotelServiceBookings != null) hotelServiceBookings.cancelForReservation(id, actor);
            r.setCancellationReason("Khách không đến trước khi kỳ lưu trú kết thúc");
            r.setCancellationOutcome(CancellationOutcome.FORFEIT);
            billing.settleCancellationDeposit(r, actor, true);
            audit.record(actor, "RESERVATION_NO_SHOW", "RESERVATION", id.toString(), null,
                    ReservationStatus.NO_SHOW.name(), "DEPOSIT_FORFEITED");
            return toResponse(r);
        });
    }

    /** Cộng dịch vụ cho booking CHECKED_IN, trừ tồn kho và ghi inventory movement nếu có. */
    @Transactional
    public ReservationDtos.Response addService(Long id, ReservationDtos.AddServiceRequest request,
                                               String suppliedActor, String key) {
        String actor = authenticatedActor(suppliedActor);
        ReservationAccess.requireOperator(actor);
        String fingerprint = IdempotencySupport.fingerprint("SERVICE|" + id + "|" + request.serviceId() + "|"
                + request.quantity() + "|" + request.usedAt() + "|" + request.roomId() + "|" + request.mealPeriod());
        return executeIdempotent("reservation-service", key, actor, fingerprint, ReservationDtos.Response.class, () -> {
            Reservation r = locked(id);
            requireState(r, ReservationStatus.CHECKED_IN);
            if (hotelServiceBookings != null && Set.of("BREAKFAST", "LNDRYSTD", "MAMREST", "POOL").contains(request.serviceId())) {
                String roomId = request.roomId() == null ? r.getRooms().get(0).getRoom().getId() : request.roomId();
                hotelServiceBookings.recordAtFrontDesk(new HotelServiceBookingService.Request(id, roomId,
                        request.serviceId(), request.usedAt() == null ? LocalDateTime.now(clock) : request.usedAt(),
                        request.quantity(), request.mealPeriod(), null), key, actor);
                return toResponse(r);
            }
            Service service = serviceCatalog.findWithLockById(request.serviceId()).orElseThrow(() -> error("SERVICE_NOT_FOUND", "Không tìm thấy dịch vụ"));
            if (!service.isActive() || service.getPrice() == null || service.getPrice().signum() <= 0)
                throw error("SERVICE_NOT_AVAILABLE", "Dịch vụ đã ngừng bán hoặc chưa niêm yết giá");
            if (service.getStockQuantity() < request.quantity()) throw error("INSUFFICIENT_STOCK", "Tồn kho không đủ");
            var usedOn = (request.usedAt() == null ? LocalDateTime.now(clock) : request.usedAt()).toLocalDate();
            var lineKey = new ServiceUsageId(id, request.serviceId(), usedOn);
            var line = serviceLines.findById(lineKey).orElseGet(ServiceUsage::new);
            line.setReservation(r); line.setService(service); line.setUsedOn(usedOn);
            if (line.getUnitPrice() == null) line.setUnitPrice(service.getPrice());
            line.setQuantity(line.getQuantity() + request.quantity());
            serviceLines.save(line);
            service.setStockQuantity(service.getStockQuantity() - request.quantity());
            InventoryMovement movement = new InventoryMovement(); movement.setService(service);
            movement.setType(InventoryMovement.MovementType.ISSUE); movement.setQuantity(request.quantity());
            movement.setActorId(actor); movement.setOccurredAt(LocalDateTime.now(clock));
            movement.setReason("RESERVATION_SERVICE:" + id); inventoryMovements.save(movement);
            audit.record(actor, "SERVICE_ADDED", "RESERVATION", id.toString(), null, request.serviceId(), null);
            return toResponse(r);
        });
    }
    private <T> T executeIdempotent(String scope, String key, String actor, String fingerprint,
                                    Class<T> responseType, java.util.function.Supplier<T> command) {
        return durableIdempotency == null
                ? idempotency.execute(scope, key, actor, fingerprint, command)
                : durableIdempotency.execute(scope, key, actor, fingerprint, responseType, command);
    }
    /** Tải khách dùng chung hoặc phát lỗi miền nếu không tìm thấy. */
    private Guest sharedGuest(Long id) { return sharedGuests.findSharedById(id).orElseThrow(() -> error("GUEST_NOT_FOUND", "Không tìm thấy khách hàng")); }
    /** Tải booking bằng row lock để mutation không chạy đồng thời. */
    private Reservation locked(Long id){return reservations.findForUpdate(id).orElseThrow(()->error("RESERVATION_NOT_FOUND","Không tìm thấy đặt phòng"));}
    /** Khóa các phòng theo thứ tự id ổn định và bảo đảm đủ mọi phòng yêu cầu. */
    private Map<String,Room> lockRooms(Collection<String> ids){Map<String,Room> out=new HashMap<>(); var sorted=ids.stream().distinct().sorted().toList(); for(Room room:rooms.findAllForUpdateOrdered(sorted))out.put(room.getId(),room); for(String id:sorted)if(!out.containsKey(id))throw error("ROOM_NOT_FOUND","Không tìm thấy phòng: "+id); return out;}
    /** Hợp nhất key body/header và từ chối xung đột hoặc key rỗng. */
    private String effectiveKey(String bodyKey, String headerKey) {
        if (headerKey != null && !headerKey.isBlank() && bodyKey != null && !bodyKey.isBlank()
                && !headerKey.trim().equals(bodyKey.trim()))
            throw error("IDEMPOTENCY_KEY_CONFLICT", "Idempotency key trong header và nội dung không giống nhau");
        return IdempotencySupport.requireKey(headerKey == null || headerKey.isBlank() ? bodyKey : headerKey);
    }

    /** Tạo fingerprint canonical từ guest, employee, cọc, loại thuê và lịch phòng. */
    private String createFingerprint(ReservationDtos.CreateRequest request) {
        String rooms = request.rooms().stream().map(line -> line.roomId().trim() + "@"
                        + line.expectedCheckIn() + "/" + line.expectedCheckOut() + "/" + (line.guestCount() == null ? 1 : line.guestCount()))
                .sorted().reduce((a, b) -> a + ";" + b).orElse("");
        return IdempotencySupport.fingerprint("CREATE|guest=" + request.guestId() + "|employee="
                + request.employeeId().trim() + "|deposit=" + (request.deposit() == null ? BigDecimal.ZERO : request.deposit().stripTrailingZeros().toPlainString())
                + "|rental=" + request.rentalType().name() + "|source=" + (request.bookingSource() == null ? "DIRECT" : request.bookingSource().trim().toUpperCase()) + "|rooms=" + rooms);
    }

    /** Dựng lại fingerprint từ entity để kiểm tra retry sau khi đã lưu. */
    private String createFingerprint(Reservation reservation) {
        if (reservation.getCanonicalRequestFingerprint() != null && !reservation.getCanonicalRequestFingerprint().isBlank())
            return reservation.getCanonicalRequestFingerprint();
        String rooms = reservation.getRooms().stream().map(line -> line.getRoom().getId() + "@"
                        + line.getCheckIn() + "/" + line.getCheckOut() + "/" + line.getGuestCount())
                .sorted().reduce((a, b) -> a + ";" + b).orElse("");
        return IdempotencySupport.fingerprint("CREATE|guest=" + reservation.getGuest().getId() + "|employee="
                + (reservation.getEmployee() == null ? "" : reservation.getEmployee().getEmployeeId()) + "|deposit="
                + (reservation.getDepositAmount() == null ? BigDecimal.ZERO : reservation.getDepositAmount().stripTrailingZeros().toPlainString())
                + "|rental=" + reservation.getRentalType() + "|source=" + reservation.getBookingSource() + "|rooms=" + rooms);
    }
    /** Tính cọc 50% tiền phòng dự kiến, tối thiểu ba giờ với thuê theo giờ. */
    private BigDecimal requiredDeposit(ReservationDtos.CreateRequest request, Map<String, Room> locked) {
        BigDecimal total = BigDecimal.ZERO;
        for (var line : request.rooms()) {
            var roomType = locked.get(line.roomId()).getRoomType();
            if (roomType == null || roomType.getDailyPrice() == null) return BigDecimal.ZERO;
            long minutes = Math.max(1, Duration.between(line.expectedCheckIn(), line.expectedCheckOut()).toMinutes());
            long units = "HOURLY".equals(request.rentalType().name())
                    ? Math.max(3, (minutes + 59) / 60)
                    : Math.max(1, (minutes + 1439) / 1440);
            BigDecimal charge = "HOURLY".equals(request.rentalType().name())
                    ? roomType.getDailyPrice().divide(BigDecimal.valueOf(24), 2, java.math.RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(units))
                    : roomType.getDailyPrice().multiply(BigDecimal.valueOf(units));
            total = total.add(charge);
        }
        return total.multiply(new BigDecimal("0.50")).setScale(2, java.math.RoundingMode.HALF_UP);
    }
    /** Ràng buộc actor cung cấp với principal đang xác thực. */
    private String authenticatedActor(String supplied) {
        return SecurityActor.requireBoundActor(supplied);
    }
    /** Bắt buộc actor là nhân viên sở hữu booking. */
    private void requireActor(String actor,String owner){if(actor==null||actor.isBlank()||owner==null||!owner.equals(actor))throw error("ACTOR_MISMATCH","Actor không khớp nhân viên của đặt phòng");}
    /** Bắt buộc booking đang ở một trong các trạng thái cho phép của use case. */
    private void requireState(Reservation r,ReservationStatus... allowed){if(Arrays.stream(allowed).noneMatch(s->s==r.getStatus()))throw error("INVALID_STATE","Đặt phòng không thể thực hiện ở trạng thái hiện tại");}
    /** Tạo DomainException nhất quán cho validation của reservation boundary. */
    private DomainException error(String code,String message){return new DomainException(code,message);}
    /** Chuyển booking và các room line thành response, giữ cả lịch và thời điểm thực tế. */
    public ReservationDtos.Response toResponse(Reservation r) {
        return toResponse(r, false);
    }

    private ReservationDtos.Response toResponse(Reservation r, boolean includeServiceUsages) {
        List<ReservationDtos.ServiceUsageLine> serviceUsages = !includeServiceUsages || r.getServiceUsages() == null ? List.of()
                : r.getServiceUsages().stream()
                .sorted(Comparator.comparing(ServiceUsage::getUsedOn).thenComparing(line -> line.getService().getName()))
                .map(line -> {
                    int quantity = line.getQuantity() == null ? 0 : line.getQuantity();
                    return new ReservationDtos.ServiceUsageLine(line.getService().getId(), line.getService().getName(),
                            line.getUsedOn(), quantity, line.getUnitPrice(),
                            line.getUnitPrice().multiply(BigDecimal.valueOf(quantity)));
                }).toList();
        return new ReservationDtos.Response(r.getId(), r.getGuest().getId(),
                r.getEmployee() == null ? null : r.getEmployee().getEmployeeId(), r.getStatus(),
                ReservationDtos.RentalType.valueOf(r.getRentalType()), r.getDepositAmount(), r.getBookedAt(),
                r.getActualCheckIn(), r.getActualCheckOut(),
                r.getRooms().stream().map(x -> new ReservationDtos.RoomLine(x.getRoom().getId(), x.getCheckIn(),
                        x.getCheckOut(), r.getActualCheckIn(), r.getActualCheckOut())).toList(),
                r.getCancellationReason(), r.getCancellationOutcome(), r.getBookingSource(), r.getOtaGrossRevenue(),
                r.getOtaCommission(), r.getOtaNetRevenue(), r.getOtaReconciliationStatus(), serviceUsages,
                r.getCustomerPaymentMethod(), r.getDepositPaymentStatus());
    }
}

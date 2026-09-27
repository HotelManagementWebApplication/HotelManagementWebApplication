package com.hospitality.mis.service.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.operations.RoomTransferRepository;
import com.hospitality.mis.dao.reservation.ReservationRepository;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.dto.operations.RoomTransferDtos;
import com.hospitality.mis.entity.reservation.Reservation;
import com.hospitality.mis.entity.reservation.ReservationRoom;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import com.hospitality.mis.entity.reservation.RoomTransfer;
import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomStatus;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.service.governance.DurableIdempotencyService;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.Clock;
import java.util.List;

/** Điều phối chuyển phòng trong kỳ lưu trú, khóa đồng nhất đặt phòng và hai phòng. */
@Service
public class RoomTransferService {
    /** Khóa đặt phòng để chỉ chuyển từ phòng đang occupied của booking này. */
    private final ReservationRepository reservations;
    /** Kho phòng, truy vấn khóa theo thứ tự id để tránh deadlock. */
    private final RoomRepository rooms;
    /** Lưu lịch sử chuyển phòng và lý do nghiệp vụ. */
    private final RoomTransferRepository transfers;
    /** Ghi before/after room và actor vào audit. */
    private final AuditService audit;
    /** Bảo đảm retry cùng request không tạo transfer thứ hai trong instance. */
    private final IdempotencySupport idempotency = new IdempotencySupport();
    private DurableIdempotencyService durableIdempotency;
    private Clock clock = Clock.system(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));

    public RoomTransferService(ReservationRepository reservations, RoomRepository rooms,
                               RoomTransferRepository transfers, AuditService audit) {
        this.reservations = reservations;
        this.rooms = rooms;
        this.transfers = transfers;
        this.audit = audit;
    }

    @org.springframework.beans.factory.annotation.Autowired
    void setDurableIdempotency(DurableIdempotencyService durableIdempotency) { this.durableIdempotency = durableIdempotency; }

    @org.springframework.beans.factory.annotation.Autowired
    void setBusinessClock(Clock clock) { this.clock = clock; }

    /** Kiểm tra trạng thái/thời gian, khóa phòng nguồn-đích, đổi detail và ghi lịch sử. */
    @Transactional
    public RoomTransferDtos.Response transfer(Long reservationId, RoomTransferDtos.CreateRequest request,
                                              String suppliedActor, String key) {
        String actor = authenticatedActor(suppliedActor);
        com.hospitality.mis.middleware.security.ReservationAccess.requireOperator(actor);
        if (request == null) throw new DomainException("INVALID_REQUEST", "Thiếu nội dung chuyển phòng");
        String fingerprint = IdempotencySupport.fingerprint("TRANSFER|" + reservationId + "|" + request.fromRoomId()
                + "|" + request.toRoomId() + "|" + request.transferredAt() + "|" + request.reason());
        return executeIdempotent("room-transfer", key, actor, fingerprint, RoomTransferDtos.Response.class, () -> {
            if (request.fromRoomId().equals(request.toRoomId()))
                throw new DomainException("SAME_ROOM", "Phòng chuyển đến phải khác phòng hiện tại");
            Reservation reservation = reservations.findForUpdate(reservationId)
                    .orElseThrow(() -> new DomainException("RESERVATION_NOT_FOUND", "Không tìm thấy đặt phòng"));
            if (reservation.getStatus() != ReservationStatus.CHECKED_IN)
                throw new DomainException("INVALID_STATE", "Chỉ chuyển phòng khi khách đang ở");

            ReservationRoom detail = reservation.getRooms().stream()
                    .filter(line -> line.getRoom().getId().equals(request.fromRoomId())
                            && line.getStatus() == RoomStatus.OCCUPIED)
                    .findFirst()
                    .orElseThrow(() -> new DomainException("ROOM_NOT_IN_RESERVATION",
                            "Phòng hiện tại không thuộc đặt phòng"));

            List<String> ids = java.util.stream.Stream.of(request.fromRoomId(), request.toRoomId()).sorted().toList();
            var locked = rooms.findAllForUpdateOrdered(ids);
            Room to = locked.stream().filter(room -> room.getId().equals(request.toRoomId())).findFirst()
                    .orElseThrow(() -> new DomainException("ROOM_NOT_FOUND", "Không tìm thấy phòng đích"));
            if (to.getStatus() != RoomStatus.READY)
                throw new DomainException("ROOM_NOT_AVAILABLE", "Phòng đích không sẵn sàng");

            LocalDateTime transferredAt = request.transferredAt() == null ? LocalDateTime.now(clock) : request.transferredAt();
            if (!transferredAt.isAfter(detail.getCheckIn()) || !transferredAt.isBefore(detail.getCheckOut()))
                throw new DomainException("INVALID_TRANSFER_TIME", "Thời điểm chuyển phải nằm trong kỳ lưu trú");
            if (reservations.hasOverlapExcludingReservation(reservationId, to.getId(), transferredAt,
                    detail.getCheckOut(), RoomStatus.CANCELLED,
                    List.of(ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW, ReservationStatus.CHECKED_OUT),
                    LocalDateTime.now(clock)))
                throw new DomainException("OVERBOOKING", "Phòng đích đã có người đặt trong thời gian lưu trú còn lại");

            Room from = detail.getRoom();
            LocalDateTime scheduledCheckout = detail.getCheckOut();
            LocalDateTime originalCheckout = detail.getOriginalCheckOut();
            detail.incrementTransferCount();
            detail.setStatus(RoomStatus.CANCELLED);
            detail.setOriginalCheckOut(transferredAt);
            detail.setCheckOut(transferredAt);

            ReservationRoom replacement = new ReservationRoom();
            replacement.setRoom(to);
            replacement.setCheckIn(transferredAt);
            replacement.setCheckOut(scheduledCheckout);
            replacement.setOriginalCheckOut(originalCheckout.isAfter(transferredAt) ? originalCheckout : transferredAt);
            replacement.setStatus(RoomStatus.OCCUPIED);
            reservation.addRoom(replacement);
            from.setStatus(RoomStatus.CLEANING);
            to.setStatus(RoomStatus.OCCUPIED);
            reservations.saveAndFlush(reservation);

            RoomTransfer transfer = new RoomTransfer();
            transfer.setReservation(reservation);
            transfer.setFromRoom(from);
            transfer.setToRoom(to);
            transfer.setTransferredAt(transferredAt);
            transfer.setReason(request.reason());
            RoomTransfer saved = transfers.save(transfer);
            audit.record(actor, "ROOM_TRANSFERRED", "RESERVATION", reservationId.toString(),
                    request.fromRoomId(), request.toRoomId(), request.reason());
            return new RoomTransferDtos.Response(saved.getId(), reservationId, from.getId(), to.getId(),
                    saved.getTransferredAt(), saved.getReason());
        });
    }

    private <T> T executeIdempotent(String scope, String key, String actor, String fingerprint,
                                    Class<T> responseType, java.util.function.Supplier<T> command) {
        return durableIdempotency == null
                ? idempotency.execute(scope, key, actor, fingerprint, command)
                : durableIdempotency.execute(scope, key, actor, fingerprint, responseType, command);
    }

    /** Ràng buộc actor với principal hiện tại và chuyển lỗi xác thực thành lỗi miền. */
    private String authenticatedActor(String supplied) {
        try {
            return SecurityActor.requireBoundActor(supplied);
        } catch (AuthenticationCredentialsNotFoundException exception) {
            throw new DomainException("ACTOR_REQUIRED", "Thiếu actor đã xác thực");
        } catch (AccessDeniedException exception) {
            throw new DomainException("ACTOR_MISMATCH", "Actor không khớp principal hiện tại");
        }
    }
}

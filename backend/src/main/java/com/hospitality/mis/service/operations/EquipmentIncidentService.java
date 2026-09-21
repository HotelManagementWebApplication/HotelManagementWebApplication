package com.hospitality.mis.service.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.operations.EquipmentIncidentRepository;
import com.hospitality.mis.dao.reservation.ReservationRepository;
import com.hospitality.mis.dao.room.RoomEquipmentRepository;
import com.hospitality.mis.dto.operations.EquipmentIncidentDtos;
import com.hospitality.mis.entity.operations.EquipmentIncident;
import com.hospitality.mis.entity.operations.IncidentHandoffStatus;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import com.hospitality.mis.entity.room.RoomStatus;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.billing.PricingPolicy;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.service.governance.DurableIdempotencyService;
import com.hospitality.mis.service.governance.NotificationOutboxService;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Clock;
import java.util.List;
import com.hospitality.mis.entity.operations.IncidentSeverity;

/** Ghi sự cố thiết bị trong phòng đang có khách và tính khoản bồi thường. */
@Service
public class EquipmentIncidentService {
    /** Kho sự cố, lưu giá trị bồi thường đã tính tại thời điểm ghi nhận. */
    private final EquipmentIncidentRepository incidents;
    /** Khóa đặt phòng để xác nhận khách đang ở và phòng thuộc đặt phòng. */
    private final ReservationRepository reservations;
    private final RoomEquipmentRepository equipmentRegistry;
    /** Policy tính bồi thường theo tuổi và giá trị thiết bị. */
    private final PricingPolicy pricing;
    /** Ghi audit sự cố và số tiền bồi thường. */
    private final AuditService audit;
    /** Cache kết quả hoàn tất trong instance để retry cùng actor/payload không ghi trùng. */
    private final IdempotencySupport idempotency = new IdempotencySupport();
    private DurableIdempotencyService durableIdempotency;
    private NotificationOutboxService notifications;
    private com.hospitality.mis.dao.room.RoomRepository rooms;
    private Clock clock = Clock.system(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));

    public EquipmentIncidentService(EquipmentIncidentRepository incidents, ReservationRepository reservations,
                                    RoomEquipmentRepository equipmentRegistry, PricingPolicy pricing, AuditService audit) {
        this.incidents = incidents;
        this.reservations = reservations;
        this.equipmentRegistry = equipmentRegistry;
        this.pricing = pricing;
        this.audit = audit;
    }

    @org.springframework.beans.factory.annotation.Autowired
    void setDurableIdempotency(DurableIdempotencyService durableIdempotency) { this.durableIdempotency = durableIdempotency; }

    @org.springframework.beans.factory.annotation.Autowired
    void setBusinessClock(Clock clock) { this.clock = clock; }

    @org.springframework.beans.factory.annotation.Autowired
    void setNotifications(NotificationOutboxService notifications) { this.notifications = notifications; }

    @org.springframework.beans.factory.annotation.Autowired
    void setRooms(com.hospitality.mis.dao.room.RoomRepository rooms) { this.rooms = rooms; }

    /** Khóa đặt phòng, xác nhận room occupied, tính bồi thường và ghi sự cố idempotent. */
    @Transactional
    public EquipmentIncidentDtos.Response record(Long reservationId, EquipmentIncidentDtos.CreateRequest request,
                                                 String suppliedActor, String key) {
        String actor = authenticatedActor(suppliedActor);
        if (request == null) throw new DomainException("INVALID_REQUEST", "Thiếu nội dung báo sự cố");
        String fingerprint = IdempotencySupport.fingerprint("EQUIPMENT_INCIDENT|" + reservationId + "|" + request.roomId()
                + "|" + request.equipmentName() + "|" + request.equipmentId()
                + "|" + request.quantity() + "|" + request.severity());
        return executeIdempotent("equipment-incident", key, actor, fingerprint, EquipmentIncidentDtos.Response.class, () -> {
            var reservation = reservations.findForUpdate(reservationId)
                    .orElseThrow(() -> new DomainException("RESERVATION_NOT_FOUND", "Không tìm thấy đặt phòng"));
            if (reservation.getStatus() != ReservationStatus.CHECKED_IN)
                throw new DomainException("INVALID_STATE", "Chỉ ghi nhận sự cố khi khách đang ở");
            var room = reservation.getRooms().stream()
                    .filter(line -> line.getStatus() == RoomStatus.OCCUPIED)
                    .map(line -> line.getRoom())
                    .filter(candidate -> candidate.getId().equals(request.roomId()))
                    .findFirst()
                    .orElseThrow(() -> new DomainException("ROOM_NOT_IN_RESERVATION",
                            "Phòng không thuộc đặt phòng này"));
            var equipment = resolveEquipment(request);
            if (request.quantity() > equipment.getQuantity())
                throw new DomainException("INVALID_EQUIPMENT_QUANTITY", "Số lượng hư hỏng vượt số lượng thiết bị trong registry");
            var amount = pricing.equipmentCompensation(equipment.getOriginalValue(), equipment.getPurchasedOn(),
                    request.quantity(), LocalDate.now(clock));
            var incidentEntity = new EquipmentIncident(reservation, room, equipment.getName(),
                    equipment.getOriginalValue(), equipment.getPurchasedOn(), request.quantity(), amount);
            incidentEntity.setSeverity(request.severity());
            incidentEntity.setCreatedAt(java.time.LocalDateTime.now(clock));
            var incident = incidents.save(incidentEntity);
            audit.record(actor, "EQUIPMENT_INCIDENT_RECORDED", "RESERVATION", reservationId.toString(), null,
                    amount.toPlainString(), null);
            if (notifications != null) {
                String payload = "{\"reservation_id\":" + reservationId + ",\"room_id\":\"" + request.roomId()
                        + "\",\"compensation\":" + amount.toPlainString() + "}";
                notifications.enqueue("EQUIPMENT_INCIDENT", "FRONT_DESK", payload, "equipment-incident-" + incident.getId());
                notifications.enqueue("EQUIPMENT_INCIDENT", "TECHNICAL", payload, "equipment-incident-tech-" + incident.getId());
                if (incident.getSeverity() == com.hospitality.mis.entity.operations.IncidentSeverity.HIGH
                        || incident.getSeverity() == com.hospitality.mis.entity.operations.IncidentSeverity.CRITICAL) {
                    notifications.enqueue("EQUIPMENT_INCIDENT", "MANAGER", payload, "equipment-incident-manager-" + incident.getId());
                }
            }
            return response(incident);
        });
    }

    private com.hospitality.mis.entity.room.RoomEquipment resolveEquipment(EquipmentIncidentDtos.CreateRequest request) {
        if (request.equipmentId() != null) {
            return equipmentRegistry.findByIdAndRoomIdAndActiveTrue(request.equipmentId(), request.roomId())
                    .orElseThrow(() -> new DomainException("EQUIPMENT_NOT_FOUND", "Thiết bị active không thuộc phòng"));
        }
        var matches = equipmentRegistry.findByRoomIdAndActiveTrueOrderByNameAsc(request.roomId()).stream()
                .filter(item -> item.getName().equalsIgnoreCase(request.equipmentName().trim())).toList();
        if (matches.size() != 1)
            throw new DomainException("EQUIPMENT_NOT_FOUND", "Không xác định được duy nhất thiết bị active trong phòng");
        return matches.get(0);
    }

    @Transactional
    public EquipmentIncidentDtos.Response handoff(Long id, EquipmentIncidentDtos.HandoffRequest request,
                                                  String suppliedActor, String key) {
        final String actor = authenticatedActor(suppliedActor);
        String fingerprint = IdempotencySupport.fingerprint("EQUIPMENT_INCIDENT_HANDOFF|" + id + "|" + request);
        return executeIdempotent("equipment-incident-handoff", key, actor, fingerprint,
                EquipmentIncidentDtos.Response.class, () -> {
            var incident = incidents.findForUpdateById(id).orElseThrow(() -> new DomainException("INCIDENT_NOT_FOUND", "Không tìm thấy sự cố"));
            if (!hasTechnicalOrManagementRole() && request.status() == IncidentHandoffStatus.RESOLVED)
                throw new DomainException("INCIDENT_HANDOFF_FORBIDDEN", "Chỉ Technical hoặc Manager mới được resolve incident");
            if (!allowedHandoff(incident.getHandoffStatus(), request.status()))
                throw new DomainException("INVALID_INCIDENT_HANDOFF", "Chuyển trạng thái handoff không hợp lệ");
            IncidentHandoffStatus before = incident.getHandoffStatus();
            incident.setHandoffStatus(request.status()); incident.setHandoffNote(request.note());
            audit.record(actor, "EQUIPMENT_INCIDENT_HANDOFF", "EQUIPMENT_INCIDENT", id.toString(), before.name(), request.status().name(), request.note());
            return response(incident);
        });
    }

    @Transactional
    public EquipmentIncidentDtos.Response recordRoomIncident(EquipmentIncidentDtos.RoomIncidentRequest request,
                                                             String suppliedActor, String key) {
        String actor = authenticatedActor(suppliedActor);
        if (request == null) throw new DomainException("INVALID_REQUEST", "Thiếu nội dung báo sự cố");
        int qty = request.resolvedQuantity();
        String fingerprint = IdempotencySupport.fingerprint("ROOM_INCIDENT|" + request.roomId()
                + "|" + request.equipmentName() + "|" + request.equipmentId()
                + "|" + qty + "|" + request.severity() + "|" + request.description());
        return executeIdempotent("room-incident", key, actor, fingerprint, EquipmentIncidentDtos.Response.class, () -> {
            if (rooms == null) throw new DomainException("INTERNAL_ERROR", "Room repository unavailable");
            var room = rooms.findForUpdate(request.roomId())
                    .orElseThrow(() -> new DomainException("ROOM_NOT_FOUND", "Không tìm thấy phòng"));

            BigDecimal origVal = BigDecimal.ZERO;
            LocalDate purchasedOn = LocalDate.now(clock);
            if (request.equipmentId() != null) {
                var eq = equipmentRegistry.findByIdAndRoomIdAndActiveTrue(request.equipmentId(), request.roomId());
                if (eq.isPresent()) {
                    origVal = eq.get().getOriginalValue();
                    purchasedOn = eq.get().getPurchasedOn();
                }
            } else {
                var matches = equipmentRegistry.findByRoomIdAndActiveTrueOrderByNameAsc(request.roomId()).stream()
                        .filter(item -> item.getName().equalsIgnoreCase(request.equipmentName().trim())).toList();
                if (matches.size() == 1) {
                    origVal = matches.get(0).getOriginalValue();
                    purchasedOn = matches.get(0).getPurchasedOn();
                }
            }

            IncidentSeverity sev = request.severity() != null ? request.severity() : IncidentSeverity.MEDIUM;
            var incidentEntity = new EquipmentIncident(null, room, request.equipmentName().trim(),
                    origVal, purchasedOn, qty, BigDecimal.ZERO);
            incidentEntity.setSeverity(sev);
            incidentEntity.setHandoffStatus(IncidentHandoffStatus.OPEN);
            incidentEntity.setHandoffNote(request.description());
            incidentEntity.setCreatedAt(java.time.LocalDateTime.now(clock));
            var incident = incidents.save(incidentEntity);

            audit.record(actor, "EQUIPMENT_INCIDENT_RECORDED", "ROOM", request.roomId(), null,
                    request.equipmentName(), request.description());

            if (notifications != null) {
                String payload = "{\"room_id\":\"" + request.roomId()
                        + "\",\"equipment_name\":\"" + request.equipmentName() + "\"}";
                notifications.enqueue("EQUIPMENT_INCIDENT", "FRONT_DESK", payload, "room-incident-" + incident.getId());
                notifications.enqueue("EQUIPMENT_INCIDENT", "TECHNICAL", payload, "room-incident-tech-" + incident.getId());
                if (incident.getSeverity() == IncidentSeverity.HIGH || incident.getSeverity() == IncidentSeverity.CRITICAL) {
                    notifications.enqueue("EQUIPMENT_INCIDENT", "MANAGER", payload, "room-incident-manager-" + incident.getId());
                }
            }
            return response(incident);
        });
    }

    @Transactional(readOnly = true)
    public List<EquipmentIncidentDtos.Response> find(String roomId, Long reservationId,
                                                     IncidentHandoffStatus handoffStatus) {
        return incidents.findForOperations(roomId, reservationId, handoffStatus).stream().map(this::response).toList();
    }

    private EquipmentIncidentDtos.Response response(EquipmentIncident incident) {
        return new EquipmentIncidentDtos.Response(incident.getId(),
                incident.getReservation() != null ? incident.getReservation().getId() : null,
                incident.getRoom().getId(), incident.getEquipmentName(), incident.getCompensation(),
                incident.getSeverity(), incident.getHandoffStatus(), incident.getHandoffNote());
    }

    private boolean allowedHandoff(IncidentHandoffStatus current, IncidentHandoffStatus next) {
        if (current == next) return true;
        return (current == IncidentHandoffStatus.OPEN && next == IncidentHandoffStatus.ACKNOWLEDGED)
                || (current == IncidentHandoffStatus.ACKNOWLEDGED && next == IncidentHandoffStatus.RESOLVED);
    }

    private boolean hasTechnicalOrManagementRole() {
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream().anyMatch(a ->
                a.getAuthority().equals("ROLE_TECHNICAL") || a.getAuthority().equals("ROLE_ADMIN")
                        || a.getAuthority().equals("ROLE_DIRECTOR") || a.getAuthority().equals("ROLE_MANAGER"));
    }

    private <T> T executeIdempotent(String scope, String key, String actor, String fingerprint,
                                    Class<T> responseType, java.util.function.Supplier<T> command) {
        return durableIdempotency == null
                ? idempotency.execute(scope, key, actor, fingerprint, command)
                : durableIdempotency.execute(scope, key, actor, fingerprint, responseType, command);
    }

    /** Ràng buộc actor được truyền vào với principal hiện tại, chuẩn hóa lỗi bảo mật. */
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

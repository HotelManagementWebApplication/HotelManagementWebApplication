package com.hospitality.mis.service.room;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.room.RoomTypeRepository;
import com.hospitality.mis.dao.room.RoomTypePriceHistoryRepository;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.dto.governance.ApprovalDtos;
import com.hospitality.mis.dto.room.RoomTypeAdminDtos;
import com.hospitality.mis.entity.room.RoomType;
import com.hospitality.mis.entity.room.RoomTypeCatalogStatus;
import com.hospitality.mis.entity.room.RoomTypePriceHistory;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.governance.ApprovalService;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.service.governance.DurableIdempotencyService;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;

/** Quản trị loại phòng theo draft, exact approval payload và lifecycle ACTIVE. */
@Service
public class RoomTypeCatalogService {
    private static final String APPROVAL_ACTION = "ROOM_TYPE_ACTIVATE";
    private final RoomTypeRepository types;
    private final RoomTypePriceHistoryRepository priceHistory;
    private final ApprovalService approvals;
    private final AuditService audit;
    private final DurableIdempotencyService durableIdempotency;
    private RoomRepository rooms;
    private Clock clock;

    @Autowired
    public RoomTypeCatalogService(RoomTypeRepository types, RoomTypePriceHistoryRepository priceHistory,
                                  ApprovalService approvals, AuditService audit,
                                  DurableIdempotencyService durableIdempotency, Clock clock) {
        this.types = types;
        this.priceHistory = priceHistory;
        this.approvals = approvals;
        this.audit = audit;
        this.durableIdempotency = durableIdempotency;
        this.clock = clock;
    }

    @Autowired
    void setRoomRepository(RoomRepository rooms) { this.rooms = rooms; }

    @Transactional
    public RoomTypeAdminDtos.Response create(RoomTypeAdminDtos.Request request, String actor, String key) {
        String principal = SecurityActor.requireBoundActor(actor);
        String hash = fingerprint("CREATE|" + canonical(request));
        return durableIdempotency.execute("room-type-create", key, principal, hash,
                RoomTypeAdminDtos.Response.class, () -> {
                    if (types.existsById(request.id().trim())) throw error("ROOM_TYPE_EXISTS", "Loại phòng đã tồn tại");
                    RoomType type = new RoomType();
                    apply(type, request, principal, false);
                    RoomType saved = types.saveAndFlush(type);
                    audit.record(principal, "ROOM_TYPE_DRAFT_CREATED", "ROOM_TYPE", saved.getId(), null,
                            saved.getCatalogStatus().name(), null);
                    return RoomTypeAdminDtos.Response.from(saved);
                });
    }

    @Transactional
    public RoomTypeAdminDtos.Response update(String id, RoomTypeAdminDtos.Request request, String actor, String key) {
        String principal = SecurityActor.requireBoundActor(actor);
        String normalizedId = id.trim();
        if (!normalizedId.equals(request.id().trim())) throw error("ROOM_TYPE_ID_MISMATCH", "ID path và body không khớp");
        String hash = fingerprint("UPDATE|" + canonical(request));
        return durableIdempotency.execute("room-type-update", key, principal, hash,
                RoomTypeAdminDtos.Response.class, () -> {
                    RoomType type = locked(normalizedId);
                    if (type.getCatalogStatus() == RoomTypeCatalogStatus.ACTIVE)
                        throw error("ROOM_TYPE_ACTIVE_IMMUTABLE", "Không sửa trực tiếp loại phòng ACTIVE; tạo draft thay đổi mới");
                    String before = type.getCatalogStatus().name();
                    apply(type, request, principal, false);
                    audit.record(principal, "ROOM_TYPE_DRAFT_UPDATED", "ROOM_TYPE", normalizedId, before,
                            type.getCatalogStatus().name(), null);
                    return RoomTypeAdminDtos.Response.from(type);
                });
    }

    /** Tạo một bản draft mới từ loại phòng ACTIVE; bản đang phục vụ vẫn bất biến. */
    @Transactional
    public RoomTypeAdminDtos.Response createRevision(String sourceId, RoomTypeAdminDtos.Request request,
                                                     String actor, String key) {
        String principal = SecurityActor.requireBoundActor(actor);
        String source = sourceId.trim();
        if (!types.existsById(source)) throw error("ROOM_TYPE_NOT_FOUND", "Không tìm thấy loại phòng");
        RoomType current = locked(source);
        if (current.getCatalogStatus() != RoomTypeCatalogStatus.ACTIVE)
            throw error("ROOM_TYPE_REVISION_SOURCE_INVALID", "Chỉ loại phòng ACTIVE mới được tạo revision");
        if (request == null || request.id() == null || request.id().isBlank())
            throw error("ROOM_TYPE_ID_REQUIRED", "Revision phải có mã loại phòng mới");
        String revisionId = request.id().trim();
        String hash = fingerprint("REVISION|" + source + "|" + canonical(request));
        return durableIdempotency.execute("room-type-revision", key, principal, hash,
                RoomTypeAdminDtos.Response.class, () -> {
                    if (types.existsById(revisionId)) throw error("ROOM_TYPE_EXISTS", "Mã revision đã tồn tại");
                    RoomType draft = new RoomType();
                    apply(draft, request, principal, false);
                    draft.setRevisionOfId(source);
                    RoomType saved = types.saveAndFlush(draft);
                    audit.record(principal, "ROOM_TYPE_REVISION_CREATED", "ROOM_TYPE", saved.getId(),
                            source, saved.getCatalogStatus().name(), null);
                    return RoomTypeAdminDtos.Response.from(saved);
                });
    }

    @Transactional
    public ApprovalDtos.Response submit(String id, String actor, String key) {
        String principal = SecurityActor.requireBoundActor(actor);
        RoomType type = locked(id.trim());
        if (type.getCatalogStatus() == RoomTypeCatalogStatus.ACTIVE)
            throw error("ROOM_TYPE_ALREADY_ACTIVE", "Loại phòng đã ACTIVE");
        String payload = canonical(type);
        return ApprovalDtos.Response.from(approvals.request(principal, APPROVAL_ACTION, type.getId(), payload,
                null, "Đưa loại phòng vào catalog công khai", key));
    }

    /** Chỉ requester của approval đã được manager/director duyệt mới consume để ACTIVE. */
    @Transactional
    public RoomTypeAdminDtos.Response activate(String id, String actor, String key) {
        String principal = SecurityActor.requireBoundActor(actor);
        RoomType type = locked(id.trim());
        String payload = canonical(type);
        String hash = fingerprint("ACTIVATE|" + type.getId() + "|" + payload);
        return durableIdempotency.execute("room-type-activate", key, principal, hash,
                RoomTypeAdminDtos.Response.class, () -> {
                    var approval = approvals.consumeApprovedByApprover(APPROVAL_ACTION, type.getId(), payload, null, principal);
                    if (type.getRevisionOfId() != null) {
                        RoomType previous = locked(type.getRevisionOfId());
                        if (previous.getCatalogStatus() != RoomTypeCatalogStatus.ACTIVE)
                            throw error("ROOM_TYPE_REVISION_SOURCE_INVALID", "Bản gốc của revision không còn ACTIVE");
                        previous.setCatalogStatus(RoomTypeCatalogStatus.RETIRED);
                        previous.setSupersededById(type.getId());
                        if (rooms != null) rooms.findAllByRoomTypeIdForUpdate(previous.getId())
                                .forEach(room -> room.setRoomType(type));
                    }
                    type.setCatalogStatus(RoomTypeCatalogStatus.ACTIVE);
                    type.setCatalogApprovedBy(approval.getApprover());
                    type.setCatalogApprovedAt(LocalDateTime.now(clock));
                    priceHistory.save(new RoomTypePriceHistory(type, type.getDailyPrice(), approval.getApprover(),
                            approval.getId(), LocalDateTime.now(clock)));
                    audit.record(principal, "ROOM_TYPE_ACTIVATED", "ROOM_TYPE", type.getId(),
                            RoomTypeCatalogStatus.DRAFT.name(), RoomTypeCatalogStatus.ACTIVE.name(), null);
                    return RoomTypeAdminDtos.Response.from(type);
                });
    }

    @Transactional
    public void markRejected(String id, String actor) {
        RoomType type = locked(id.trim());
        if (type.getCatalogStatus() != RoomTypeCatalogStatus.ACTIVE) {
            type.setCatalogStatus(RoomTypeCatalogStatus.REJECTED);
            audit.record(actor, "ROOM_TYPE_REJECTED", "ROOM_TYPE", type.getId(),
                    RoomTypeCatalogStatus.DRAFT.name(), RoomTypeCatalogStatus.REJECTED.name(), null);
        }
    }

    @Transactional(readOnly = true)
    public RoomTypeAdminDtos.Response get(String id) {
        return RoomTypeAdminDtos.Response.from(types.findById(id.trim())
                .orElseThrow(() -> error("ROOM_TYPE_NOT_FOUND", "Không tìm thấy loại phòng")));
    }

    @Transactional(readOnly = true)
    public List<RoomTypeAdminDtos.PriceHistoryResponse> priceHistory(String id) {
        if (!types.existsById(id.trim())) throw error("ROOM_TYPE_NOT_FOUND", "Không tìm thấy loại phòng");
        return priceHistory.findByRoomTypeIdOrderByEffectiveAtDescIdDesc(id.trim()).stream()
                .map(item -> new RoomTypeAdminDtos.PriceHistoryResponse(item.getId(), item.getRoomType().getId(),
                        item.getDailyPrice(), item.getChangedBy(), item.getApprovalId(), item.getEffectiveAt()))
                .toList();
    }

    private RoomType locked(String id) {
        return types.findForUpdate(id).orElseThrow(() -> error("ROOM_TYPE_NOT_FOUND", "Không tìm thấy loại phòng"));
    }

    private void apply(RoomType type, RoomTypeAdminDtos.Request request, String actor, boolean active) {
        type.setId(request.id().trim());
        type.setName(request.name().trim());
        type.setDailyPrice(request.dailyPrice());
        type.setDescription(request.description() == null ? null : request.description().trim());
        type.setCatalogStatus(active ? RoomTypeCatalogStatus.ACTIVE : RoomTypeCatalogStatus.DRAFT);
        type.setCatalogUpdatedBy(actor);
        type.setCatalogUpdatedAt(LocalDateTime.now(clock));
        if (!active) {
            type.setCatalogApprovedBy(null);
            type.setCatalogApprovedAt(null);
        }
    }

    private static String canonical(RoomTypeAdminDtos.Request request) {
        return String.join("|", request.id().trim(), request.name().trim(), request.dailyPrice().toPlainString(),
                request.description() == null ? "" : request.description().trim());
    }

    private static String canonical(RoomType type) {
        return String.join("|", type.getId(), type.getName(), type.getDailyPrice().toPlainString(),
                type.getDescription() == null ? "" : type.getDescription());
    }

    private static String fingerprint(String value) { return IdempotencySupport.fingerprint(value); }
    private static DomainException error(String code, String message) { return new DomainException(code, message); }
}

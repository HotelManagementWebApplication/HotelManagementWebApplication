package com.hospitality.mis.service.billing;



import com.hospitality.mis.dao.billing.ServiceRepository;

import com.hospitality.mis.dto.billing.ServiceDtos;

import com.hospitality.mis.common.exception.DomainException;

import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.service.governance.ApprovalService;
import com.hospitality.mis.service.governance.DurableIdempotencyService;
import com.hospitality.mis.service.operations.InventoryMovementService;
import com.hospitality.mis.dto.operations.InventoryMovementDtos;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.dao.billing.ServicePriceHistoryRepository;
import com.hospitality.mis.entity.billing.ServicePriceHistory;
import java.time.Clock;
import java.time.LocalDateTime;
import java.math.BigDecimal;

import com.hospitality.mis.entity.billing.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;



/** Quản lý danh mục dịch vụ, giá bán và tồn kho dịch vụ dùng cho đặt phòng. */
@org.springframework.stereotype.Service
public class ServiceCatalogService {

    /** Kho dịch vụ (restock dùng khóa) và cộng tác viên audit cho mọi thay đổi danh mục. */
    private final ServiceRepository services; private final AuditService audit; private final ApprovalService approvals;
    private final ServicePriceHistoryRepository priceHistory; private final Clock clock;
    private final InventoryMovementService inventoryMovements;
    private final DurableIdempotencyService durableIdempotency;

    public ServiceCatalogService(ServiceRepository services, AuditService audit, ApprovalService approvals,
                                 ServicePriceHistoryRepository priceHistory, Clock clock,
                                 InventoryMovementService inventoryMovements,
                                 DurableIdempotencyService durableIdempotency) {
        this.services = services; this.audit = audit; this.approvals = approvals; this.priceHistory = priceHistory; this.clock = clock;
        this.inventoryMovements = inventoryMovements;
        this.durableIdempotency = durableIdempotency;
    }

    @Transactional(readOnly = true)

    /** Trả toàn bộ danh mục dịch vụ dưới dạng DTO. */
    public List<ServiceDtos.Response> findAll() { return services.findAll().stream().map(this::toResponse).toList(); }

    @Transactional

    /** Tạo dịch vụ mới, khởi tạo tồn kho và ngưỡng cảnh báo, rồi ghi audit. */
    public ServiceDtos.Response create(ServiceDtos.CreateRequest request, String actor) {

        if (services.existsById(request.id())) throw new DomainException("SERVICE_EXISTS", "Mã dịch vụ đã tồn tại");

        var service = new Service(); service.setId(request.id()); service.setName(request.name()); service.setPrice(request.price());
        service.setUnit(request.unit() == null || request.unit().isBlank() ? "LẦN" : request.unit());
        service.setCategory(request.category() == null || request.category().isBlank() ? "other" : request.category().trim());
        service.setDescription(trimToNull(request.description()));
        service.setImageUrl(trimToNull(request.imageUrl()));
        service.setStockQuantity(0); service.setSafetyThreshold(request.safetyThreshold()); services.saveAndFlush(service);
        if (request.openingStock() > 0) {
            inventoryMovements.record(new InventoryMovementDtos.CreateRequest(
                    request.id(), com.hospitality.mis.entity.operations.InventoryMovement.MovementType.RECEIVE,
                    request.openingStock(), "SERVICE_OPENING_STOCK"), actor, "service-create:" + request.id());
        }
        service = services.findById(request.id()).orElseThrow(() -> new DomainException("SERVICE_NOT_FOUND", "Không tìm thấy dịch vụ"));
        audit.record(actor, "SERVICE_CREATED", "SERVICE", request.id(), null, request.name(), null); return toResponse(service);

    }

    @Transactional

    /** Nhập kho qua cùng canonical RECEIVE ledger với inventory-movements. */
    public ServiceDtos.Response restock(String id, ServiceDtos.StockRequest request, String actor, String idempotencyKey) {
        inventoryMovements.record(new InventoryMovementDtos.CreateRequest(
                id, com.hospitality.mis.entity.operations.InventoryMovement.MovementType.RECEIVE,
                request.quantity(), "SERVICE_RESTOCK"), actor, idempotencyKey);
        return services.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new DomainException("SERVICE_NOT_FOUND", "Không tìm thấy dịch vụ"));

    }

    @Transactional
    public com.hospitality.mis.dto.governance.ApprovalDtos.Response requestPriceChange(String id, ServiceDtos.PriceChangeRequest request,
                                                                                         String actor, String key) {
        if (!services.existsById(id)) throw new DomainException("SERVICE_NOT_FOUND", "Không tìm thấy dịch vụ");
        String payload = priceMutationPayload(request.price());
        return com.hospitality.mis.dto.governance.ApprovalDtos.Response.from(
                approvals.request(actor, "SERVICE_PRICE_CHANGE", id, payload, request.price(), request.reason(), key));
    }

    @Transactional
    public ServiceDtos.Response activatePriceChange(String id, ServiceDtos.PriceChangeRequest request,
                                                   String actor, String key) {
        String principal = SecurityActor.requireBoundActor(actor);
        String payload = priceMutationPayload(request.price());
        String requestHash = IdempotencySupport.fingerprint("SERVICE_PRICE_ACTIVATE|" + id + "|" + payload
                + "|" + request.reason().trim());
        return durableIdempotency.execute("service-price-activate", key, principal, requestHash,
                ServiceDtos.Response.class, () -> {
                    var approval = approvals.consumeApprovedByApprover("SERVICE_PRICE_CHANGE", id,
                            payload, request.price(), principal);
                    var service = services.findWithLockById(id)
                            .orElseThrow(() -> new DomainException("SERVICE_NOT_FOUND", "Không tìm thấy dịch vụ"));
                    service.setPrice(request.price());
                    priceHistory.save(new ServicePriceHistory(service, request.price(), approval.getApprover(),
                            approval.getId(), LocalDateTime.now(clock)));
                    audit.record(principal, "SERVICE_PRICE_CHANGED", "SERVICE", id, null,
                            request.price().toPlainString(), approval.getReason());
                    return toResponse(service);
                });
    }

    @Transactional(readOnly = true)
    public List<ServiceDtos.PriceHistoryResponse> priceHistory(String id) {
        if (!services.existsById(id)) throw new DomainException("SERVICE_NOT_FOUND", "Không tìm thấy dịch vụ");
        return priceHistory.findByServiceIdOrderByEffectiveAtDescIdDesc(id).stream()
                .map(x -> new ServiceDtos.PriceHistoryResponse(x.getId(), x.getService().getId(), x.getPrice(), x.getChangedBy(), x.getApprovalId(), x.getEffectiveAt())).toList();
    }

    @Transactional(readOnly = true)
    public List<ServiceDtos.Response> lowStock() {
        return services.findLowStock().stream().map(this::toResponse).toList();
    }

    /** Chuyển dịch vụ thành DTO và tính cờ tồn kho dưới ngưỡng an toàn. */
    /** Chuyển dịch vụ thành DTO và tính cờ cảnh báo dưới safety threshold. */
    public ServiceDtos.Response toResponse(Service s) { return new ServiceDtos.Response(s.getId(), s.getName(), s.getPrice(), s.getUnit(), s.getCategory(), s.getDescription(), s.getImageUrl(), s.getStockQuantity(), s.getSafetyThreshold(), s.getStockQuantity() <= s.getSafetyThreshold(), s.isActive()); }

    private static String trimToNull(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }

    /** Payload canonical chỉ gồm field thực sự được mutate; lý do thuộc metadata approval. */
    private String priceMutationPayload(BigDecimal price) {
        return price.stripTrailingZeros().toPlainString();
    }
}

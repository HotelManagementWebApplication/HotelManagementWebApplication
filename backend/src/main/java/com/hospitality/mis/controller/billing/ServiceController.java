package com.hospitality.mis.controller.billing;
import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.hospitality.mis.dto.billing.ServiceDtos;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.billing.ServiceCatalogService;

import jakarta.validation.Valid;



/**
 * Quản lý danh mục dịch vụ khách sạn và lượng tồn kho của từng dịch vụ.
 */
@RestController

@RequestMapping("/api/services")

public class ServiceController {

    /** Dịch vụ điều phối danh mục, tạo dịch vụ và cập nhật tồn kho. */
    private final ServiceCatalogService service;



    public ServiceController(ServiceCatalogService service) {

        this.service = service;

    }



    /**
     * Liệt kê danh mục qua GET /api/services; không nhận tham số và trả danh sách dịch vụ hiện có.
     * Chỉ phạm vi SERVICE_READ được phép; lỗi truy vấn do dịch vụ xử lý. Đây là thao tác đọc, không có idempotency concern.
     */
    @GetMapping


    @PreAuthorize("@departmentAccess.allows(authentication, 'SERVICE_READ')")
    public List<ServiceDtos.Response> findAll() {

        return service.findAll();

    }





    /**
     * Bổ sung tồn kho qua canonical RECEIVE movement tại POST /api/services/{id}/stock.
     * Idempotency-Key bắt buộc để retry không tạo thêm movement; actor hiện tại được ghi nhận.
     */
    @PostMapping("/{id}/stock")


    @PreAuthorize("hasAnyRole('KITCHEN','MANAGER','ADMIN','DIRECTOR')")
    public ServiceDtos.Response restock(@PathVariable String id,

                                        @Valid @RequestBody ServiceDtos.StockRequest request,
                                        @RequestHeader("Idempotency-Key") String idempotencyKey) {

        return service.restock(id, request, SecurityActor.currentActor(), idempotencyKey);

    }

    @GetMapping("/low-stock")
    @PreAuthorize("@departmentAccess.allows(authentication, 'INVENTORY_READ')")
    public List<ServiceDtos.Response> lowStock() { return service.lowStock(); }

    @PostMapping("/{id}/price/submit")
    @PreAuthorize("@departmentAccess.allows(authentication, 'SERVICE_PRICE_REQUEST')")
    public com.hospitality.mis.dto.governance.ApprovalDtos.Response submitPrice(@PathVariable String id,
            @Valid @RequestBody ServiceDtos.PriceChangeRequest request,
            @RequestHeader("Idempotency-Key") String key) {
        return service.requestPriceChange(id, request, SecurityActor.currentActor(), key);
    }

    @PostMapping("/{id}/price/activate")
    @PreAuthorize("@departmentAccess.allows(authentication, 'SERVICE_PRICE_ACTIVATE')")
    public ServiceDtos.Response activatePrice(@PathVariable String id,
            @Valid @RequestBody ServiceDtos.PriceChangeRequest request,
            @RequestHeader("Idempotency-Key") String key) {
        return service.activatePriceChange(id, request, SecurityActor.currentActor(), key);
    }

    @GetMapping("/{id}/price-history")
    @PreAuthorize("@departmentAccess.allows(authentication, 'SERVICE_READ')")
    public List<ServiceDtos.PriceHistoryResponse> priceHistory(@PathVariable String id) { return service.priceHistory(id); }

    /** Bếp chỉ đọc lịch sử đề xuất giá do chính nhân viên đang đăng nhập gửi. */
    @GetMapping("/price-requests")
    @PreAuthorize("@departmentAccess.allows(authentication, 'SERVICE_PRICE_REQUEST')")
    public List<com.hospitality.mis.dto.governance.ApprovalDtos.Response> myPriceRequests() {
        return service.priceRequestsFor(SecurityActor.currentActor());
    }

}

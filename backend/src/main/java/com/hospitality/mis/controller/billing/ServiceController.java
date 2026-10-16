package com.hospitality.mis.controller.billing;

import com.hospitality.mis.dto.billing.ServiceDtos.CatalogProposalDtos;
import com.hospitality.mis.dto.billing.ServiceDtos.ServiceAvailabilityDtos;
import com.hospitality.mis.dto.billing.ServiceDtos.ServiceConsumptionDto;
import com.hospitality.mis.dto.billing.ServiceDtos;
import com.hospitality.mis.dto.billing.ServiceDtos.ServiceScheduleDtos;
import com.hospitality.mis.dto.governance.ApprovalDtos;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.billing.ServiceCatalogService.CatalogProposalService;
import com.hospitality.mis.service.billing.ServiceCatalogService.ServiceAvailabilityService;
import com.hospitality.mis.service.billing.ServiceCatalogService;
import com.hospitality.mis.service.billing.ServiceCatalogService.ServiceConsumptionService;
import com.hospitality.mis.service.billing.ServiceCatalogService.ServiceScheduleService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

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
     * Tạo dịch vụ qua POST /api/services; body tạo dịch vụ được {@code @Valid} kiểm tra và trả 201 cùng dịch vụ mới.
     * Chỉ SERVICE_WRITE được phép, actor hiện tại được truyền để ghi nhận trách nhiệm; không có khóa idempotency,
     * vì vậy dữ liệu trùng hoặc lỗi nghiệp vụ do dịch vụ báo lỗi.
     */
    @PostMapping

    @ResponseStatus(HttpStatus.CREATED)

    @PreAuthorize("@departmentAccess.allows(authentication, 'SERVICE_WRITE')")
    public ServiceDtos.Response create(@Valid @RequestBody ServiceDtos.CreateRequest request) {

        return service.create(request, SecurityActor.currentActor());

    }





    /**
     * Bổ sung tồn kho qua canonical RECEIVE movement tại POST /api/services/{id}/stock.
     * Idempotency-Key bắt buộc để retry không tạo thêm movement; actor hiện tại được ghi nhận.
     */
    @PostMapping("/{id}/stock")


    @PreAuthorize("@departmentAccess.allows(authentication, 'INVENTORY_WRITE')")
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



    // CatalogProposalController
    @RestController
    @RequestMapping("/api/services/catalog-proposals")
    @PreAuthorize("hasRole('KITCHEN') and @departmentAccess.allows(authentication, 'SERVICE_PRICE_REQUEST')")
    public static class CatalogProposalController {
        private final CatalogProposalService service;
        public CatalogProposalController(CatalogProposalService service){this.service=service;}
        @PostMapping public ApprovalDtos.Response submit(@Valid @RequestBody CatalogProposalDtos.Request request,@RequestHeader("Idempotency-Key") String key){return service.submit(request,SecurityActor.currentActor(),key);}
        @GetMapping public List<ApprovalDtos.Response> mine(){return service.mine(SecurityActor.currentActor());}
    }

    // ServiceAvailabilityController
    @RestController
    @RequestMapping("/api/services/availability")
    public static class ServiceAvailabilityController {
        private final ServiceAvailabilityService service;
        public ServiceAvailabilityController(ServiceAvailabilityService service){this.service=service;}
        @GetMapping @PreAuthorize("@departmentAccess.allows(authentication, 'SERVICE_READ')")
        public List<ServiceAvailabilityDtos.Response> list(
            @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE_TIME) LocalDateTime to){return service.list(from,to);}
    }

    // ServiceConsumptionController
    @RestController
    @RequestMapping("/api/services/consumption")
    public static class ServiceConsumptionController {
        private final ServiceConsumptionService service;
        public ServiceConsumptionController(ServiceConsumptionService service) { this.service=service; }
        @GetMapping @PreAuthorize("hasAnyRole('KITCHEN','MANAGER','DIRECTOR','ADMIN') and @departmentAccess.allows(authentication, 'INVENTORY_READ')")
        public List<ServiceConsumptionDto> list(@RequestParam LocalDate from,@RequestParam LocalDate to) { return service.list(from,to); }
    }

    // ServiceScheduleController
    @RestController
    @RequestMapping("/api/services/{id}/schedule")
    public static class ServiceScheduleController {
        private final ServiceScheduleService service;
        public ServiceScheduleController(ServiceScheduleService service) { this.service=service; }
        @GetMapping @PreAuthorize("@departmentAccess.allows(authentication, 'SERVICE_READ')")
        public ServiceScheduleDtos.Response get(@PathVariable String id) { return service.get(id); }
        @PutMapping @PreAuthorize("hasAnyRole('KITCHEN','MANAGER','DIRECTOR','ADMIN') and @departmentAccess.allows(authentication, 'INVENTORY_WRITE')")
        public ServiceScheduleDtos.Response save(@PathVariable String id,@Valid @RequestBody ServiceScheduleDtos.Request request) { return service.save(id,request); }
    }
}

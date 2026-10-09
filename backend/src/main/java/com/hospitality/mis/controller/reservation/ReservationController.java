package com.hospitality.mis.controller.reservation;
import com.hospitality.mis.dto.billing.InvoiceDtos;

import com.hospitality.mis.dto.operations.EquipmentIncidentDtos;

import com.hospitality.mis.dto.reservation.ReservationDtos;

import com.hospitality.mis.service.operations.EquipmentIncidentService;




import com.hospitality.mis.service.reservation.ReservationService;

import com.hospitality.mis.middleware.security.SecurityActor;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.PathVariable;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;

import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

import org.springframework.web.bind.annotation.RequestMapping;

import org.springframework.web.bind.annotation.ResponseStatus;

import org.springframework.web.bind.annotation.RestController;
import java.util.List;



/**
 * Điều phối toàn bộ vòng đời đặt phòng, từ tra cứu và tạo đến nhận phòng, trả phòng và các thay đổi phát sinh.
 */
@RestController

@RequestMapping("/api/reservations")

public class ReservationController {

    /** Dịch vụ áp dụng quy tắc vòng đời, phạm vi nhân viên và các thao tác chính trên đặt phòng. */
    private final ReservationService service;

    /** Dịch vụ ghi nhận sự cố thiết bị gắn với đặt phòng; dùng chung cho endpoint sự cố của controller này. */
    private final com.hospitality.mis.service.operations.EquipmentIncidentService incidents;



    public ReservationController(ReservationService service,

                                 com.hospitality.mis.service.operations.EquipmentIncidentService incidents) {

        this.service = service;

        this.incidents = incidents;

    }


    /**
     * Phân trang danh sách đặt phòng qua GET /api/reservations.
     * status và guest_id là query tùy chọn; page mặc định 0 và size mặc định 20. Trả PageResponse cho màn hình vận hành.
     * Chỉ RESERVATION_READ được phép; service áp dụng phạm vi dữ liệu và báo lỗi tham số/truy vấn. Đây là thao tác đọc, không cần idempotency.
     */
    @org.springframework.web.bind.annotation.GetMapping
    @PreAuthorize("@departmentAccess.allows(authentication, 'RESERVATION_READ')")
    public ReservationDtos.PageResponse list(
            @org.springframework.web.bind.annotation.RequestParam(required = false) com.hospitality.mis.entity.reservation.ReservationStatus status,
            @org.springframework.web.bind.annotation.RequestParam(name = "guest_id", required = false) Long guestId,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "0") int page,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "20") int size) {
        return service.list(status, guestId, page, size);
    }





    /**
     * Tạo đặt phòng qua POST /api/reservations; body tạo đặt phòng được {@code @Valid} kiểm tra, header
     * {@code Idempotency-Key} tùy chọn giúp service chống tạo trùng khi client gửi lại. Trả 201 cùng đặt phòng mới.
     * Chỉ RESERVATION_CREATE được phép; xung đột phòng, dữ liệu sai hoặc khóa không hợp lệ do service xử lý.
     */
    @PostMapping

    @ResponseStatus(HttpStatus.CREATED)

    @PreAuthorize("@departmentAccess.allows(authentication, 'RESERVATION_CREATE')")
    public ReservationDtos.Response create(@Valid @RequestBody ReservationDtos.CreateRequest request,
                                           @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {

        return service.create(request, SecurityActor.currentActor(), idempotencyKey);

    }




    /**
     * Lấy chi tiết đặt phòng qua GET /api/reservations/{id}; id là path parameter và response là đặt phòng tương ứng.
     * Chỉ RESERVATION_READ được phép; ngoài ra controller giới hạn nhân viên chỉ xem đặt phòng của mình, trừ vai trò đọc toàn cục.
     * Không có body hay idempotency key; đặt phòng không tồn tại hoặc vượt phạm vi bị trả lỗi.
     */
    @org.springframework.web.bind.annotation.GetMapping("/{id}")

    @PreAuthorize("@departmentAccess.allows(authentication, 'RESERVATION_READ')")
    public ReservationDtos.Response get(@PathVariable Long id) {
        ReservationDtos.Response response = service.get(id);
        String actor = SecurityActor.currentActor();
        if (!actor.equals(response.employeeId()) && !isGlobalReadRole()) {
            throw new AccessDeniedException("Không được phép xem đặt phòng ngoài phạm vi");
        }
        return response;
    }

    private boolean isGlobalReadRole() {
        return com.hospitality.mis.middleware.security.ReservationAccess.hasGlobalRead();
    }




    /**
     * Nhận phòng qua POST /api/reservations/{id}/check-in; id là path parameter, body check-in tùy chọn và header
     * {@code Idempotency-Key} bắt buộc để tránh xử lý lặp. Trả đặt phòng sau chuyển trạng thái.
     * Body tùy chọn không gắn {@code @Valid}, nên quy tắc nội dung do service xử lý; chỉ RESERVATION_WRITE được phép,
     * còn trạng thái hoặc khóa lặp sai tạo lỗi nghiệp vụ.
     */
    @PostMapping("/{id}/check-in")


    @PreAuthorize("@departmentAccess.allows(authentication, 'RESERVATION_WRITE')")
    public ReservationDtos.Response checkIn(@PathVariable Long id,

                                            @RequestBody(required = false) ReservationDtos.CheckInRequest request,
                                            @RequestHeader("Idempotency-Key") String idempotencyKey) {

        return service.checkIn(id, request, SecurityActor.currentActor(), idempotencyKey);

    }





    /**
     * Trả phòng và chốt hóa đơn qua POST /api/reservations/{id}/check-out.
     * id là path parameter, body checkout bắt buộc và được {@code @Valid} kiểm tra, header {@code Idempotency-Key} bắt buộc.
     * Trả response hóa đơn; chỉ RESERVATION_CHECKOUT được phép, còn trạng thái đặt phòng, thanh toán hoặc khóa lặp do service báo lỗi.
     */
    @PostMapping("/{id}/check-out")


    @PreAuthorize("@departmentAccess.allows(authentication, 'RESERVATION_CHECKOUT')")
    public com.hospitality.mis.dto.billing.InvoiceDtos.Response checkOut(

            @PathVariable Long id, @Valid @RequestBody ReservationDtos.CheckOutRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {

        return service.checkOut(id, request, SecurityActor.currentActor(), idempotencyKey);

    }





    /**
     * Hủy đặt phòng qua POST /api/reservations/{id}/cancel; id là path parameter, body lý do được {@code @Valid} kiểm tra,
     * header {@code Idempotency-Key} bắt buộc. Trả đặt phòng sau hủy; chỉ RESERVATION_WRITE được phép và service xử lý hoàn tiền,
     * trạng thái không thể hủy hoặc khóa lặp bằng lỗi nghiệp vụ.
     */
    @PostMapping("/{id}/cancel")


    @PreAuthorize("@departmentAccess.allows(authentication, 'RESERVATION_WRITE')")
    public ReservationDtos.Response cancel(@PathVariable Long id, @Valid @RequestBody ReservationDtos.CancelRequest request,
                                           @RequestHeader("Idempotency-Key") String idempotencyKey) {

        return service.cancel(id, request, SecurityActor.currentActor(), idempotencyKey);

    }

    @PostMapping("/{id}/confirm")
    @PreAuthorize("@departmentAccess.allows(authentication, 'RESERVATION_WRITE')")
    public ReservationDtos.Response confirm(@PathVariable Long id,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        return service.confirm(id, SecurityActor.currentActor(), idempotencyKey);
    }

    @GetMapping("/{id}/timeline")
    @PreAuthorize("@departmentAccess.allows(authentication, 'RESERVATION_READ')")
    public List<com.hospitality.mis.dto.governance.AuditDtos.Response> timeline(@PathVariable Long id) {
        ReservationDtos.Response response = service.get(id);
        if (!SecurityActor.currentActor().equals(response.employeeId()) && !isGlobalReadRole())
            throw new AccessDeniedException("Không được phép xem timeline ngoài phạm vi");
        return service.timeline(id);
    }

    /**
     * Đánh dấu khách không đến qua POST /api/reservations/{id}/no-show; id là path parameter và header
     * {@code Idempotency-Key} bắt buộc, không có body. Trả đặt phòng sau cập nhật; chỉ RESERVATION_WRITE được phép,
     * còn trạng thái không phù hợp hoặc khóa lặp do service xử lý.
     */
    @PostMapping("/{id}/no-show")
    @PreAuthorize("@departmentAccess.allows(authentication, 'RESERVATION_WRITE')")
    public ReservationDtos.Response noShow(@PathVariable Long id,
                                           @RequestHeader("Idempotency-Key") String idempotencyKey) {
        return service.markNoShow(id, SecurityActor.currentActor(), idempotencyKey);
    }






    /**
     * Thêm dịch vụ vào đặt phòng qua POST /api/reservations/{id}/services; id là path parameter, body được {@code @Valid} kiểm tra,
     * header {@code Idempotency-Key} bắt buộc. Trả đặt phòng sau cập nhật; chỉ RESERVATION_SERVICE_WRITE được phép,
     * còn dịch vụ không tồn tại, trạng thái sai hoặc khóa lặp do service xử lý.
     */
    @PostMapping("/{id}/services")


    @PreAuthorize("@departmentAccess.allows(authentication, 'RESERVATION_SERVICE_WRITE')")
    public ReservationDtos.Response addService(@PathVariable Long id,

                                               @Valid @RequestBody ReservationDtos.AddServiceRequest request,
                                               @RequestHeader("Idempotency-Key") String idempotencyKey) {

        return service.addService(id, request, SecurityActor.currentActor(), idempotencyKey);

    }





    /**
     * Ghi nhận sự cố thiết bị của đặt phòng qua POST /api/reservations/{id}/equipment-incidents.
     * id là path parameter, body sự cố được {@code @Valid} kiểm tra, header {@code Idempotency-Key} bắt buộc chống ghi trùng;
     * trả response sự cố. Chỉ INCIDENT_WRITE được phép, còn đặt phòng không hợp lệ, validation hoặc khóa lặp do service xử lý.
     */
    @PostMapping("/{id}/equipment-incidents")


    @PreAuthorize("@departmentAccess.allows(authentication, 'INCIDENT_WRITE')")
    public com.hospitality.mis.dto.operations.EquipmentIncidentDtos.Response equipmentIncident(

            @PathVariable Long id,

            @Valid @RequestBody com.hospitality.mis.dto.operations.EquipmentIncidentDtos.CreateRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {

        return incidents.record(id, request, SecurityActor.currentActor(), idempotencyKey);

    }

}

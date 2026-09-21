package com.hospitality.mis.controller.guest;
import com.hospitality.mis.dto.guest.GuestDtos;




import com.hospitality.mis.service.guest.GuestService;

import com.hospitality.mis.middleware.security.SecurityActor;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;

import org.springframework.security.access.prepost.PreAuthorize;

import org.springframework.web.bind.annotation.GetMapping;

import org.springframework.web.bind.annotation.PathVariable;

import org.springframework.web.bind.annotation.PostMapping;

import org.springframework.web.bind.annotation.RequestBody;

import org.springframework.web.bind.annotation.RequestMapping;

import org.springframework.web.bind.annotation.RequestParam;

import org.springframework.web.bind.annotation.ResponseStatus;

import org.springframework.web.bind.annotation.RestController;



import java.util.List;



/**
 * Tra cứu và tạo hồ sơ khách lưu trú.
 */
@RestController

@RequestMapping("/api/guests")

public class GuestController {

    /** Dịch vụ tìm kiếm, đọc và tạo hồ sơ khách; actor được truyền khi tạo dữ liệu. */
    private final GuestService service;



    public GuestController(GuestService service) {

        this.service = service;

    }




    /**
     * Tìm khách qua GET /api/guests?q=...; q là query parameter tùy chọn và response là danh sách hồ sơ phù hợp.
     * Chỉ GUEST_READ được phép; lỗi truy vấn do dịch vụ xử lý. Đây là thao tác đọc nên không có idempotency concern.
     */
    @GetMapping
    @PreAuthorize("@departmentAccess.allows(authentication, 'GUEST_READ')")
    public List<GuestDtos.Response> search(@RequestParam(name = "q", required = false) String q) {
        return service.search(q);
    }


    /**
     * Lấy một hồ sơ khách qua GET /api/guests/{id}; id là path parameter và response là hồ sơ tương ứng.
     * Chỉ GUEST_READ được phép; khách không tồn tại hoặc id không hợp lệ tạo lỗi từ dịch vụ, không có body hay idempotency key.
     */
    @GetMapping("/{id}")

    @PreAuthorize("@departmentAccess.allows(authentication, 'GUEST_READ')")
    public GuestDtos.Response get(@PathVariable Long id) {
        return service.get(id);

    }





    /**
     * Tạo hồ sơ khách qua POST /api/guests; body được {@code @Valid} kiểm tra, actor hiện tại được ghi nhận,
     * trả 201 cùng hồ sơ mới. Chỉ GUEST_WRITE được phép; không có idempotency key, nên trùng dữ liệu hoặc lỗi nghiệp vụ do dịch vụ báo.
     */
    @PostMapping

    @ResponseStatus(HttpStatus.CREATED)

    @PreAuthorize("@departmentAccess.allows(authentication, 'GUEST_WRITE')")
    public GuestDtos.Response create(@Valid @RequestBody GuestDtos.CreateRequest request) {

        return service.create(request, SecurityActor.currentActor());

    }

}

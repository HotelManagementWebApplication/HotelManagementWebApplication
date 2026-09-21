package com.hospitality.mis.controller.room;
import com.hospitality.mis.dto.room.RoomDtos;




import com.hospitality.mis.common.exception.DomainException;

import com.hospitality.mis.service.room.RoomService;

import com.hospitality.mis.entity.room.RoomStatus;

import com.hospitality.mis.middleware.security.SecurityActor;

import org.springframework.format.annotation.DateTimeFormat;

import org.springframework.security.access.prepost.PreAuthorize;

import org.springframework.web.bind.annotation.GetMapping;

import org.springframework.web.bind.annotation.PatchMapping;

import org.springframework.web.bind.annotation.PathVariable;

import org.springframework.web.bind.annotation.RequestMapping;

import org.springframework.web.bind.annotation.RequestParam;

import org.springframework.web.bind.annotation.RestController;



import java.time.LocalDateTime;

import java.util.List;



/**
 * Tra cứu phòng, kiểm tra khả dụng và cập nhật trạng thái vận hành của phòng.
 */
@RestController

@RequestMapping("/api/rooms")

public class RoomController {

    /** Dịch vụ truy vấn khả dụng và thay đổi trạng thái phòng theo quy tắc vận hành. */
    private final RoomService service;



    public RoomController(RoomService service) {

        this.service = service;

    }



    /**
     * Tìm phòng qua GET /api/rooms?type=...&status=...; type và status là query tùy chọn.
     * status nhận đúng giá trị canonical lower_snake_case; giá trị không hợp lệ tạo lỗi INVALID_ROOM_STATUS; trả danh sách phòng.
     * Chỉ ROOM_READ được phép, thao tác đọc không có idempotency concern.
     */
    @GetMapping


    @PreAuthorize("@departmentAccess.allows(authentication, 'ROOM_READ')")
    public List<RoomDtos.Response> search(@RequestParam(name = "type", required = false) String type,

                                          @RequestParam(name = "status", required = false) String status) {

        return service.search(type, parseStatus(status));

    }



    /**
     * Tra cứu phòng khả dụng qua GET /api/rooms/availability?from=...&to=...&type=....
     * from và to là query bắt buộc dạng ISO date-time, type tùy chọn; trả danh sách khoảng/phòng khả dụng.
     * Chỉ ROOM_READ được phép; định dạng/thời gian không hợp lệ hoặc lỗi nghiệp vụ do service xử lý, thao tác đọc không cần idempotency.
     */
    @GetMapping("/availability")


    @PreAuthorize("@departmentAccess.allows(authentication, 'ROOM_READ')")
    public List<RoomDtos.Availability> availability(

            @RequestParam(name = "from") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,

            @RequestParam(name = "to") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,

            @RequestParam(name = "type", required = false) String type) {

        return service.availability(from, to, type);

    }





    /**
     * Cập nhật trạng thái phòng qua PATCH /api/rooms/{id}/status; id là path parameter và status là query bắt buộc.
     * status được parse theo giá trị canonical API, sai giá trị trả lỗi INVALID_ROOM_STATUS; response là phòng sau cập nhật.
     * Chỉ ROOM_WRITE được phép, actor hiện tại được truyền; không có idempotency key và xung đột/trạng thái sai do service xử lý.
     */
    @PatchMapping("/{id}/status")


    @PreAuthorize("@departmentAccess.allows(authentication, 'ROOM_WRITE')")
    public RoomDtos.Response updateStatus(@PathVariable String id, @RequestParam(name = "status") String status) {

        return service.updateStatus(id, parseStatus(status), SecurityActor.currentActor());

    }



    private RoomStatus parseStatus(String value) {

        if (value == null) {

            return null;

        }

        try {

            return RoomStatus.fromApiValue(value);
        } catch (IllegalArgumentException exception) {

            throw new DomainException("INVALID_ROOM_STATUS", "Trạng thái phòng không hợp lệ: " + value);

        }

    }

}

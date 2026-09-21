package com.hospitality.mis.controller.operations;

import com.hospitality.mis.dto.operations.FrontDeskDashboardDtos;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import com.hospitality.mis.service.operations.FrontDeskDashboardService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/** API dashboard vận hành trong ngày cho Front Desk và quản lý. */
@RestController
@RequestMapping("/api/front-desk")
public class FrontDeskDashboardController {
    private final FrontDeskDashboardService service;

    public FrontDeskDashboardController(FrontDeskDashboardService service) { this.service = service; }

    @GetMapping("/dashboard")
    @PreAuthorize("@departmentAccess.allows(authentication, 'FRONT_DESK_DASHBOARD')")
    public FrontDeskDashboardDtos.Response dashboard(
            @RequestParam(name = "date", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(name = "q", required = false) String q,
            @RequestParam(name = "status", required = false) ReservationStatus status,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {
        return service.get(date, q, status, page, size);
    }
}

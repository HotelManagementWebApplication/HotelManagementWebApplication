package com.hospitality.mis.controller.reservation;

import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.reservation.HotelServiceBookingService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.time.LocalDate;

/** Dịch vụ khách sạn đặt trước bởi khách đã thanh toán cọc. */
@RestController
public class HotelServiceBookingController {
    private final HotelServiceBookingService service;

    public HotelServiceBookingController(HotelServiceBookingService service) { this.service = service; }

    @PostMapping("/api/customer/service-bookings")
    @PreAuthorize("hasRole('CUSTOMER')")
    @ResponseStatus(HttpStatus.CREATED)
    public HotelServiceBookingService.Response book(@RequestBody HotelServiceBookingService.Request request,
                                                     @RequestHeader("Idempotency-Key") String key) {
        return service.bookForCustomer(request, key);
    }

    @GetMapping("/api/customer/service-bookings")
    @PreAuthorize("hasRole('CUSTOMER')")
    public List<HotelServiceBookingService.Response> list(@RequestParam("reservation_id") long reservationId) {
        return service.customerBookings(reservationId);
    }

    @GetMapping("/api/reservations/{reservationId}/service-bookings")
    @PreAuthorize("@departmentAccess.allows(authentication, 'RESERVATION_SERVICE_WRITE')")
    public List<HotelServiceBookingService.Response> staffList(@PathVariable long reservationId) {
        return service.staffBookings(reservationId);
    }

    @GetMapping("/api/operations/restaurant/service-bookings")
    @PreAuthorize("@departmentAccess.allows(authentication, 'RESTAURANT_ORDER_READ')")
    public List<HotelServiceBookingService.Response> restaurantBookings(
            @RequestParam(name = "date", required = false) LocalDate date,
            @RequestParam(name = "status", required = false) String status) {
        return service.restaurantBookings(date, status);
    }

    @PostMapping("/api/operations/restaurant/service-bookings/{id}/use")
    @PreAuthorize("@departmentAccess.allows(authentication, 'RESTAURANT_ORDER_WRITE')")
    public HotelServiceBookingService.Response useRestaurantBooking(@PathVariable long id) {
        return service.markRestaurantUsed(id, SecurityActor.currentActor());
    }

    @PostMapping("/api/customer/service-bookings/{id}/cancel")
    @PreAuthorize("hasRole('CUSTOMER')")
    public HotelServiceBookingService.Response cancel(@PathVariable long id) {
        return service.cancelForCustomer(id);
    }

    @PostMapping("/api/reservations/{reservationId}/service-bookings/{id}/use")
    @PreAuthorize("@departmentAccess.allows(authentication, 'RESERVATION_SERVICE_WRITE')")
    public HotelServiceBookingService.Response use(@PathVariable long reservationId, @PathVariable long id) {
        return service.markUsed(reservationId, id, SecurityActor.currentActor());
    }
}

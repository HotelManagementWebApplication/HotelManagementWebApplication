package com.hospitality.mis.controller.reservation;

import com.hospitality.mis.dto.reservation.CustomerReservationDtos;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.reservation.CustomerReservationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** API booking online dành riêng cho customer đã đăng nhập. */
@RestController
@RequestMapping("/api/customer/reservations")
@PreAuthorize("hasRole('CUSTOMER')")
public class CustomerReservationController {
    private final CustomerReservationService service;

    public CustomerReservationController(CustomerReservationService service) { this.service = service; }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CustomerReservationDtos.Response create(@Valid @RequestBody CustomerReservationDtos.CreateRequest request) {
        return service.create(request, SecurityActor.currentActor());
    }

    @GetMapping
    public List<CustomerReservationDtos.Response> list() { return service.list(SecurityActor.currentActor()); }

    @GetMapping("/{id}")
    public CustomerReservationDtos.Response get(@PathVariable Long id) {
        return service.get(id, SecurityActor.currentActor());
    }

    @GetMapping("/{id}/deposit-payment")
    public CustomerReservationDtos.PaymentInstruction payment(@PathVariable Long id) {
        return service.payment(id, SecurityActor.currentActor());
    }

    @PostMapping("/{id}/cancel")
    public CustomerReservationDtos.Response cancel(
            @PathVariable Long id,
            @Valid @RequestBody com.hospitality.mis.dto.reservation.ReservationDtos.CancelRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        return service.cancel(id, request, SecurityActor.currentActor(), idempotencyKey);
    }
}

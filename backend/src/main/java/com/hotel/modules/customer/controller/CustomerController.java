package com.hotel.modules.customer.controller;

import com.hotel.modules.customer.dto.CustomerDto;
import com.hotel.modules.customer.service.CustomerService;
import com.hotel.utils.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {

    private final CustomerService customerService;

    public CustomerController(CustomerService customerService) {
        this.customerService = customerService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<CustomerDto>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(customerService.getAllCustomers(), "Lấy danh sách khách hàng thành công"));
    }
}

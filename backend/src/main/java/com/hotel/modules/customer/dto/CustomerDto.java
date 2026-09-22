package com.hotel.modules.customer.dto;

import lombok.Data;

@Data
public class CustomerDto {
    private Long id;
    private String fullName;
    private String identityCard;
    private String phone;
    private String email;
    private String address;
}

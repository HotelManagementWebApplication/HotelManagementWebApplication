package com.hospitality.mis.dto.billing;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import java.math.BigDecimal;
import java.time.LocalDateTime;
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record ServiceConsumptionDto(String id,String serviceId,LocalDateTime occurredAt,int quantity,
        int freeQuantity,BigDecimal unitPrice,BigDecimal amountDue) {}

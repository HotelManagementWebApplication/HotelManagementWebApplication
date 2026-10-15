package com.hospitality.mis.dto.billing;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
public final class ServiceAvailabilityDtos {
    private ServiceAvailabilityDtos(){}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Response(String serviceId,String unit,int capacity,long booked,long available,String mode,boolean consumesStock){}
}

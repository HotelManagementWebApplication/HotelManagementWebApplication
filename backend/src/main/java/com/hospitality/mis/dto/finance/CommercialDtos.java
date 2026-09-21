package com.hospitality.mis.dto.finance;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public final class CommercialDtos {
    private CommercialDtos() {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record SpaceResponse(String id, String partnerId, String partnerName, String name, int floor,
                                String zone, String accessPolicy, String serviceId) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record PartnerResponse(String id, String legalName, String brandName, String category,
                                  int floorFrom, int floorTo, BigDecimal fixedRent, BigDecimal serviceFee,
                                  BigDecimal commissionRate, BigDecimal commissionFloor, String status) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record SettlementResponse(long id, String partnerId, String partnerName, LocalDate periodStart,
                                     LocalDate periodEnd, BigDecimal fixedRent, BigDecimal serviceFee,
                                     BigDecimal actualRevenue, BigDecimal commissionRate, BigDecimal commissionFloor,
                                     BigDecimal commissionDue, BigDecimal totalDue, String status) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record VoucherRequest(@NotBlank String spaceId, @NotNull LocalDateTime visitAt, Long reservationId) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record VoucherResponse(String voucherCode, String spaceName, String zone, int floor,
                                  String accessPolicy, String membershipTier, LocalDateTime visitAt,
                                  String status) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record VoucherScanRequest(@NotNull BigDecimal revenueAmount) {}
}

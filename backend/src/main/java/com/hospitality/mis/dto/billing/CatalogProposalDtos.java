package com.hospitality.mis.dto.billing;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public final class CatalogProposalDtos {
    private CatalogProposalDtos() {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Request(
        @NotBlank @Pattern(regexp="SERVICE|WAREHOUSE") String kind,
        @NotBlank @Pattern(regexp="[A-Z0-9]{1,10}") String id,
        @NotBlank @Size(max=100) String name,
        @NotBlank String unit,
        @NotBlank String category,
        @NotNull @DecimalMin("0") @Digits(integer=8,fraction=2) BigDecimal price,
        @NotBlank @Size(max=300) String reason) {}
}

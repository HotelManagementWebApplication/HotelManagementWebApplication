package com.hospitality.mis.service.billing;



import org.springframework.beans.factory.annotation.Value;

import org.springframework.stereotype.Component;



import java.math.BigDecimal;

import java.math.RoundingMode;

import java.time.Duration;

import java.time.LocalDateTime;

import java.time.LocalDate;

import java.time.temporal.ChronoUnit;
import com.hospitality.mis.entity.guest.MembershipTier;
import com.hospitality.mis.common.exception.DomainException;



/** Đối tượng chính sách thuần túy: các phép tính không có tác động phụ lên cơ sở dữ liệu hoặc thời gian. */

@Component

public class PricingPolicy {

    /** Số giờ tối thiểu được tính cho hình thức thuê theo giờ. */
    private final int hourlyMinimum;

    /** Số phút miễn phí trước khi tính phụ thu trả phòng trễ. */
    private final int graceMinutes;

    /** Tỷ lệ giảm được cấu hình cho khách VIP; tier thực tế quyết định mức áp dụng. */
    private final BigDecimal vipDiscount;



    public PricingPolicy(@Value("${hotel.policy.hourly-minimum:3}") int hourlyMinimum,

                         @Value("${hotel.policy.late-checkout-grace-minutes:20}") int graceMinutes,

                         @Value("${hotel.policy.vip-discount-percent:10}") BigDecimal vipDiscount) {

        this.hourlyMinimum = hourlyMinimum; this.graceMinutes = graceMinutes; this.vipDiscount = vipDiscount;

    }



    /** Tính tiền phòng theo ngày hoặc theo giờ, áp dụng mức tối thiểu của thuê giờ. */
    public BigDecimal roomCharge(BigDecimal dailyPrice, LocalDateTime from, LocalDateTime to, boolean hourly) {

        return roomCharge(dailyPrice, null, from, to, hourly);

    }

    /** Tính tiền với giá giờ cấu hình theo loại phòng; dữ liệu cũ vẫn fallback về giá ngày/24. */
    public BigDecimal roomCharge(BigDecimal dailyPrice, BigDecimal configuredHourlyPrice,
                                 LocalDateTime from, LocalDateTime to, boolean hourly) {

        if (dailyPrice == null || dailyPrice.signum() < 0 || from == null || to == null || !from.isBefore(to))
            throw new DomainException("INVALID_PRICING_INPUT", "Không thể tính tiền phòng với dữ liệu thời gian/giá không hợp lệ");

        if (configuredHourlyPrice != null && configuredHourlyPrice.signum() < 0)
            throw new DomainException("INVALID_PRICING_INPUT", "Không thể tính tiền phòng với giá giờ không hợp lệ");

        long minutes = Math.max(1, Duration.between(from, to).toMinutes());

        if (!hourly) {

            long days = Math.max(1, (minutes + (24 * 60) - 1) / (24 * 60));

            return dailyPrice.multiply(BigDecimal.valueOf(days));

        }

        long hours = Math.max(hourlyMinimum, (minutes + 59) / 60);

        BigDecimal hourlyPrice = configuredHourlyPrice == null || configuredHourlyPrice.signum() == 0
                ? dailyPrice.divide(BigDecimal.valueOf(24), 2, RoundingMode.HALF_UP)
                : configuredHourlyPrice;

        return hourlyPrice.multiply(BigDecimal.valueOf(hours));

    }



    /** Tính phí gia hạn theo số giờ làm tròn lên từ số phút phát sinh. */
    public BigDecimal extensionCharge(BigDecimal dailyPrice, int extensionMinutes) {

        if (dailyPrice == null || extensionMinutes <= 0) return BigDecimal.ZERO;

        BigDecimal hourly = dailyPrice.divide(BigDecimal.valueOf(24), 2, RoundingMode.HALF_UP);

        long hours = (extensionMinutes + 59L) / 60L;

        return hourly.multiply(BigDecimal.valueOf(hours));

    }



    /** Tính phụ thu trả trễ sau thời gian ân hạn theo mốc trong ngày hoặc qua ngày. */
    public BigDecimal lateSurcharge(BigDecimal roomTotal, LocalDateTime plannedCheckout, LocalDateTime actualCheckout) {

        if (roomTotal == null || plannedCheckout == null || actualCheckout == null

                || !actualCheckout.isAfter(plannedCheckout.plusMinutes(graceMinutes))) return BigDecimal.ZERO;

        long lateDays = Duration.between(plannedCheckout.toLocalDate().atStartOfDay(), actualCheckout.toLocalDate().atStartOfDay()).toDays();
        int minuteOfDay = actualCheckout.getHour() * 60 + actualCheckout.getMinute();
        if (lateDays > 0) return roomTotal.setScale(2, RoundingMode.HALF_UP);
        BigDecimal rate = minuteOfDay <= 14 * 60 ? new BigDecimal("0.15")

                : minuteOfDay <= 16 * 60 ? new BigDecimal("0.20")

                : minuteOfDay <= 18 * 60 ? new BigDecimal("0.50") : BigDecimal.ONE;

        return roomTotal.multiply(rate).setScale(2, RoundingMode.HALF_UP);

    }



    /** Tính giảm giá phòng theo hạng thành viên; hạng STANDARD không giảm. */
    public BigDecimal vipDiscount(BigDecimal roomTotal, MembershipTier tier) {

        if (roomTotal == null || tier == null || tier == MembershipTier.STANDARD) return BigDecimal.ZERO;

        return roomTotal.multiply(BigDecimal.valueOf(tier.discountPercent()))
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

    }



    /** Làm tròn tổng hóa đơn đến nghìn đồng gần nhất và giữ scale tiền tệ. */
    public BigDecimal roundFinalTotal(BigDecimal total) {
        if (total == null) return BigDecimal.ZERO;
        return total.divide(BigDecimal.valueOf(1000), 0, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(1000)).setScale(2, RoundingMode.HALF_UP);
    }

    /** Tính bồi thường thiết bị theo tuổi thiết bị và số lượng tại ngày tham chiếu. */
    public BigDecimal equipmentCompensation(BigDecimal originalValue, LocalDate purchasedAt, int quantity,

                                            LocalDate referenceDate) {

        if (originalValue == null || purchasedAt == null || quantity <= 0 || referenceDate == null) return BigDecimal.ZERO;

        if (purchasedAt.isAfter(referenceDate))
            throw new DomainException("INVALID_EQUIPMENT_DATE", "Ngày mua thiết bị không được sau ngày tính bồi thường");
        BigDecimal multiplier = referenceDate.isAfter(purchasedAt.plusYears(2))
                ? new BigDecimal("2.00") : new BigDecimal("1.50");

        return originalValue.multiply(multiplier).multiply(BigDecimal.valueOf(quantity)).setScale(2, RoundingMode.HALF_UP);

    }

}

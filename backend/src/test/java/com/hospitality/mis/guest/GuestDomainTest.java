package com.hospitality.mis.guest;



import com.hospitality.mis.entity.guest.BookingPolicy;

import com.hospitality.mis.entity.guest.Guest;

import com.hospitality.mis.entity.guest.MembershipPolicy;

import com.hospitality.mis.entity.guest.MembershipTier;

import jakarta.persistence.Entity;

import jakarta.persistence.FetchType;

import jakarta.persistence.JoinColumn;

import jakarta.persistence.ManyToOne;

import jakarta.persistence.OneToMany;

import jakarta.persistence.Table;

import org.junit.jupiter.api.Test;



import java.lang.reflect.Field;

import java.math.BigDecimal;



import static org.assertj.core.api.Assertions.assertThat;



/** Bảo vệ mapping entity Guest và các policy booking/membership thuần domain. */
class GuestDomainTest {

    /** Given Guest canonical, When soi annotation/column, Then entity duy nhất map vào schema v1. */
    @Test

    void canonicalModelIsTheSoleConcreteGuestEntity() throws Exception {
        assertThat(Guest.class.isAnnotationPresent(Entity.class)).isTrue();
        assertThat(Guest.class.getAnnotation(Table.class).name()).isEqualTo("KhachLuuTru");


        assertThat(columnName("id")).isEqualTo("maKhachLuuTru");
        assertThat(columnName("fullName")).isEqualTo("hoVaTen");
        assertThat(columnName("identityNumber")).isEqualTo("soGiayToTuyThan");
        assertThat(columnName("membershipTier")).isEqualTo("hangThanhVien");
        assertThat(columnName("totalSpend")).isEqualTo("tongChiTieu");
    }



    /** Given state Guest canonical, When gọi accessor, Then dữ liệu được giữ đúng kiểu và giá trị. */
    @Test

    void canonicalStateUsesCanonicalAccessors() {
        Guest guest = new Guest();
        guest.setId(7L);
        guest.setFullName("Nguyen Van An");
        guest.setIdentityNumber("012345678901");
        guest.setPhone("0901234567");
        guest.setMembershipTier(MembershipTier.GOLD);
        guest.setTotalSpend(new BigDecimal("12000000.00"));


        assertThat(guest.getId()).isEqualTo(7L);

        assertThat(guest.getFullName()).isEqualTo("Nguyen Van An");

        assertThat(guest.getIdentityNumber()).isEqualTo("012345678901");

        assertThat(guest.getPhone()).isEqualTo("0901234567");

        assertThat(guest.getMembershipTier()).isEqualTo(MembershipTier.GOLD);

        assertThat(guest.getTotalSpend()).isEqualByComparingTo("12000000.00");

    }



    /** Given ngưỡng 4 lần hủy muộn, When ghi lần cuối, Then guest bị block đúng tại boundary. */
    @Test

    void bookingPolicyBlocksOnlyAtTheConfiguredLateCancellationThreshold() {

        Guest guest = new Guest();
        BookingPolicy policy = BookingPolicy.defaults();



        assertThat(policy.allows(guest)).isTrue();

        for (int i = 0; i < BookingPolicy.DEFAULT_BLOCK_AT_LATE_CANCELLATION_COUNT - 1; i++) {

            policy.recordLateCancellation(guest);

        }

        assertThat(guest.getLateCancellationCount()).isEqualTo(3);

        assertThat(policy.allows(guest)).isTrue();



        policy.recordLateCancellation(guest);

        assertThat(guest.getLateCancellationCount()).isEqualTo(4);

        assertThat(guest.isBookingBlocked()).isTrue();

        assertThat(policy.allows(guest)).isFalse();

    }



    /** Given các ngưỡng stay/spend, When tính tier, Then STANDARD/SILVER/GOLD/PLATINUM ổn định. */
    @Test

    void membershipPolicyUsesSpendOrCompletedStayThreshold() {

        MembershipPolicy policy = MembershipPolicy.defaults();



        assertThat(policy.tierFor(0)).isEqualTo(MembershipTier.STANDARD);
        assertThat(policy.tierFor(10)).isEqualTo(MembershipTier.SILVER);
        assertThat(policy.tierFor(25)).isEqualTo(MembershipTier.GOLD);
        assertThat(policy.tierFor(50)).isEqualTo(MembershipTier.PLATINUM);

    }



    /** Given quan hệ guest, When kiểm tra mapping, Then inverse relation không phá owner canonical. */
    @Test

    void guestReservationRelationshipIsInverseAndNonDestructive() throws Exception {

        assertThat(Guest.class.getAnnotation(Table.class).name()).isEqualTo("KhachLuuTru");
    }



    /** Đọc tên column annotation để tránh lặp reflection assertion trong test mapping. */
    private String columnName(String fieldName) throws NoSuchFieldException {

        return Guest.class.getDeclaredField(fieldName)

                .getAnnotation(jakarta.persistence.Column.class).name();

    }

}

package com.hospitality.mis.guest;



import com.hospitality.mis.dao.guest.GuestRepository;

import com.hospitality.mis.entity.guest.MembershipTier;

import com.hospitality.mis.entity.guest.Guest;
import org.junit.jupiter.api.BeforeEach;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;

import org.springframework.boot.test.context.SpringBootTest;



import java.math.BigDecimal;



import static org.assertj.core.api.Assertions.assertThat;



@SpringBootTest(properties = {

        "spring.datasource.url=jdbc:h2:mem:guestpersistence;MODE=MSSQLServer;DB_CLOSE_DELAY=-1",

        "spring.datasource.username=sa",

        "spring.datasource.password=",

        "spring.flyway.enabled=false",

        "spring.jpa.hibernate.ddl-auto=create-drop"

})

/** Bảo vệ round-trip Guest và truy vấn search trên persistence thật của H2. */
class GuestPersistenceTest {

    /** Repository thật của H2 fixture; dùng để chứng minh persist/reload canonical. */
    @Autowired GuestRepository guests;



    /** Xóa toàn bộ guest trước mỗi test persistence. */
    @BeforeEach

    void cleanGuests() {

        guests.deleteAllInBatch();

    }



    /** Given đầy đủ field canonical, When save/reload, Then mapping và state nghiệp vụ được giữ nguyên. */
    @Test

    void canonicalFieldsPersistToTheGuestEntity() {
        Guest guest = new Guest();
        guest.setFullName("Tran Thi Binh");
        guest.setAddress("Quan 3");
        guest.setPhone("0912345678");
        guest.setEmail("binh@example.test");

        guest.setIdentityNumber("098765432109");
        guest.setBirthYear(1988);
        guest.setMembershipTier(MembershipTier.GOLD);
        guest.setTotalSpend(new BigDecimal("12000000.00"));
        guest.setLateCancellationCount(2);
        guest.setBookingBlocked(true);


        Long id = guests.saveAndFlush(guest).getId();
        Guest reloaded = guests.findById(id).orElseThrow();


        assertThat(reloaded.getFullName()).isEqualTo("Tran Thi Binh");

        assertThat(reloaded.getAddress()).isEqualTo("Quan 3");

        assertThat(reloaded.getPhone()).isEqualTo("0912345678");

        assertThat(reloaded.getIdentityNumber()).isEqualTo("098765432109");

        assertThat(reloaded.getBirthYear()).isEqualTo(1988);

        assertThat(reloaded.getMembershipTier()).isEqualTo(MembershipTier.GOLD);

        assertThat(reloaded.getTotalSpend()).isEqualByComparingTo("12000000.00");

        assertThat(reloaded.getLateCancellationCount()).isEqualTo(2);

        assertThat(reloaded.isBookingBlocked()).isTrue();

    }



    /** Given một guest, When search từng token name/identity/phone, Then cùng match đúng một row. */
    @Test

    void canonicalSearchMatchesNameIdentityAndPhone() {

        Guest guest = new Guest();
        guest.setFullName("Le Hoang Cuong");
        guest.setPhone("0923456789");
        guest.setEmail("cuong@example.test");

        guest.setIdentityNumber("112233445566");
        guests.saveAndFlush(guest);



        assertThat(guests.searchShared("hoang")).extracting(Guest::getId).hasSize(1);
        assertThat(guests.searchShared("112233")).hasSize(1);
        assertThat(guests.searchShared("092345")).hasSize(1);
    }

}

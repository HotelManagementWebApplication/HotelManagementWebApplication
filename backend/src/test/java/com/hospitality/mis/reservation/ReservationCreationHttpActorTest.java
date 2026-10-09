package com.hospitality.mis.reservation;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.core.context.SecurityContextHolder;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
class ReservationCreationHttpActorTest extends ReservationSqlFixture {
    @Autowired MockMvc mvc;
    @Test void authenticatedActorCreatesAndRetryKeepsOneBooking()throws Exception{
        String request=body("HCT-FD");
        for(int i=0;i<2;i++)mvc.perform(post("/api/reservations").contentType(APPLICATION_JSON).content(request))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.guest_id").value(guest)).andExpect(jsonPath("$.employee_id").value("HCT-FD")).andExpect(jsonPath("$.status").value("DEPOSIT_PAID"));
        assertThat(count()).isEqualTo(1);
    }
    @Test void spoofedActorAndAnonymousCannotWrite()throws Exception{
        mvc.perform(post("/api/reservations").contentType(APPLICATION_JSON).content(body("other")))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("ACTOR_MISMATCH"));
        SecurityContextHolder.clearContext();
        mvc.perform(post("/api/reservations").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.anonymous()).contentType(APPLICATION_JSON).content(body("HCT-FD"))).andExpect(status().isUnauthorized());
        assertThat(count()).isZero();
    }
    @Test void unknownBookingSourceReturnsValidationErrorAndWritesNothing()throws Exception{
        String invalid=body("HCT-FD").replace("\"rental_type\":\"PACKAGE\"", "\"rental_type\":\"PACKAGE\",\"booking_source\":\"DIRECT_FRONT_DESK\"");
        mvc.perform(post("/api/reservations").contentType(APPLICATION_JSON).content(invalid))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
            .andExpect(jsonPath("$.details[0]").value("bookingSource: Nguồn đặt phòng không hợp lệ"));
        assertThat(count()).isZero();
    }
    private int count(){return jdbc.queryForObject("SELECT COUNT(*) FROM PhieuDatPhong WHERE maNhanVien=N'HCT-FD'",Integer.class);}
    private String body(String actor){return "{\"guest_id\":"+guest+",\"employee_id\":\""+actor+"\",\"deposit\":1200000,\"rental_type\":\"PACKAGE\",\"idempotency_key\":\"hct-http-create\",\"rooms\":[{\"room_id\":\"HCT-R1\",\"expected_check_in\":\"2031-01-05T12:00:00\",\"expected_check_out\":\"2031-01-06T12:00:00\"}]}";}
}

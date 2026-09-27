package com.hospitality.mis.reservation;

import com.hospitality.mis.entity.guest.Guest;
import com.hospitality.mis.entity.identity.Employee;
import com.hospitality.mis.entity.identity.EmployeeRole;
import com.hospitality.mis.entity.reservation.*;
import com.hospitality.mis.entity.room.*;
import com.hospitality.mis.service.reservation.ReservationService;
import com.hospitality.mis.dto.reservation.ReservationDtos;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.Clock;
import java.time.ZoneId;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.http.MediaType.APPLICATION_JSON;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:crossshift;MODE=MSSQLServer;DB_CLOSE_DELAY=-1",
    "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
@Transactional
@WithMockUser(username = "next-shift", roles = "FRONT_DESK")
/** Bảo vệ workflow qua ca: actor mới được vận hành booking cũ, còn creator không mở rộng quyền. */
class CrossShiftReservationWorkflowTest {
    /** HTTP boundary thật của workflow liên ca. */
    @Autowired MockMvc mvc;
    /** EntityManager seed aggregate và đọc audit sau request. */
    @Autowired EntityManager em;
    /** Reservation service thật để kiểm tra authorization/no-show trực tiếp. */
    @Autowired ReservationService service;
    /** Booking được tạo bởi shift-one và xử lý bởi next-shift. */
    private Reservation reservation;
    /** Mốc arrival cố định để kiểm tra check-in/no-show window. */
    private final LocalDateTime arrival = LocalDateTime.of(2031, 1, 10, 12, 0);

    /** Seed employee/guest/room/reservation CONFIRMED thuộc ca trước. */
    @BeforeEach void seed() {
        Employee creator = new Employee(); creator.setEmployeeId("shift-one");
        creator.setFullName("Previous shift"); creator.setPhone("0900000111");
        creator.setPassword("test"); creator.setRole(EmployeeRole.FRONT_DESK); em.persist(creator);
        Guest guest = new Guest(); guest.setFullName("Guest"); guest.setPhone("0900000112");
        guest.setIdentityNumber("123456789012"); em.persist(guest);
        RoomType type = new RoomType(); type.setId("standard"); type.setName("Standard");
        type.setDailyPrice(new BigDecimal("2400000")); em.persist(type);
        Room room = new Room(); room.setId("101"); room.setRoomType(type); room.setStatus(RoomStatus.READY); em.persist(room);
        reservation = new Reservation(); reservation.setEmployee(creator); reservation.setGuest(guest);
        reservation.setRentalType("PACKAGE"); reservation.setDepositAmount(BigDecimal.ZERO); reservation.transitionTo(ReservationStatus.CONFIRMED);
        ReservationRoom line = new ReservationRoom(); line.setRoom(room); line.setCheckIn(arrival);
        line.setCheckOut(arrival.plusDays(1)); line.setStatus(RoomStatus.RESERVED); reservation.addRoom(line);
        em.persist(reservation); em.flush();
    }

    /** Given booking của ca trước, When ca sau check-in/out, Then workflow thành công và audit là next-shift. */
    @Test void nextShiftFindsChecksInAndChecksOutBookingAndAuditUsesCurrentActor() throws Exception {
        mvc.perform(get("/api/reservations")).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].employee_id").value("shift-one"));
        mvc.perform(post("/api/reservations/{id}/check-in", reservation.getId())
                .header("Idempotency-Key", UUID.randomUUID().toString()).contentType(APPLICATION_JSON)
                .content("{\"at\":\"2031-01-10T12:00:00\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CHECKED_IN"));
        mvc.perform(post("/api/reservations/{id}/check-out", reservation.getId())
                .header("Idempotency-Key", UUID.randomUUID().toString()).contentType(APPLICATION_JSON)
                .content("{\"at\":\"2031-01-11T12:00:00\",\"payment_method\":\"CASH\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.payable").value(2400000));
        em.flush();
        assertThat(reservation.getStatus()).isEqualTo(ReservationStatus.CHECKED_OUT);
        assertThat(reservation.getEmployee().getEmployeeId()).isEqualTo("shift-one");
        Number audited = (Number) em.createNativeQuery("select count(*) from NhatKyKiemSoat where nguoiThucHien = 'next-shift' and hanhDong = 'RESERVATION_CHECKED_IN'").getSingleResult();
        assertThat(audited.longValue()).isEqualTo(1);
    }

    @ParameterizedTest @ValueSource(strings = {"ACCOUNTING", "HOUSEKEEPING", "TECHNICAL", "STAFF", "CUSTOMER", "ADMIN", "DIRECTOR"})
    /** Given mọi role không vận hành, When creator cố mutate, Then bị deny dù username là owner cũ. */
    void nonOperatorsCannotMutateEvenWhenTheyAreTheCreator(String role) {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("shift-one", "", "ROLE_" + role));
        assertThatThrownBy(() -> service.checkIn(reservation.getId(), new ReservationDtos.CheckInRequest(arrival), "shift-one", UUID.randomUUID().toString()))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        assertThat(reservation.getStatus()).isEqualTo(ReservationStatus.CONFIRMED);
    }

    /** Given không có authentication, When truyền actor thủ công, Then không được tin input client. */
    @Test void suppliedActorWithoutAuthenticationCannotMutate() {
        SecurityContextHolder.clearContext();
        assertThatThrownBy(() -> service.cancel(reservation.getId(), new ReservationDtos.CancelRequest("cancel"), "shift-one", UUID.randomUUID().toString()))
                .isInstanceOf(org.springframework.security.authentication.AuthenticationCredentialsNotFoundException.class);
        assertThat(reservation.getStatus()).isEqualTo(ReservationStatus.CONFIRMED);
    }

    /** Given clock trước/sau checkout, When mark no-show, Then boundary enforce và cọc bị forfeit sau hạn. */
    @Test void noShowIsRejectedWhileStayIsStillOpenAndForfeitsDepositAfterCheckoutTime() {
        reservation.setDepositAmount(new BigDecimal("500000"));
        ReflectionTestUtils.setField(service, "clock", Clock.fixed(
                arrival.plusHours(1).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant(),
                ZoneId.of("Asia/Ho_Chi_Minh")));
        assertThatThrownBy(() -> service.markNoShow(reservation.getId(), "next-shift", UUID.randomUUID().toString()))
                .extracting("code").isEqualTo("NO_SHOW_TOO_EARLY");
        ReflectionTestUtils.setField(service, "clock", Clock.fixed(
                arrival.plusDays(1).plusMinutes(1).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant(),
                ZoneId.of("Asia/Ho_Chi_Minh")));
        var response = service.markNoShow(reservation.getId(), "next-shift", UUID.randomUUID().toString());
        assertThat(response.status()).isEqualTo(ReservationStatus.NO_SHOW);
        assertThat(response.cancellationOutcome()).isEqualTo(com.hospitality.mis.entity.reservation.CancellationOutcome.FORFEIT);
        assertThat(response.cancellationReason()).contains("Khách không đến");
        assertThat(response.deposit()).isEqualByComparingTo("500000");
        assertThat(reservation.getRooms().get(0).getStatus()).isEqualTo(RoomStatus.CANCELLED);
    }

    /** Given khách chưa check-in quá stay window, When cancel, Then chuyển NO_SHOW và giữ cọc FORFEIT. */
    @Test void cancellingAfterStayWindowWithoutCheckInBecomesNoShowAndKeepsDeposit() {
        reservation.setDepositAmount(new BigDecimal("500000"));
        ReflectionTestUtils.setField(service, "clock", Clock.fixed(
                arrival.plusDays(1).plusMinutes(1).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant(),
                ZoneId.of("Asia/Ho_Chi_Minh")));
        var response = service.cancel(reservation.getId(), new ReservationDtos.CancelRequest("guest absent"),
                "next-shift", UUID.randomUUID().toString());
        assertThat(response.status()).isEqualTo(ReservationStatus.NO_SHOW);
        assertThat(response.cancellationOutcome()).isEqualTo(CancellationOutcome.FORFEIT);
        assertThat(response.deposit()).isEqualByComparingTo("500000");
    }
}

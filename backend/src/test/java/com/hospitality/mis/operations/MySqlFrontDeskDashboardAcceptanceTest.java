package com.hospitality.mis.operations;

import com.hospitality.mis.dto.operations.FrontDeskDashboardDtos;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import com.hospitality.mis.service.operations.FrontDeskDashboardService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/** MySQL acceptance for the front-desk dashboard's real service/JPA read path. */
@SpringBootTest(properties = {
        "spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}",
        "spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
@EnabledIfEnvironmentVariable(named = "MIGRATION_TEST_DB_URL", matches = ".+")
class MySqlFrontDeskDashboardAcceptanceTest {
    private static final LocalDate BUSINESS_DATE = LocalDate.of(2031, 1, 10);
    private static final long ALPHA = 9_310_001L;
    private static final long BETA = 9_310_002L;
    private static final long EARLY = 9_310_003L;
    private static final long DEPARTURE = 9_310_004L;
    private static final long CURRENT = 9_310_005L;
    private static final long UNPAID = 9_310_006L;
    private static final long INCIDENT_ONE = 9_320_001L;
    private static final long INCIDENT_TWO = 9_320_002L;

    @Autowired JdbcTemplate jdbc;
    @Autowired FrontDeskDashboardService dashboard;

    @BeforeEach
    void seed() {
        cleanup();
        jdbc.update("insert into room_types(id, name, daily_price) values (?,?,?)", "P1MY", "P1 MySQL", 100000);
        for (int i = 1; i <= 6; i++) {
            jdbc.update("insert into rooms(id, room_type_id, name, status) values (?,?,?,?)",
                    "M" + i, "P1MY", "MySQL room " + i, "available");
        }
        jdbc.update("insert into guests(id, full_name, phone, identity_number) values (?,?,?,?)",
                ALPHA, "Target Alpha", "0931000001", "931000000001");
        jdbc.update("insert into guests(id, full_name, phone, identity_number) values (?,?,?,?)",
                BETA, "Target Beta", "0931000002", "931000000002");
        jdbc.update("insert into guests(id, full_name, phone, identity_number) values (?,?,?,?)",
                EARLY, "Other Guest", "0931000003", "931000000003");
        jdbc.update("insert into guests(id, full_name, phone, identity_number) values (?,?,?,?)",
                DEPARTURE, "Departure Guest", "0931000004", "931000000004");
        jdbc.update("insert into guests(id, full_name, phone, identity_number) values (?,?,?,?)",
                CURRENT, "Current Guest", "0931000005", "931000000005");
        jdbc.update("insert into guests(id, full_name, phone, identity_number) values (?,?,?,?)",
                UNPAID, "Unpaid Guest", "0931000006", "931000000006");

        reservation(ALPHA, ALPHA, "CONFIRMED", "M1", BUSINESS_DATE.atTime(8, 0), BUSINESS_DATE.plusDays(1).atTime(12, 0), "NOT_REQUIRED");
        reservation(BETA, BETA, "CONFIRMED", "M2", BUSINESS_DATE.atTime(8, 0), BUSINESS_DATE.plusDays(1).atTime(12, 0), "NOT_REQUIRED");
        reservation(EARLY, EARLY, "CONFIRMED", "M3", BUSINESS_DATE.minusDays(1).atTime(14, 0), BUSINESS_DATE.plusDays(1).atTime(12, 0), "NOT_REQUIRED");
        reservation(DEPARTURE, DEPARTURE, "CHECKED_IN", "M4", BUSINESS_DATE.minusDays(1).atTime(14, 0), BUSINESS_DATE.atTime(10, 0), "NOT_REQUIRED");
        reservation(CURRENT, CURRENT, "CHECKED_IN", "M5", BUSINESS_DATE.minusDays(1).atTime(14, 0), BUSINESS_DATE.plusDays(1).atTime(12, 0), "NOT_REQUIRED");
        reservation(UNPAID, UNPAID, "CONFIRMED", "M6", BUSINESS_DATE.plusDays(2).atTime(14, 0), BUSINESS_DATE.plusDays(3).atTime(12, 0), "PENDING");
        jdbc.update("insert into invoices(id, reservation_id, room_total, amount_due, status) values (?,?,?,?,?)",
                9_330_001L, UNPAID, 100000, 25000, "CHUA_THANH_TOAN");
        incident(INCIDENT_ONE, "M1", "Lamp", 1000);
        incident(INCIDENT_TWO, "M2", "TV", 2000);
    }

    @AfterEach
    void cleanup() {
        jdbc.update("delete from equipment_incidents where id in (?,?)", INCIDENT_ONE, INCIDENT_TWO);
        jdbc.update("delete from invoices where reservation_id in (?,?,?,?,?,?)", ALPHA, BETA, EARLY, DEPARTURE, CURRENT, UNPAID);
        jdbc.update("delete from reservation_rooms where reservation_id in (?,?,?,?,?,?)", ALPHA, BETA, EARLY, DEPARTURE, CURRENT, UNPAID);
        jdbc.update("delete from reservations where id in (?,?,?,?,?,?)", ALPHA, BETA, EARLY, DEPARTURE, CURRENT, UNPAID);
        jdbc.update("delete from guests where id in (?,?,?,?,?,?)", ALPHA, BETA, EARLY, DEPARTURE, CURRENT, UNPAID);
        jdbc.update("delete from rooms where room_type_id = ?", "P1MY");
        jdbc.update("delete from room_types where id = ?", "P1MY");
    }

    @Test
    void reservationFilteringBucketsOrderingAndBoundedMetadataComeFromMySql() {
        FrontDeskDashboardDtos.Response searched = dashboard.get(BUSINESS_DATE, " target ", ReservationStatus.CONFIRMED, 1, 1);

        assertThat(searched.page()).isEqualTo(1);
        assertThat(searched.size()).isEqualTo(1);
        assertThat(searched.totalElements()).isEqualTo(2);
        assertThat(searched.totalPages()).isEqualTo(2);
        assertThat(searched.arrivals()).extracting(FrontDeskDashboardDtos.ReservationItem::reservationId)
                .containsExactly(BETA);

        FrontDeskDashboardDtos.Response arrivals = dashboard.get(BUSINESS_DATE, null, null, 0, 1000);
        assertThat(arrivals.arrivals()).extracting(FrontDeskDashboardDtos.ReservationItem::reservationId)
                .containsExactly(ALPHA, BETA);
        assertThat(arrivals.departures()).extracting(FrontDeskDashboardDtos.ReservationItem::reservationId)
                .containsExactly(DEPARTURE);
        assertThat(arrivals.currentStays()).extracting(FrontDeskDashboardDtos.ReservationItem::reservationId)
                .containsExactly(DEPARTURE, CURRENT);
        assertThat(arrivals.unpaidDeposits()).extracting(FrontDeskDashboardDtos.ReservationItem::reservationId)
                .containsExactly(UNPAID);
        assertThat(arrivals.invoiceBalances()).extracting(FrontDeskDashboardDtos.ReservationItem::reservationId)
                .containsExactly(UNPAID);
        assertThat(arrivals.totalElements()).isEqualTo(6);
        assertThat(arrivals.totalPages()).isEqualTo(1);
    }

    @Test
    void incidentsUseStableDatabaseOrderingAndBoundedPage() {
        FrontDeskDashboardDtos.Response page = dashboard.get(BUSINESS_DATE, null, null, 1, 1);

        assertThat(page.incidents()).hasSize(1);
        assertThat(page.incidents().get(0).id()).isEqualTo(INCIDENT_TWO);
        assertThat(page.totalElements()).isEqualTo(6);
        assertThat(page.totalPages()).isEqualTo(6);
        assertThat(jdbc.queryForObject("select count(*) from equipment_incidents where id in (?,?)", Integer.class,
                INCIDENT_ONE, INCIDENT_TWO)).isEqualTo(2);
    }

    private void reservation(long id, long guestId, String status, String room, LocalDateTime checkIn,
                             LocalDateTime checkOut, String depositStatus) {
        jdbc.update("insert into reservations(id, guest_id, status, rental_type, deposit_payment_status) values (?,?,?,?,?)",
                id, guestId, status, "PACKAGE", depositStatus);
        jdbc.update("insert into reservation_rooms(reservation_id, room_id, check_in, check_out, original_check_out) values (?,?,?,?,?)",
                id, room, checkIn, checkOut, checkOut);
    }

    private void incident(long id, String room, String equipment, int compensation) {
        jdbc.update("insert into equipment_incidents(id, reservation_id, room_id, equipment_name, original_value, purchased_on, quantity, compensation) values (?,?,?,?,?,?,?,?)",
                id, ALPHA, room, equipment, new BigDecimal("5000"), LocalDate.of(2030, 1, 1), 1, compensation);
    }
}

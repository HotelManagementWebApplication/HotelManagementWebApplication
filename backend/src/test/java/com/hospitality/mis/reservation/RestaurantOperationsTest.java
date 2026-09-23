package com.hospitality.mis.reservation;

import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.service.reservation.HotelServiceBookingService;
import org.h2.Driver;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SimpleDriverDataSource;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

/** Chứng minh luồng điều phối nhà hàng dùng dữ liệu thật và ghi nhận đủ tồn kho/audit. */
class RestaurantOperationsTest {
    private JdbcTemplate jdbc;
    private AuditService audit;
    private HotelServiceBookingService service;

    @BeforeEach
    void setUp() {
        var dataSource = new SimpleDriverDataSource(new Driver(),
                "jdbc:h2:mem:restaurant-" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", "");
        jdbc = new JdbcTemplate(dataSource);
        audit = mock(AuditService.class);
        Clock clock = Clock.fixed(ZonedDateTime.parse("2026-09-23T12:00:00+07:00").toInstant(),
                ZoneId.of("Asia/Ho_Chi_Minh"));
        service = new HotelServiceBookingService(jdbc, audit, clock);

        jdbc.execute("CREATE TABLE reservations (id BIGINT PRIMARY KEY, status VARCHAR(30))");
        jdbc.execute("""
                CREATE TABLE services (
                    id VARCHAR(40) PRIMARY KEY, name VARCHAR(120), category VARCHAR(60),
                    stock_quantity INT NOT NULL, active BOOLEAN NOT NULL)
                """);
        jdbc.execute("""
                CREATE TABLE hotel_service_bookings (
                    id BIGINT PRIMARY KEY, reservation_id BIGINT NOT NULL, room_id VARCHAR(20) NOT NULL,
                    service_id VARCHAR(40) NOT NULL, scheduled_at TIMESTAMP NOT NULL,
                    quantity INT NOT NULL, free_quantity INT NOT NULL, unit_price DECIMAL(15,2) NOT NULL,
                    meal_period VARCHAR(20), status VARCHAR(20) NOT NULL, note VARCHAR(255),
                    used_at TIMESTAMP, used_by VARCHAR(80))
                """);
        jdbc.execute("""
                CREATE TABLE inventory_movements (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY, service_id VARCHAR(40), type VARCHAR(20),
                    quantity INT, actor_id VARCHAR(80), occurred_at TIMESTAMP, reason VARCHAR(255))
                """);
        jdbc.update("INSERT INTO reservations(id,status) VALUES (1,'CHECKED_IN')");
        jdbc.update("INSERT INTO services(id,name,category,stock_quantity,active) VALUES ('MAMREST','Nhà hàng Mâm','fine-dining',10,TRUE)");
        jdbc.update("INSERT INTO services(id,name,category,stock_quantity,active) VALUES ('BREAKFAST','Bữa sáng','breakfast',10,TRUE)");
        jdbc.update("INSERT INTO services(id,name,category,stock_quantity,active) VALUES ('LNDRYSTD','Giặt ủi','laundry',10,TRUE)");
        addBooking(11, "MAMREST", "2026-09-23 10:00:00", "CONFIRMED", 2);
        addBooking(12, "BREAKFAST", "2026-09-23 08:00:00", "USED", 1);
        addBooking(13, "LNDRYSTD", "2026-09-23 09:00:00", "CONFIRMED", 1);
        addBooking(14, "MAMREST", "2026-09-24 10:00:00", "CONFIRMED", 1);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void restaurantQueueContainsOnlyFoodOrdersForSelectedDateAndCanFilterStatus() {
        var all = service.restaurantBookings(LocalDate.of(2026, 9, 23), null);
        var waiting = service.restaurantBookings(LocalDate.of(2026, 9, 23), " confirmed ");

        assertThat(all).extracting(HotelServiceBookingService.Response::id).containsExactly(12L, 11L);
        assertThat(all).extracting(HotelServiceBookingService.Response::serviceName)
                .containsExactly("Bữa sáng", "Nhà hàng Mâm");
        assertThat(waiting).extracting(HotelServiceBookingService.Response::id).containsExactly(11L);
    }

    @Test
    void markingRestaurantOrderUsedPersistsStatusStockMovementAndAudit() {
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated("KITCHEN", "", List.of()));

        var response = service.markRestaurantUsed(11L, "KITCHEN");

        assertThat(response.status()).isEqualTo("USED");
        assertThat(jdbc.queryForObject("SELECT stock_quantity FROM services WHERE id='MAMREST'", Integer.class))
                .isEqualTo(8);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM inventory_movements WHERE service_id='MAMREST' AND type='ISSUE' AND quantity=2 AND actor_id='KITCHEN'", Integer.class))
                .isEqualTo(1);
        verify(audit).record("KITCHEN", "HOTEL_SERVICE_USED", "RESERVATION", "1", null, "11", null);
    }

    private void addBooking(long id, String serviceId, String scheduledAt, String status, int quantity) {
        jdbc.update("""
                INSERT INTO hotel_service_bookings
                    (id,reservation_id,room_id,service_id,scheduled_at,quantity,free_quantity,unit_price,meal_period,status,note)
                VALUES (?,1,'504',?,?,?,0,150000,'LUNCH',?,'Kiểm thử nhà hàng')
                """, id, serviceId, scheduledAt, quantity, status);
    }
}

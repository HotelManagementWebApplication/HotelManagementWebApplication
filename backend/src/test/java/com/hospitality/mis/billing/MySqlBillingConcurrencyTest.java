package com.hospitality.mis.billing;

import com.hospitality.mis.dto.billing.PaymentTransactionDtos;
import com.hospitality.mis.dto.reservation.ReservationDtos;
import com.hospitality.mis.entity.billing.PaymentMethod;
import com.hospitality.mis.entity.billing.PaymentTransaction;
import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.service.billing.PaymentTransactionService;
import com.hospitality.mis.service.reservation.ReservationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/** Xác minh tính idempotent của thanh toán và cơ chế khóa hóa đơn bằng các giao dịch InnoDB thực tế. */
@SpringBootTest(properties = {
        "spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}",
        "spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
@EnabledIfEnvironmentVariable(named = "MIGRATION_TEST_DB_URL", matches = ".+")
class MySqlBillingConcurrencyTest {
    /** ID cố định để hai transaction đồng thời cùng tranh chấp một invoice/reservation. */
    private static final long ID = 9_900_001L;
    /** Actor fixture và khóa dọn dẹp dữ liệu test, không phải danh tính đặc biệt của production. */
    private static final String ACTOR = "cbill01";

    /** SQL trực tiếp giúp quan sát row và amount sau commit thực tế. */
    @Autowired JdbcTemplate jdbc;
    /** Service thanh toán thật, dùng transaction InnoDB và idempotency production. */
    @Autowired PaymentTransactionService payments;
    /** Service đặt phòng thật, dùng lock phòng để chống overbooking. */
    @Autowired ReservationService reservations;

    /** Seed một invoice và một phòng sạch trước mỗi test concurrency. */
    @BeforeEach
    void seed() {
        cleanup();
        jdbc.update("insert into employees(id, full_name, password, position, phone) values (?,?,?,?,?)",
                ACTOR, "Concurrency Billing", "unused", "FRONT_DESK", "0999900001");
        jdbc.update("insert into guests(id, full_name, phone, identity_number) values (?,?,?,?)",
                ID, "Concurrency Guest", "0999900002", "099900000001");
        jdbc.update("insert into room_types(id, name, daily_price) values (?,?,?)", "CTEST", "Concurrency", new BigDecimal("100000"));
        jdbc.update("insert into rooms(id, room_type_id, status) values (?,?,?)", "C9001", "CTEST", "available");
        jdbc.update("insert into reservations(id, guest_id, employee_id, status, rental_type, idempotency_key) values (?,?,?,?,?,?)",
                ID, ID, ACTOR, "CONFIRMED", "PACKAGE", "concurrency-reservation");
        jdbc.update("insert into invoices(id, reservation_id, room_total, amount_due, status) values (?,?,?,?,?)",
                ID, ID, new BigDecimal("100000"), new BigDecimal("100000"), "CHUA_THANH_TOAN");
    }

    /** Xóa theo actor/ID sau test để retry suite không bị dữ liệu cũ làm sai kết quả. */
    @AfterEach
    void cleanup() {
        jdbc.update("delete from receipts where invoice_id in (select id from invoices where reservation_id in (select id from reservations where employee_id = ?))", ACTOR);
        jdbc.update("delete from payment_transactions where invoice_id in (select id from invoices where reservation_id in (select id from reservations where employee_id = ?))", ACTOR);
        jdbc.update("delete from invoice_adjustments where invoice_id in (select id from invoices where reservation_id in (select id from reservations where employee_id = ?))", ACTOR);
        jdbc.update("delete from invoices where reservation_id in (select id from reservations where employee_id = ?)", ACTOR);
        jdbc.update("delete from reservation_rooms where reservation_id in (select id from reservations where employee_id = ?)", ACTOR);
        jdbc.update("delete from reservations where employee_id = ?", ACTOR);
        jdbc.update("delete from audit_logs where actor = ?", ACTOR);
        jdbc.update("delete from guests where id = ?", ID);
        jdbc.update("delete from rooms where id = ?", "C9001");
        jdbc.update("delete from room_types where id = ?", "CTEST");
        jdbc.update("delete from employees where id = ?", ACTOR);
    }

    /** Given hai retry cùng key, When chạy đồng thời, Then cùng trả một ledger id và amount due giảm một lần. */
    @Test
    void simultaneousRetriesCreateOnePaymentAndReturnTheSameLedgerEntry() throws Exception {
        var request = new PaymentTransactionDtos.CreateRequest(new BigDecimal("10000"), PaymentMethod.CASH,
                PaymentTransaction.TransactionType.PAYMENT, "concurrent retry");
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> recordWhenReleased(request, ready, start));
            var second = executor.submit(() -> recordWhenReleased(request, ready, start));
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            var firstResult = first.get(20, TimeUnit.SECONDS);
            var secondResult = second.get(20, TimeUnit.SECONDS);

            assertThat(firstResult.id()).isEqualTo(secondResult.id());
            assertThat(jdbc.queryForObject("select count(*) from payment_transactions where invoice_id = ?",
                    Integer.class, ID)).isEqualTo(1);
            assertThat(jdbc.queryForObject("select amount_due from invoices where id = ?",
                    BigDecimal.class, ID)).isEqualByComparingTo("90000");
        }
    }

    /** Given hai booking cùng phòng/khoảng thời gian, When chạy đồng thời, Then một thành công và một OVERBOOKING. */
    @Test
    void simultaneousReservationsCannotBookTheSameRoomTwice() throws Exception {
        LocalDateTime checkIn = LocalDateTime.of(2031, 1, 1, 12, 0);
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> reserveWhenReleased("concurrent-booking-a", checkIn, ready, start));
            var second = executor.submit(() -> reserveWhenReleased("concurrent-booking-b", checkIn, ready, start));
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            assertThat(List.of(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder("SUCCESS", "OVERBOOKING");
            assertThat(jdbc.queryForObject("select count(*) from reservation_rooms where room_id = ?",
                    Integer.class, "C9001")).isEqualTo(1);
        }
    }

    /** Đồng bộ hai worker tại barrier rồi gọi service trong security context riêng của từng thread. */
    private PaymentTransactionDtos.Response recordWhenReleased(PaymentTransactionDtos.CreateRequest request,
                                                                 CountDownLatch ready, CountDownLatch start) throws Exception {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken(ACTOR, "", "ROLE_FRONT_DESK"));
        try {
            ready.countDown();
            assertThat(start.await(10, TimeUnit.SECONDS)).isTrue();
            return payments.record(ID, request, ACTOR, "same-payment");
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    /** Đồng bộ hai booking worker; mã lỗi được trả về để assertion phân biệt người thắng lock. */
    private String reserveWhenReleased(String key, LocalDateTime checkIn,
                                       CountDownLatch ready, CountDownLatch start) throws Exception {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken(ACTOR, "", "ROLE_FRONT_DESK"));
        try {
            ready.countDown();
            assertThat(start.await(10, TimeUnit.SECONDS)).isTrue();
            var request = new ReservationDtos.CreateRequest(ID, ACTOR, new BigDecimal("50000"),
                    ReservationDtos.RentalType.PACKAGE,
                    List.of(new ReservationDtos.RoomStay("C9001", checkIn, checkIn.plusHours(24))), key);
            reservations.create(request, ACTOR, key);
            return "SUCCESS";
        } catch (DomainException exception) {
            return exception.getCode();
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}

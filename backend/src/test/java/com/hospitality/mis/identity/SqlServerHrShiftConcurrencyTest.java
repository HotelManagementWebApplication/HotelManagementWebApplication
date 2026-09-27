package com.hospitality.mis.identity;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.identity.EmployeeShiftDtos;
import com.hospitality.mis.service.identity.EmployeeShiftService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/** SQL Server proof that employee row locking serializes overlapping shift assignment. */
@SpringBootTest(properties = {
        "spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}",
        "spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
class SqlServerHrShiftConcurrencyTest {
    // NhanVien.maNhanVien is NVARCHAR(10) in the canonical SQL Server schema.
    // Keep the fixture within that contract so the proof exercises shift locking,
    // rather than failing before the service is invoked with a truncation error.
    private static final String EMPLOYEE = "SQLHR01";
    @Autowired JdbcTemplate jdbc;
    @Autowired EmployeeShiftService shifts;

    @BeforeEach
    void seed() {
        cleanup();
        jdbc.update("insert into NhanVien(maNhanVien, hoVaTen, matKhau, vaiTro, soDienThoai) values (?,?,?,?,?)",
                EMPLOYEE, "SQL Server HR", "unused", "Nhân sự", "0999900101");
    }

    @AfterEach
    void cleanup() {
        jdbc.update("delete from CaLamViecNhanVien where maNhanVien = ?", EMPLOYEE);
        jdbc.update("delete from NhatKyKiemSoat where nguoiThucHien = ?", EMPLOYEE);
        jdbc.update("delete from NhanVien where maNhanVien = ?", EMPLOYEE);
    }

    @Test
    void concurrentOverlappingAssignmentsHaveOneWinnerAndOneDomainConflict() throws Exception {
        LocalDate date = LocalDate.of(2032, 1, 4);
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> assignWhenReleased(date, "A", ready, start));
            var second = executor.submit(() -> assignWhenReleased(date, "B", ready, start));
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            assertThat(List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder("SUCCESS", "SHIFT_OVERLAP");
        assertThat(jdbc.queryForObject("select count(*) from CaLamViecNhanVien where maNhanVien = ?",
                    Integer.class, EMPLOYEE)).isEqualTo(1);
        }
    }

    private String assignWhenReleased(LocalDate date, String suffix, CountDownLatch ready,
                                      CountDownLatch start) throws Exception {
        ready.countDown();
        assertThat(start.await(10, TimeUnit.SECONDS)).isTrue();
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken(EMPLOYEE, "test", "ROLE_HR"));
        try {
            shifts.assign(new EmployeeShiftDtos.Request(EMPLOYEE, date, "AM-" + suffix,
                    date.atTime(8, 0), date.atTime(16, 0)), EMPLOYEE);
            return "SUCCESS";
        } catch (DomainException exception) {
            return exception.getCode();
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}

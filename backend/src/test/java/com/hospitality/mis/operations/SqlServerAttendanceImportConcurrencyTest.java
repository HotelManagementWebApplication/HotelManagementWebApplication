package com.hospitality.mis.operations;

import com.hospitality.mis.dto.operations.EnterpriseDtos;
import com.hospitality.mis.service.operations.EnterpriseExtensionService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/** SQL Server proof that attendance upsert serializes a missing unique key. */
@SpringBootTest(properties = {
        "spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}",
        "spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
class SqlServerAttendanceImportConcurrencyTest {
    private static final String EMPLOYEE = "SQLATT01";
    private static final LocalDate WORK_DATE = LocalDate.of(2032, 2, 3);

    @Autowired JdbcTemplate jdbc;
    @Autowired EnterpriseExtensionService enterprise;

    @BeforeEach
    void seed() {
        cleanup();
        jdbc.update("insert into NhanVien(maNhanVien, hoVaTen, matKhau, vaiTro, soDienThoai) values (?,?,?,?,?)",
                EMPLOYEE, "SQL Server Attendance", "unused", "Nhân sự", "0999900201");
    }

    @AfterEach
    void cleanup() {
        jdbc.update("delete from ChamCong where maNhanVien = ?", EMPLOYEE);
        jdbc.update("delete from NhanVien where maNhanVien = ?", EMPLOYEE);
    }

    @Test
    void concurrentImportsForSameEmployeeAndDateBothSucceedWithOneRow() throws Exception {
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> importWhenReleased("A", ready, start));
            var second = executor.submit(() -> importWhenReleased("B", ready, start));

            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            assertThat(List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS)))
                    .containsOnly("SUCCESS");
        }

        assertThat(jdbc.queryForObject(
                "select count(*) from ChamCong where maNhanVien = ? and ngayLamViec = ?",
                Integer.class, EMPLOYEE, WORK_DATE)).isEqualTo(1);
    }

    private String importWhenReleased(String suffix, CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        assertThat(start.await(10, TimeUnit.SECONDS)).isTrue();
        var row = new EnterpriseDtos.AttendanceInput(
                EMPLOYEE, WORK_DATE, WORK_DATE.atTime(8, 0), WORK_DATE.atTime(17, 0),
                "PRESENT", "MANUAL", "sql-attendance-" + suffix, "concurrent import " + suffix);
        enterprise.importAttendance(new EnterpriseDtos.AttendanceImportRequest(List.of(row)), EMPLOYEE);
        return "SUCCESS";
    }
}

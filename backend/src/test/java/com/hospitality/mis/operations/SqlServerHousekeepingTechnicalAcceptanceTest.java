package com.hospitality.mis.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.operations.HousekeepingChecklistDtos;
import com.hospitality.mis.dto.operations.HousekeepingDtos;
import com.hospitality.mis.dto.operations.HousekeepingInspectionDtos;
import com.hospitality.mis.entity.operations.HousekeepingInspection;
import com.hospitality.mis.entity.operations.HousekeepingTaskStatus;
import com.hospitality.mis.service.operations.HousekeepingChecklistService;
import com.hospitality.mis.service.operations.HousekeepingInspectionService;
import com.hospitality.mis.service.operations.HousekeepingService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** SQL Server acceptance for the production housekeeping lifecycle and readiness gates. */
@SpringBootTest(properties = {
        "spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}",
        "spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
class SqlServerHousekeepingTechnicalAcceptanceTest {
    private static final String MANAGER = "MGR1301";
    private static final String WORKER = "HK1301";
    private static final String ROOM_TYPE = "T1301";
    private static final String ROOM = "R1301";
    private static final String TECHNICAL_ROOM = "R1302";
    private static final String TEMPLATE = "P1.3 Bathroom 1301";
    private static final long GUEST = 91301L;
    private static final long RESERVATION = 91301L;

    @Autowired JdbcTemplate jdbc;
    @Autowired HousekeepingService housekeeping;
    @Autowired HousekeepingChecklistService checklists;
    @Autowired HousekeepingInspectionService inspections;

    @BeforeEach
    void seed() {
        cleanup();
        jdbc.update("insert into NhanVien(maNhanVien, hoVaTen, matKhau, vaiTro, soDienThoai) values (?,?,?,?,?)",
                MANAGER, "P1.3 Manager", "unused", "Quản lý", "0913010001");
        jdbc.update("insert into NhanVien(maNhanVien, hoVaTen, matKhau, vaiTro, soDienThoai) values (?,?,?,?,?)",
                WORKER, "P1.3 Housekeeper", "unused", "Buồng phòng", "0913010002");
        jdbc.update("insert into LoaiPhong(maLoaiPhong, ten, giaTheoNgay) values (?,?,?)",
                ROOM_TYPE, "P1.3 Housekeeping Room", 100000);
        jdbc.update("insert into Phong(maPhong, maLoaiPhong, trangThai) values (?,?,?)", ROOM, ROOM_TYPE, "Sẵn sàng");
        jdbc.update("insert into Phong(maPhong, maLoaiPhong, trangThai) values (?,?,?)", TECHNICAL_ROOM, ROOM_TYPE, "Sẵn sàng");
        jdbc.update("SET IDENTITY_INSERT KhachLuuTru ON; insert into KhachLuuTru(maKhachLuuTru, hoVaTen, soDienThoai, soGiayToTuyThan) values (?,?,?,?); SET IDENTITY_INSERT KhachLuuTru OFF",
                GUEST, "P1.3 Guest", "0913010099", "913010000001");
        jdbc.update("SET IDENTITY_INSERT PhieuDatPhong ON; insert into PhieuDatPhong(maPhieuDatPhong, maKhachLuuTru, maNhanVien, trangThai) values (?,?,?,?); SET IDENTITY_INSERT PhieuDatPhong OFF",
                RESERVATION, GUEST, MANAGER, "Đã xác nhận");
        jdbc.update("insert into MauChecklistBuongPhong(ten, dangHoatDong) values (?, 1)", TEMPLATE);
    }

    @AfterEach
    void cleanup() {
        jdbc.update("delete from SuCoThietBi where maPhieuDatPhong = ?", RESERVATION);
        jdbc.update("delete from KiemTraBuongPhong where maNhiemVuBuongPhong in (select maNhiemVuBuongPhong from NhiemVuBuongPhong where maPhong in (?,?))",
                ROOM, TECHNICAL_ROOM);
        jdbc.update("delete from KetQuaChecklistBuongPhong where maNhiemVuBuongPhong in (select maNhiemVuBuongPhong from NhiemVuBuongPhong where maPhong in (?,?))",
                ROOM, TECHNICAL_ROOM);
        jdbc.update("delete from BanGhiChongTrung where phamViLenh like 'housekeeping-%' and khoaChongTrung like 'sqlserver-housekeeping-%'");
        jdbc.update("delete from NhiemVuBuongPhong where maPhong in (?,?)", ROOM, TECHNICAL_ROOM);
        jdbc.update("delete from MauChecklistBuongPhong where ten = ?", TEMPLATE);
        jdbc.update("delete from PhieuDatPhong where maPhieuDatPhong = ?", RESERVATION);
        jdbc.update("delete from KhachLuuTru where maKhachLuuTru = ?", GUEST);
        jdbc.update("delete from Phong where maPhong in (?,?)", ROOM, TECHNICAL_ROOM);
        jdbc.update("delete from LoaiPhong where maLoaiPhong = ?", ROOM_TYPE);
        jdbc.update("delete from NhanVien where maNhanVien in (?,?)", MANAGER, WORKER);
        SecurityContextHolder.clearContext();
    }

    @Test
    void createsAssignsReadsAndPersistsTheFullLifecycle() {
        as(MANAGER, "ROLE_MANAGER");
        var created = housekeeping.create(new HousekeepingDtos.CreateRequest(ROOM, WORKER, "turnover"), MANAGER,
                "sqlserver-housekeeping-create-1301");
        assertThat(created.assignee()).isEqualTo(WORKER);
        assertThat(created.status()).isEqualTo("NEEDS_CLEANING");
        assertThat(jdbc.queryForObject("select trangThai from Phong where maPhong = ?", String.class, ROOM)).isEqualTo("Đang dọn phòng");

        as(WORKER, "ROLE_HOUSEKEEPING");
        assertThat(housekeeping.list(null, null, null, WORKER)).extracting(HousekeepingDtos.Response::id)
                .containsExactly(created.id());
        assertThatThrownBy(() -> housekeeping.list(null, MANAGER, null, WORKER))
                .isInstanceOf(DomainException.class).extracting("code").isEqualTo("HOUSEKEEPING_TASK_SCOPE_FORBIDDEN");
        housekeeping.update(created.id(), new HousekeepingDtos.UpdateRequest("IN_PROGRESS", null, null),
                WORKER, "sqlserver-housekeeping-progress-1301");
        housekeeping.update(created.id(), new HousekeepingDtos.UpdateRequest("CLEANED", null, null),
                WORKER, "sqlserver-housekeeping-cleaned-1301");

        var inspection = inspections.add(created.id(), new HousekeepingInspectionDtos.Request(
                HousekeepingInspection.InspectionType.MINIBAR, "water", 2,
                HousekeepingInspection.ItemCondition.REFILLED, "restocked"), WORKER);
        assertThat(inspections.list(created.id())).extracting(HousekeepingInspectionDtos.Response::id)
                .containsExactly(inspection.id());
        checklists.addResult(created.id(), new HousekeepingChecklistDtos.ResultRequest(TEMPLATE, true, null), WORKER);

        as(MANAGER, "ROLE_MANAGER");
        var ready = housekeeping.update(created.id(), new HousekeepingDtos.UpdateRequest("READY", null, null),
                MANAGER, "sqlserver-housekeeping-ready-1301");
        assertThat(ready.status()).isEqualTo("READY");
        assertThat(ready.checklistComplete()).isTrue();
        assertThat(jdbc.queryForObject("select trangThai from Phong where maPhong = ?", String.class, ROOM)).isEqualTo("Sẵn sàng");
        assertThat(housekeeping.list(ROOM, null, HousekeepingTaskStatus.READY, MANAGER)).extracting(HousekeepingDtos.Response::id)
                .containsExactly(created.id());
    }

    @Test
    void readyRequiresPassedChecklistAndRejectsBlockingIncident() {
        as(MANAGER, "ROLE_MANAGER");
        var task = housekeeping.create(new HousekeepingDtos.CreateRequest(ROOM, WORKER, null), MANAGER,
                "sqlserver-housekeeping-gates-create-1301");
        housekeeping.update(task.id(), new HousekeepingDtos.UpdateRequest("IN_PROGRESS", null, null), MANAGER,
                "sqlserver-housekeeping-gates-progress-1301");
        housekeeping.update(task.id(), new HousekeepingDtos.UpdateRequest("CLEANED", null, null), MANAGER,
                "sqlserver-housekeeping-gates-cleaned-1301");
        inspections.add(task.id(), new HousekeepingInspectionDtos.Request(
                HousekeepingInspection.InspectionType.ROOM_ASSET, "safe", 1,
                HousekeepingInspection.ItemCondition.OK, null), MANAGER);

        assertThatThrownBy(() -> housekeeping.update(task.id(), new HousekeepingDtos.UpdateRequest("READY", null, null),
                MANAGER, "sqlserver-housekeeping-gates-ready-1301"))
                .isInstanceOf(DomainException.class).extracting("code").isEqualTo("HOUSEKEEPING_CHECKLIST_REQUIRED");
        checklists.addResult(task.id(), new HousekeepingChecklistDtos.ResultRequest(TEMPLATE, true, null), MANAGER);
        jdbc.update("insert into SuCoThietBi(maPhieuDatPhong, maPhong, tenThietBi, giaTriBanDau, ngayMua, soLuong, tienBoiThuong, mucDoNghiemTrong, trangThaiBanGiao) values (?,?,?,?,?,?,?,?,?)",
                RESERVATION, ROOM, "safe", 1000, "2025-01-01", 1, 1000, "Cao", "Đang mở");
        assertThatThrownBy(() -> housekeeping.update(task.id(), new HousekeepingDtos.UpdateRequest("READY", null, null),
                MANAGER, "sqlserver-housekeeping-gates-ready-blocked-1301"))
                .isInstanceOf(DomainException.class).extracting("code").isEqualTo("HOUSEKEEPING_CHECKLIST_REQUIRED");
        jdbc.update("update SuCoThietBi set trangThaiBanGiao = N'Đã xử lý' where maPhieuDatPhong = ?", RESERVATION);
        assertThat(housekeeping.update(task.id(), new HousekeepingDtos.UpdateRequest("READY", null, null), MANAGER,
                "sqlserver-housekeeping-gates-ready-resolved-1301").status()).isEqualTo("READY");
    }

    @Test
    void technicalHandoffBlocksReadyWhileRoomIsInMaintenance() {
        as(MANAGER, "ROLE_MANAGER");
        var task = housekeeping.create(new HousekeepingDtos.CreateRequest(TECHNICAL_ROOM, WORKER, null), MANAGER,
                "sqlserver-housekeeping-technical-create-1301");
        housekeeping.update(task.id(), new HousekeepingDtos.UpdateRequest("IN_PROGRESS", null, null),
                MANAGER, "sqlserver-housekeeping-technical-progress-1301");
        var waiting = housekeeping.update(task.id(), new HousekeepingDtos.UpdateRequest("WAITING_TECHNICAL", null, null),
                MANAGER, "sqlserver-housekeeping-technical-waiting-1301");
        assertThat(waiting.status()).isEqualTo("WAITING_TECHNICAL");
        assertThat(jdbc.queryForObject("select trangThai from Phong where maPhong = ?", String.class, TECHNICAL_ROOM)).isEqualTo("Đang bảo trì");
        assertThatThrownBy(() -> housekeeping.update(task.id(), new HousekeepingDtos.UpdateRequest("READY", null, null),
                MANAGER, "sqlserver-housekeeping-technical-ready-1301"))
                .isInstanceOf(DomainException.class).extracting("code").isEqualTo("INVALID_HOUSEKEEPING_TRANSITION");
    }

    private void as(String actor, String role) {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(actor, "", role));
    }
}

package com.hospitality.mis.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.operations.EquipmentIncidentDtos;
import com.hospitality.mis.dto.operations.HousekeepingChecklistDtos;
import com.hospitality.mis.dto.operations.HousekeepingDtos;
import com.hospitality.mis.dto.operations.TechnicalWorkOrderDtos;
import com.hospitality.mis.entity.operations.IncidentHandoffStatus;
import com.hospitality.mis.entity.operations.IncidentSeverity;
import com.hospitality.mis.entity.operations.TechnicalWorkOrderStatus;
import com.hospitality.mis.service.operations.EquipmentIncidentService;
import com.hospitality.mis.service.operations.HousekeepingChecklistService;
import com.hospitality.mis.service.operations.HousekeepingService;
import com.hospitality.mis.service.operations.TechnicalWorkOrderService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Real SQL Server acceptance of the P1.4 technical/equipment operation boundaries. */
@SpringBootTest(properties = {
        "spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}",
        "spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
class SqlServerTechnicalEquipmentAcceptanceTest {
    private static final String MANAGER = "MGR1401";
    private static final String TECHNICAL = "TEC1401";
    private static final String OTHER_TECHNICAL = "TEC1402";
    private static final String ROOM_TYPE = "T1401";
    private static final String ROOM = "R1401";
    private static final long EQUIPMENT = 1401L;
    private static final long GUEST = 1401L;
    private static final long RESERVATION = 1401L;
    private static final String HOUSEKEEPING = "HOU1401";
    private static final String CHECKLIST = "P1.4 release checklist 1401";

    @Autowired JdbcTemplate jdbc;
    @Autowired TechnicalWorkOrderService technical;
    @Autowired EquipmentIncidentService equipmentIncidents;
    @Autowired HousekeepingService housekeeping;
    @Autowired HousekeepingChecklistService checklists;
    @Autowired com.hospitality.mis.service.operations.EnterpriseExtensionService enterprise;

    @BeforeEach
    void seed() {
        cleanup();
        jdbc.update("insert into NhanVien(maNhanVien, hoVaTen, matKhau, vaiTro, soDienThoai) values (?,?,?,?,?)",
                MANAGER, "P1.4 Manager", "unused", "Quản lý", "0914000001");
        jdbc.update("insert into NhanVien(maNhanVien, hoVaTen, matKhau, vaiTro, soDienThoai) values (?,?,?,?,?)",
                TECHNICAL, "P1.4 Technical", "unused", "Kỹ thuật", "0914000002");
        jdbc.update("insert into NhanVien(maNhanVien, hoVaTen, matKhau, vaiTro, soDienThoai) values (?,?,?,?,?)",
                OTHER_TECHNICAL, "P1.4 Other Technical", "unused", "Kỹ thuật", "0914000003");
        jdbc.update("insert into LoaiPhong(maLoaiPhong, ten, giaTheoNgay) values (?,?,?)",
                ROOM_TYPE, "P1.4 Room", 100000);
        jdbc.update("insert into Phong(maPhong, maLoaiPhong, trangThai) values (?,?,?)", ROOM, ROOM_TYPE, "Sẵn sàng");
        jdbc.update("SET IDENTITY_INSERT ThietBiPhong ON; insert into ThietBiPhong(maThietBiPhong, maPhong, ten, giaTriBanDau, ngayMua, soLuong, dangHoatDong) "
                        + "values (?,?,?,?,?,?,1); SET IDENTITY_INSERT ThietBiPhong OFF", EQUIPMENT, ROOM, "TV", "1000.00", "2020-01-01", 2);
    }

    @AfterEach
    void cleanup() {
        jdbc.update("delete from HangDoiThongBao where khoaChongLap like 'equipment-incident-%1401%'");
        jdbc.update("delete from BanGhiChongTrung where khoaChongTrung like 'p14-%'");
        jdbc.update("delete from SuCoThietBi where maPhieuDatPhong = ?", RESERVATION);
        jdbc.update("delete from ChiTietDatPhong where maPhieuDatPhong = ?", RESERVATION);
        jdbc.update("delete from PhieuDatPhong where maPhieuDatPhong = ?", RESERVATION);
        jdbc.update("delete from KetQuaChecklistBuongPhong where maNhiemVuBuongPhong in "
                + "(select maNhiemVuBuongPhong from NhiemVuBuongPhong where maPhong = ?)", ROOM);
        jdbc.update("delete from PhieuCongViecKyThuat where maPhong = ?", ROOM);
        jdbc.update("delete from NhiemVuBuongPhong where maPhong = ?", ROOM);
        jdbc.update("delete from MauChecklistBuongPhong where ten = ?", CHECKLIST);
        jdbc.update("delete from ThietBiPhong where maThietBiPhong = ?", EQUIPMENT);
        jdbc.update("delete from Phong where maPhong = ?", ROOM);
        jdbc.update("delete from LoaiPhong where maLoaiPhong = ?", ROOM_TYPE);
        jdbc.update("delete from KhachLuuTru where maKhachLuuTru = ?", GUEST);
        jdbc.update("delete from NhanVien where maNhanVien in (?,?,?)", MANAGER, TECHNICAL, OTHER_TECHNICAL);
        jdbc.update("delete from TaiSanKyThuat where maTaiSanKyThuat = 'AST-1401'");
        SecurityContextHolder.clearContext();
    }

    @Test
    void realTechnicalLifecyclePersistsResultAcceptanceIdentityAndRoomRelease() {
        establishPersistedReadiness();
        authenticate(TECHNICAL, "ROLE_TECHNICAL");
        var created = technical.create(new TechnicalWorkOrderDtos.CreateRequest(ROOM, EQUIPMENT, null, "HIGH",
                LocalDateTime.of(2031, 1, 1, 12, 0), "filter"), TECHNICAL, "p14-create-1401");
        technical.update(created.id(), new TechnicalWorkOrderDtos.UpdateRequest("ACKNOWLEDGED", null, null, null),
                TECHNICAL, "p14-ack-1401");
        technical.update(created.id(), new TechnicalWorkOrderDtos.UpdateRequest("IN_PROGRESS", null, null, null),
                TECHNICAL, "p14-progress-1401");
        var waiting = technical.update(created.id(), new TechnicalWorkOrderDtos.UpdateRequest("WAITING_ACCEPTANCE",
                "Replaced filter", null, "filter"), TECHNICAL, "p14-wait-1401");

        assertThat(waiting.status()).isEqualTo("WAITING_ACCEPTANCE");
        authenticate(MANAGER, "ROLE_MANAGER");
        var accepted = technical.accept(created.id(), new TechnicalWorkOrderDtos.AcceptanceRequest("Verified by manager"),
                MANAGER, "p14-accept-1401");
        assertThat(accepted.status()).isEqualTo("COMPLETED");
        assertThat(accepted.acceptedBy()).isEqualTo(MANAGER);
        assertThat(accepted.acceptedAt()).isNotNull();

        // Segregation of duties: Manager cannot release room
        assertThatThrownBy(() -> technical.release(created.id(), MANAGER, "p14-mgr-release-forbidden-1401"))
                .isInstanceOf(DomainException.class).extracting("code").isEqualTo("TECHNICAL_WORK_ORDER_SCOPE_FORBIDDEN");

        authenticate(TECHNICAL, "ROLE_TECHNICAL");
        var released = technical.release(created.id(), TECHNICAL, "p14-release-1401");
        assertThat(released.status()).isEqualTo("ROOM_RELEASED");
        assertThat(jdbc.queryForObject("select trangThai from Phong where maPhong = ?", String.class, ROOM))
                .isEqualTo("Sẵn sàng");
        assertThat(jdbc.queryForObject("select trangThai from PhieuCongViecKyThuat where maPhieuCongViecKyThuat = ?", String.class, created.id()))
                .isEqualTo("Đã bàn giao phòng");
    }

    @Test
    void technicalOwnershipAndResultAcceptanceGuardsAreEnforcedByRealService() {
        authenticate(TECHNICAL, "ROLE_TECHNICAL");
        var created = technical.create(new TechnicalWorkOrderDtos.CreateRequest(ROOM, null, null, "MEDIUM", null, null),
                TECHNICAL, "p14-owner-create-1401");
        authenticate(OTHER_TECHNICAL, "ROLE_TECHNICAL");
        assertThatThrownBy(() -> technical.update(created.id(),
                new TechnicalWorkOrderDtos.UpdateRequest("ACKNOWLEDGED", null, null, null),
                OTHER_TECHNICAL, "p14-other-update-1401"))
                .isInstanceOf(DomainException.class).extracting("code").isEqualTo("TECHNICAL_WORK_ORDER_SCOPE_FORBIDDEN");
        authenticate(TECHNICAL, "ROLE_TECHNICAL");
        var acknowledged = technical.update(created.id(),
                new TechnicalWorkOrderDtos.UpdateRequest("ACKNOWLEDGED", null, null, null),
                TECHNICAL, "p14-owner-ack-1401");
        assertThat(acknowledged.status()).isEqualTo("ACKNOWLEDGED");
        technical.update(created.id(), new TechnicalWorkOrderDtos.UpdateRequest("IN_PROGRESS", null, null, null),
                TECHNICAL, "p14-owner-progress-1401");
        assertThatThrownBy(() -> technical.update(created.id(),
                new TechnicalWorkOrderDtos.UpdateRequest("WAITING_ACCEPTANCE", " ", null, null),
                TECHNICAL, "p14-missing-result-1401"))
                .isInstanceOf(DomainException.class).extracting("code").isEqualTo("TECHNICAL_RESULT_REQUIRED");
        assertThatThrownBy(() -> technical.accept(created.id(), new TechnicalWorkOrderDtos.AcceptanceRequest("self"),
                TECHNICAL, "p14-self-accept-1401"))
                .isInstanceOf(DomainException.class).extracting("code").isEqualTo("TECHNICAL_ACCEPTANCE_FORBIDDEN");
    }

    @Test
    void releaseRejectsMissingReadinessChecklist() {
        long orderId = completedOrder();
        authenticate(TECHNICAL, "ROLE_TECHNICAL");
        assertThatThrownBy(() -> technical.release(orderId, TECHNICAL, "p14-no-readiness-1401"))
                .isInstanceOf(DomainException.class).extracting("code").isEqualTo("HOUSEKEEPING_NOT_READY");
    }

    @Test
    void releaseRejectsOverlapAndUnresolvedHighIncident() {
        long orderId = completedOrder();
        seedCheckedInReservation();
        authenticate(TECHNICAL, "ROLE_TECHNICAL");
        assertThatThrownBy(() -> technical.release(orderId, TECHNICAL, "p14-overlap-1401"))
                .isInstanceOf(DomainException.class).extracting("code").isEqualTo("ROOM_NOT_AVAILABLE");

        jdbc.update("update PhieuDatPhong set trangThai = N'Đã trả phòng' where maPhieuDatPhong = ?", RESERVATION);
        jdbc.update("insert into SuCoThietBi(maPhieuDatPhong, maPhong, tenThietBi, giaTriBanDau, ngayMua, soLuong, tienBoiThuong, mucDoNghiemTrong, trangThaiBanGiao) "
                        + "values (?,?,?,?,?,?,?,?,?)", RESERVATION, ROOM, "TV", "1000.00", "2020-01-01", 1, "2000.00", "Cao", "Đang mở");
        addReadyHousekeeping();
        assertThatThrownBy(() -> technical.release(orderId, TECHNICAL, "p14-incident-1401"))
                .isInstanceOf(DomainException.class).extracting("code").isEqualTo("HOUSEKEEPING_NOT_READY");
    }

    @Test
    void realEquipmentIncidentUsesRegistryValueQuantityAndHandoffState() {
        seedCheckedInReservation();
        authenticate("HOUSE1401", "ROLE_HOUSEKEEPING");
        var response = equipmentIncidents.record(RESERVATION,
                new EquipmentIncidentDtos.CreateRequest(ROOM, "TV", EQUIPMENT, 1, IncidentSeverity.HIGH),
                "HOUSE1401", "p14-incident-record-1401");
        assertThat(response.compensation()).isEqualByComparingTo(new BigDecimal("2000.00"));
        assertThat(response.handoffStatus()).isEqualTo(IncidentHandoffStatus.OPEN);
        assertThat(jdbc.queryForObject("select giaTriBanDau from SuCoThietBi where maSuCoThietBi = ?", BigDecimal.class, response.id()))
                .isEqualByComparingTo("1000.00");
        assertThat(jdbc.queryForObject("select count(*) from SuCoThietBi where maPhieuDatPhong = ?", Integer.class, RESERVATION))
                .isEqualTo(1);

        authenticate(TECHNICAL, "ROLE_TECHNICAL");
        var acknowledged = equipmentIncidents.handoff(response.id(),
                new EquipmentIncidentDtos.HandoffRequest(IncidentHandoffStatus.ACKNOWLEDGED, "Assigned"), TECHNICAL,
                "p14-incident-ack-1401");
        var resolved = equipmentIncidents.handoff(response.id(),
                new EquipmentIncidentDtos.HandoffRequest(IncidentHandoffStatus.RESOLVED, "Fixed"), TECHNICAL,
                "p14-incident-resolve-1401");
        assertThat(acknowledged.handoffStatus()).isEqualTo(IncidentHandoffStatus.ACKNOWLEDGED);
        assertThat(resolved.handoffStatus()).isEqualTo(IncidentHandoffStatus.RESOLVED);
    }

    private long completedOrder() {
        authenticate(TECHNICAL, "ROLE_TECHNICAL");
        var created = technical.create(new TechnicalWorkOrderDtos.CreateRequest(ROOM, null, null, "MEDIUM", null, null),
                TECHNICAL, "p14-complete-create-1401");
        technical.update(created.id(), new TechnicalWorkOrderDtos.UpdateRequest("ACKNOWLEDGED", null, null, null), TECHNICAL, "p14-complete-ack-1401");
        technical.update(created.id(), new TechnicalWorkOrderDtos.UpdateRequest("IN_PROGRESS", null, null, null), TECHNICAL, "p14-complete-progress-1401");
        technical.update(created.id(), new TechnicalWorkOrderDtos.UpdateRequest("WAITING_ACCEPTANCE", "done", null, null), TECHNICAL, "p14-complete-wait-1401");
        authenticate(MANAGER, "ROLE_MANAGER");
        var accepted = technical.accept(created.id(), new TechnicalWorkOrderDtos.AcceptanceRequest("OK"), MANAGER, "p14-complete-accept-1401");
        assertThat(accepted.status()).isEqualTo("COMPLETED");
        return created.id();
    }

    private void addReadyHousekeeping() {
        jdbc.update("insert into NhiemVuBuongPhong(maPhong, trangThai, daHoanThanhChecklist, coSuCoChan, thoiDiemCapNhat) values (?,?,?,?,?)",
                ROOM, "Sẵn sàng", true, false, LocalDateTime.now());
    }

    private void establishPersistedReadiness() {
        authenticate(MANAGER, "ROLE_MANAGER");
        var task = housekeeping.create(new HousekeepingDtos.CreateRequest(ROOM, HOUSEKEEPING, "Release preparation"),
                MANAGER, "p14-housekeeping-create-1401");
        authenticate(HOUSEKEEPING, "ROLE_HOUSEKEEPING");
        housekeeping.update(task.id(), new HousekeepingDtos.UpdateRequest("IN_PROGRESS", null, null),
                HOUSEKEEPING, "p14-housekeeping-progress-1401");
        authenticate(MANAGER, "ROLE_MANAGER");
        checklists.createTemplate(new HousekeepingChecklistDtos.TemplateRequest(CHECKLIST), MANAGER);
        authenticate(HOUSEKEEPING, "ROLE_HOUSEKEEPING");
        for (var template : checklists.templates()) {
            checklists.addResult(task.id(), new HousekeepingChecklistDtos.ResultRequest(template.name(), true, "Passed"),
                    HOUSEKEEPING);
        }
        var readyForTechnical = housekeeping.update(task.id(),
                new HousekeepingDtos.UpdateRequest("WAITING_TECHNICAL", null, null),
                HOUSEKEEPING, "p14-housekeeping-waiting-1401");
        assertThat(readyForTechnical.status()).isEqualTo("WAITING_TECHNICAL");
        assertThat(readyForTechnical.checklistComplete()).isTrue();
    }

    private void seedCheckedInReservation() {
        jdbc.update("SET IDENTITY_INSERT KhachLuuTru ON; insert into KhachLuuTru(maKhachLuuTru, hoVaTen, soDienThoai, soGiayToTuyThan) values (?,?,?,?); SET IDENTITY_INSERT KhachLuuTru OFF",
                GUEST, "P1.4 Guest", "0914000099", "ID1401");
        jdbc.update("SET IDENTITY_INSERT PhieuDatPhong ON; insert into PhieuDatPhong(maPhieuDatPhong, maKhachLuuTru, trangThai) values (?,?,?); SET IDENTITY_INSERT PhieuDatPhong OFF", RESERVATION, GUEST, "Đã nhận phòng");
        jdbc.update("insert into ChiTietDatPhong(maPhieuDatPhong, maPhong, thoiDiemNhanPhong, thoiDiemTraPhong, thoiDiemTraPhongBanDau, trangThai) values (?,?,?,?,?,?)",
                RESERVATION, ROOM, "2020-01-01 00:00:00", "2030-01-01 00:00:00", "2030-01-01 00:00:00", "Đang có khách");
    }

    @Test
    void technicalAssetsPersistAndReflectStatusChanges() {
        jdbc.update("delete from TaiSanKyThuat where maTaiSanKyThuat = 'AST-1401'");
        var created = enterprise.createAsset(new com.hospitality.mis.dto.operations.EnterpriseDtos.TechnicalAssetRequest(
                "AST-1401", "Chiller R1401", "HVAC", "ROOM", ROOM, 1, "R1401", "Daikin",
                java.time.LocalDate.of(2024, 1, 1), java.time.LocalDate.of(2026, 12, 31),
                "GOOD", BigDecimal.valueOf(50000000), "Asset test"
        ));
        assertThat(created.id()).isEqualTo("AST-1401");
        assertThat(created.status()).isEqualTo("GOOD");

        var updated = enterprise.updateAssetStatus("AST-1401", "MAINTENANCE_NEEDED");
        assertThat(updated.status()).isEqualTo("MAINTENANCE_NEEDED");

        var assets = enterprise.assets();
        assertThat(assets.stream().anyMatch(a -> a.id().equals("AST-1401") && a.status().equals("MAINTENANCE_NEEDED"))).isTrue();

        jdbc.update("delete from TaiSanKyThuat where maTaiSanKyThuat = 'AST-1401'");
    }

    private void authenticate(String actor, String role) {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(actor, "", role));
    }
}

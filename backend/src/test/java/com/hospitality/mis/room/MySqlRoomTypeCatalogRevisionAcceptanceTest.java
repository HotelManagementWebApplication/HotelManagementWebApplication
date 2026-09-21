package com.hospitality.mis.room;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.governance.ApprovalRepository;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.dao.room.RoomTypePriceHistoryRepository;
import com.hospitality.mis.dao.room.RoomTypeRepository;
import com.hospitality.mis.dto.room.RoomTypeAdminDtos;
import com.hospitality.mis.entity.governance.ApprovalRequest;
import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomStatus;
import com.hospitality.mis.entity.room.RoomType;
import com.hospitality.mis.entity.room.RoomTypeCatalogStatus;
import com.hospitality.mis.service.governance.ApprovalService;
import com.hospitality.mis.service.room.RoomTypeCatalogService;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** P1.1 acceptance against the real MySQL/Flyway schema and Spring/JPA services. */
@SpringBootTest(properties = {
        "spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}",
        "spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
@EnabledIfEnvironmentVariable(named = "MIGRATION_TEST_DB_URL", matches = ".+")
class MySqlRoomTypeCatalogRevisionAcceptanceTest {
    private static final String BASE = "MREVBASE";
    private static final String REVISION = "MREVNEW";
    private static final String ROOM = "MREVROOM";
    private static final String REQUESTER = "room-catalog-tech";
    private static final String APPROVER = "room-catalog-manager";

    @Autowired RoomTypeCatalogService catalog;
    @Autowired ApprovalService approvals;
    @Autowired RoomTypeRepository roomTypes;
    @Autowired RoomRepository rooms;
    @Autowired RoomTypePriceHistoryRepository priceHistory;
    @Autowired ApprovalRepository approvalRepository;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void cleanBefore() {
        cleanup();
    }

    @AfterEach
    void cleanAfter() {
        SecurityContextHolder.clearContext();
        cleanup();
    }

    @Test
    void createRequiresApprovalAndActivationBindsTheApprovedCatalogMutation() {
        authenticate(REQUESTER);
        var created = catalog.create(request(BASE, "Base Deluxe", "180000", "Original"), REQUESTER,
                "mysql-room-create");
        assertThat(created.catalogStatus()).isEqualTo(RoomTypeCatalogStatus.DRAFT);

        var approval = catalog.submit(BASE, REQUESTER, "mysql-room-submit");
        assertThat(approval.action()).isEqualTo("ROOM_TYPE_ACTIVATE");
        assertThat(approval.targetId()).isEqualTo(BASE);

        authenticate(APPROVER);
        var decided = approvals.approve(approval.id(), APPROVER, "mysql-room-approve");
        assertThat(decided.getStatus()).isEqualTo(ApprovalRequest.APPROVED);

        var activated = catalog.activate(BASE, APPROVER, "mysql-room-activate");
        assertThat(activated.catalogStatus()).isEqualTo(RoomTypeCatalogStatus.ACTIVE);
        assertThat(activated.approvedBy()).isEqualTo(APPROVER);
        RoomType persisted = roomTypes.findById(BASE).orElseThrow();
        assertThat(persisted.getCatalogStatus()).isEqualTo(RoomTypeCatalogStatus.ACTIVE);
        assertThat(persisted.getCatalogApprovedBy()).isEqualTo(APPROVER);
        assertThat(persisted.getCatalogApprovedAt()).isNotNull();
        assertThat(approvalRepository.findById(approval.id()).orElseThrow().getStatus())
                .isEqualTo(ApprovalRequest.CONSUMED);
        assertThat(priceHistory.findByRoomTypeIdOrderByEffectiveAtDescIdDesc(BASE)).hasSize(1)
                .first().extracting(history -> history.getApprovalId(), history -> history.getChangedBy())
                .containsExactly(approval.id(), APPROVER);
    }

    @Test
    void approvedRevisionRetiresPriorTypeAndRemapsRoomsAfterExactPayloadBinding() {
        RoomType active = activateInitialType();
        assertThat(active.getCatalogStatus()).isEqualTo(RoomTypeCatalogStatus.ACTIVE);

        Room room = new Room();
        room.setId(ROOM);
        room.setName("Revision room");
        room.setStatus(RoomStatus.READY);
        room.setRoomType(active);
        rooms.saveAndFlush(room);

        authenticate(REQUESTER);
        catalog.createRevision(active.getId(), request(REVISION, "Renovated Deluxe", "210000", "Renovated"), REQUESTER,
                "mysql-room-revision");
        var pending = catalog.submit(REVISION, REQUESTER, "mysql-revision-submit");
        assertThat(pending.status()).isEqualTo(ApprovalRequest.PENDING);

        catalog.update(REVISION, request(REVISION, "Renovated Deluxe", "220000", "Renovated"), REQUESTER,
                "mysql-revision-edit");
        authenticate(APPROVER);
        assertThatThrownBy(() -> catalog.activate(REVISION, APPROVER, "mysql-revision-wrong-payload"))
                .isInstanceOf(DomainException.class)
                .extracting("code").isEqualTo("APPROVAL_REQUIRED");

        authenticate(REQUESTER);
        var replacementApproval = catalog.submit(REVISION, REQUESTER, "mysql-revision-submit-updated");
        authenticate(APPROVER);
        approvals.approve(replacementApproval.id(), APPROVER, "mysql-revision-approve");
        var activated = catalog.activate(REVISION, APPROVER, "mysql-revision-activate");

        assertThat(activated.catalogStatus()).isEqualTo(RoomTypeCatalogStatus.ACTIVE);
        assertThat(activated.revisionOfId()).isEqualTo(BASE);
        assertThat(activated.approvedBy()).isEqualTo(APPROVER);
        RoomType persistedRevision = roomTypes.findById(REVISION).orElseThrow();
        assertThat(persistedRevision.getCatalogStatus()).isEqualTo(RoomTypeCatalogStatus.ACTIVE);
        assertThat(persistedRevision.getCatalogApprovedBy()).isEqualTo(APPROVER);
        assertThat(persistedRevision.getCatalogApprovedAt()).isNotNull();
        RoomType previous = roomTypes.findById(BASE).orElseThrow();
        assertThat(previous.getCatalogStatus()).isEqualTo(RoomTypeCatalogStatus.RETIRED);
        assertThat(previous.getSupersededById()).isEqualTo(REVISION);
        assertThat(rooms.findByIdWithRoomType(ROOM).orElseThrow().getRoomType().getId()).isEqualTo(REVISION);
        assertThat(approvalRepository.findById(pending.id()).orElseThrow().getStatus())
                .isEqualTo(ApprovalRequest.PENDING);
        assertThat(approvalRepository.findById(replacementApproval.id()).orElseThrow().getStatus())
                .isEqualTo(ApprovalRequest.CONSUMED);
        assertThat(priceHistory.findByRoomTypeIdOrderByEffectiveAtDescIdDesc(REVISION)).hasSize(1)
                .first().extracting(history -> history.getApprovalId(), history -> history.getChangedBy())
                .containsExactly(replacementApproval.id(), APPROVER);
    }

    private RoomType activateInitialType() {
        authenticate(REQUESTER);
        catalog.create(request(BASE, "Base Deluxe", "180000", "Original"), REQUESTER,
                "mysql-revision-setup-create");
        var approval = catalog.submit(BASE, REQUESTER, "mysql-revision-setup-submit");
        authenticate(APPROVER);
        approvals.approve(approval.id(), APPROVER, "mysql-revision-setup-approve");
        var activated = catalog.activate(BASE, APPROVER, "mysql-revision-setup-activate");
        assertThat(activated.catalogStatus()).isEqualTo(RoomTypeCatalogStatus.ACTIVE);
        return roomTypes.findById(BASE).orElseThrow();
    }

    private static RoomTypeAdminDtos.Request request(String id, String name, String price, String description) {
        return new RoomTypeAdminDtos.Request(id, name, new BigDecimal(price), description);
    }

    private static void authenticate(String actor) {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken(actor, "test", "ROLE_MANAGER"));
    }

    private void cleanup() {
        jdbc.update("update room_types set revision_of_id = null, superseded_by_id = null where id in (?, ?)", BASE,
                REVISION);
        jdbc.update("delete from room_type_price_history where room_type_id in (?, ?)", BASE, REVISION);
        jdbc.update("delete from rooms where id = ?", ROOM);
        jdbc.update("delete from room_types where id in (?, ?)", BASE, REVISION);
        jdbc.update("delete from approval_requests where target_id in (?, ?)", BASE, REVISION);
        jdbc.update("delete from audit_logs where entity_id in (?, ?)", BASE, REVISION);
        jdbc.update("delete from idempotency_records where idempotency_key like 'mysql-room-%' "
                + "or idempotency_key like 'mysql-revision-%'", new Object[]{});
    }
}

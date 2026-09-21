package com.hospitality.mis.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.operations.HousekeepingChecklistResultRepository;
import com.hospitality.mis.dao.operations.HousekeepingChecklistTemplateRepository;
import com.hospitality.mis.dao.operations.HousekeepingInspectionRepository;
import com.hospitality.mis.dao.operations.HousekeepingTaskRepository;
import com.hospitality.mis.dto.operations.HousekeepingChecklistDtos;
import com.hospitality.mis.dto.operations.HousekeepingInspectionDtos;
import com.hospitality.mis.entity.operations.HousekeepingTask;
import com.hospitality.mis.entity.operations.HousekeepingTaskStatus;
import com.hospitality.mis.entity.operations.HousekeepingInspection;
import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.service.operations.HousekeepingChecklistService;
import com.hospitality.mis.service.operations.HousekeepingInspectionService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Clock;
import java.time.ZoneId;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HousekeepingOwnershipCorrectnessTest {
    @Mock HousekeepingChecklistTemplateRepository templates;
    @Mock HousekeepingChecklistResultRepository results;
    @Mock HousekeepingInspectionRepository inspections;
    @Mock HousekeepingTaskRepository tasks;
    @Mock AuditService audit;

    private HousekeepingTask task;

    @BeforeEach
    void setUp() {
        Room room = new Room();
        room.setId("101");
        task = new HousekeepingTask();
        task.setRoom(room);
        task.setAssignee("worker");
        task.setStatus(HousekeepingTaskStatus.IN_PROGRESS);
        when(tasks.findForUpdateById(7L)).thenReturn(Optional.of(task));
        authenticate("other", "ROLE_HOUSEKEEPING");
    }

    @AfterEach
    void clearAuthentication() { SecurityContextHolder.clearContext(); }

    @Test
    void checklistWriteCannotCrossTaskOwnership() {
        var service = new HousekeepingChecklistService(templates, results, tasks, audit,
                Clock.system(ZoneId.of("Asia/Ho_Chi_Minh")));

        assertThatThrownBy(() -> service.addResult(7L,
                new HousekeepingChecklistDtos.ResultRequest("Bathroom", true, null), "other"))
                .isInstanceOf(DomainException.class)
                .extracting("code").isEqualTo("HOUSEKEEPING_TASK_SCOPE_FORBIDDEN");
        verify(results, never()).save(any());
    }

    @Test
    void inspectionWriteCannotCrossTaskOwnership() {
        var service = new HousekeepingInspectionService(inspections, tasks, audit,
                Clock.system(ZoneId.of("Asia/Ho_Chi_Minh")));

        assertThatThrownBy(() -> service.add(7L, new HousekeepingInspectionDtos.Request(
                HousekeepingInspection.InspectionType.MINIBAR, "water", 1,
                HousekeepingInspection.ItemCondition.OK, null), "other"))
                .isInstanceOf(DomainException.class)
                .extracting("code").isEqualTo("HOUSEKEEPING_TASK_SCOPE_FORBIDDEN");
        verify(inspections, never()).save(any());
    }

    private void authenticate(String actor, String role) {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken(actor, "", role));
    }
}

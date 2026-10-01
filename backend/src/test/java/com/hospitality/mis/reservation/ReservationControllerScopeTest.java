package com.hospitality.mis.reservation;
import com.hospitality.mis.entity.reservation.ReservationStatus;


import com.hospitality.mis.service.operations.EquipmentIncidentService;
import com.hospitality.mis.controller.reservation.ReservationController;
import com.hospitality.mis.dto.reservation.ReservationDtos;
import com.hospitality.mis.service.reservation.ReservationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Kiểm tra scope controller trực tiếp: owner, ca sau và manager được đọc reservation. */
class ReservationControllerScopeTest {
    /** Service mock để cô lập quyết định scope của controller. */
    private final ReservationService service = Mockito.mock(ReservationService.class);
    /** Controller thật được dựng với incident dependency tối thiểu. */
    private final ReservationController controller = new ReservationController(
            service, Mockito.mock(EquipmentIncidentService.class));

    @AfterEach
    /** Dọn actor sau mỗi test scope. */
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    /** Given owner frontdesk, When get, Then trả đúng response do service cung cấp. */
    void ownerMayReadReservation() {
        SecurityContextHolder.getContext().setAuthentication(authentication("frontdesk", "ROLE_FRONT_DESK"));
        ReservationDtos.Response response = responseOwnedBy("frontdesk");
        Mockito.when(service.get(7L)).thenReturn(response);

        assertThat(controller.get(7L)).isSameAs(response);
    }

    @Test
    /** Given actor ca sau, When get booking cũ, Then vẫn đọc được employee owner cũ. */
    void nextShiftMayReadReservation() {
        SecurityContextHolder.getContext().setAuthentication(authentication("other", "ROLE_FRONT_DESK"));
        Mockito.when(service.get(7L)).thenReturn(responseOwnedBy("frontdesk"));

        assertThat(controller.get(7L).employeeId()).isEqualTo("frontdesk");
    }

    @Test
    /** Given manager, When get booking khác owner, Then global scope cho phép đọc. */
    void managerMayReadReservationAcrossEmployeeScopes() {
        SecurityContextHolder.getContext().setAuthentication(authentication("manager", "ROLE_MANAGER"));
        ReservationDtos.Response response = responseOwnedBy("frontdesk");
        Mockito.when(service.get(7L)).thenReturn(response);

        assertThat(controller.get(7L)).isSameAs(response);
    }

    /** Tạo token tối thiểu với role canonical cho controller scope check. */
    private static TestingAuthenticationToken authentication(String actor, String role) {
        return new TestingAuthenticationToken(actor, "n/a", role);
    }

    /** Fixture response giữ id/guest cố định, chỉ thay owner employee. */
    private static ReservationDtos.Response responseOwnedBy(String employeeId) {
        return new ReservationDtos.Response(7L, 11L, employeeId,
                com.hospitality.mis.entity.reservation.ReservationStatus.CONFIRMED,
                ReservationDtos.RentalType.PACKAGE, BigDecimal.ZERO, null, null, null, List.of(),
                null, null, "DIRECT", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                "NOT_APPLICABLE", List.of(), null,
                com.hospitality.mis.entity.reservation.DepositPaymentStatus.NOT_REQUIRED);
    }
}

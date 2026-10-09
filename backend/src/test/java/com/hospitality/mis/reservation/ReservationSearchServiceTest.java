package com.hospitality.mis.reservation;

import com.hospitality.mis.dao.reservation.ReservationDatabase;
import com.hospitality.mis.service.reservation.ReservationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.assertj.core.api.Assertions.*;

/** Bảo vệ service search: scope theo role, bounds validation và fail-fast trước DB. */
class ReservationSearchServiceTest {
    /** Repository mock dùng verify query scope và không query khi input invalid. */
    private final ReservationDatabase repository = mock(ReservationDatabase.class);
    /** Service thật chỉ dùng search dependencies; các port mutation không liên quan được để null. */
    private final ReservationService service = new ReservationService(repository, null, null, null, null, java.time.Clock.systemUTC());
    /** Dọn authentication giữa các role case. */
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    /** Given frontdesk, When list toàn cục, Then query không bị giới hạn theo creator ca hiện tại. */
    @Test void frontDeskCanFindPreviousShiftBookings() {
        authenticate("clerk", "FRONT_DESK");
        when(repository.page(null, null, null, 0, 20)).thenReturn(new com.hospitality.mis.dto.reservation.ReservationDtos.PageResponse(java.util.List.of(),0,20,0,0));
        assertThat(service.list(null, null, 0, 20).totalElements()).isZero();
        verify(repository).page(null, null, null, 0, 20);
    }
    /** Given manager, When list, Then global scope truyền null filters xuống repository. */
    @Test void managerHasGlobalScope() {
        authenticate("manager", "MANAGER");
        when(repository.page(null, null, null, 0, 20)).thenReturn(new com.hospitality.mis.dto.reservation.ReservationDtos.PageResponse(java.util.List.of(),0,20,0,0));
        service.list(null, null, 0, 20);
        verify(repository).page(null, null, null, 0, 20);
    }
    /** Given anonymous/negative/oversized filters, When list, Then fail trước DB và không tương tác repository. */
    @Test void invalidBoundsAndUnauthenticatedQueriesDoNotReachDatabase() {
        assertThatThrownBy(() -> service.list(null, null, 0, 20))
                .isInstanceOf(org.springframework.security.authentication.AuthenticationCredentialsNotFoundException.class);
        authenticate("clerk", "FRONT_DESK");
        assertThatThrownBy(() -> service.list(null, null, -1, 20)).extracting("code").isEqualTo("INVALID_SEARCH");
        assertThatThrownBy(() -> service.list(null, null, 0, 101)).extracting("code").isEqualTo("INVALID_SEARCH");
        assertThatThrownBy(() -> service.list(null, 0L, 0, 20)).extracting("code").isEqualTo("INVALID_SEARCH");
        verifyNoInteractions(repository);
    }
    /** Đặt TestingAuthenticationToken role canonical cho search scope. */
    private void authenticate(String actor, String role) {
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(actor, "", "ROLE_" + role));
    }
}

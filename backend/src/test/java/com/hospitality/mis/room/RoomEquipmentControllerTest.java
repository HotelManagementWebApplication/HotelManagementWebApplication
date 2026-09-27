package com.hospitality.mis.room;

import com.hospitality.mis.common.exception.GlobalExceptionHandler;
import com.hospitality.mis.controller.room.RoomEquipmentController;
import com.hospitality.mis.dto.room.RoomEquipmentDtos;
import com.hospitality.mis.service.room.RoomEquipmentService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

/** Bảo vệ invariant path room_id phải trùng room_id trong body trước khi gọi service. */
class RoomEquipmentControllerTest {
    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    /** Given path R101 nhưng body R102, When POST, Then 422 ROOM_PATH_MISMATCH và service không bị gọi. */
    void pathRoomMustMatchBodyRoom() throws Exception {
        RoomEquipmentService service = Mockito.mock(RoomEquipmentService.class);
        MockMvc mvc = standaloneSetup(new RoomEquipmentController(service))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        mvc.perform(post("/api/rooms/R101/equipment")
                        .contentType(APPLICATION_JSON)
                        .header("Idempotency-Key", "equipment-key")
                        .content("""
                                {"room_id":"R102","name":"TV","original_value":1000000,
                                 "purchased_on":"2026-09-09","quantity":1}
                                """))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ROOM_PATH_MISMATCH"));

        Mockito.verifyNoInteractions(service);
    }

    @Test
    /** Given thiếu key, When POST equipment, Then request bị từ chối trước service bằng ApiError canonical. */
    void missingIdempotencyKeyIsRejected() throws Exception {
        RoomEquipmentService service = Mockito.mock(RoomEquipmentService.class);
        MockMvc mvc = standaloneSetup(new RoomEquipmentController(service))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        mvc.perform(post("/api/rooms/R101/equipment")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"room_id":"R101","name":"TV","original_value":1000000,
                                 "purchased_on":"2026-09-09","quantity":1}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(jsonPath("$.message").value("Dữ liệu yêu cầu không hợp lệ"))
                .andExpect(jsonPath("$.details").isArray())
                .andExpect(jsonPath("$.error").doesNotExist());

        Mockito.verifyNoInteractions(service);
    }

    @Test
    /** Given body JSON hỏng, When POST equipment, Then malformed-body cũng dùng ApiError canonical. */
    void malformedBodyUsesCanonicalApiError() throws Exception {
        RoomEquipmentService service = Mockito.mock(RoomEquipmentService.class);
        MockMvc mvc = standaloneSetup(new RoomEquipmentController(service))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        mvc.perform(post("/api/rooms/R101/equipment")
                        .contentType(APPLICATION_JSON)
                        .header("Idempotency-Key", "equipment-key")
                        .content("{malformed"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(jsonPath("$.message").value("Dữ liệu yêu cầu không hợp lệ"))
                .andExpect(jsonPath("$.details").isArray())
                .andExpect(jsonPath("$.error").doesNotExist());

        Mockito.verifyNoInteractions(service);
    }

    @Test
    /** Given key hợp lệ và actor đã xác thực, When POST equipment, Then key truyền nguyên vẹn vào service. */
    void providedIdempotencyKeyReachesService() throws Exception {
        RoomEquipmentService service = Mockito.mock(RoomEquipmentService.class);
        RoomEquipmentDtos.Response expected = new RoomEquipmentDtos.Response(
                1L, "R101", "TV", new java.math.BigDecimal("1000000"),
                java.time.LocalDate.of(2026, 9, 9), 1, true);
        Mockito.when(service.add(Mockito.any(RoomEquipmentDtos.CreateRequest.class),
                        Mockito.eq("manager"), Mockito.eq("equipment-key")))
                .thenReturn(expected);
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken("manager", "test", List.of()));
        SecurityContextHolder.setContext(context);
        MockMvc mvc = standaloneSetup(new RoomEquipmentController(service)).build();

        mvc.perform(post("/api/rooms/R101/equipment")
                        .contentType(APPLICATION_JSON)
                        .header("Idempotency-Key", "equipment-key")
                        .content("""
                                {"room_id":"R101","name":"TV","original_value":1000000,
                                 "purchased_on":"2026-09-09","quantity":1}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.room_id").value("R101"));

        Mockito.verify(service).add(Mockito.any(RoomEquipmentDtos.CreateRequest.class),
                Mockito.eq("manager"), Mockito.eq("equipment-key"));
    }
}

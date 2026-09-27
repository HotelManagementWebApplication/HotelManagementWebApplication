package com.hospitality.mis.reservation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospitality.mis.dao.auth.CustomerAccountRepository;
import com.hospitality.mis.dao.reservation.ReservationRepository;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.dao.room.RoomTypeRepository;
import com.hospitality.mis.dao.billing.PaymentTransactionRepository;
import com.hospitality.mis.dao.billing.InvoiceRepository;
import com.hospitality.mis.dao.billing.ReceiptRepository;
import com.hospitality.mis.dto.auth.CustomerAccountDtos;
import com.hospitality.mis.dto.reservation.CustomerReservationDtos;
import com.hospitality.mis.dto.reservation.ReservationDtos;
import com.hospitality.mis.dto.billing.DepositPaymentWebhookDtos;
import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:customerreservation;MODE=MSSQLServer;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "hotel.payment.webhook-secret=test-secret"
})
@AutoConfigureMockMvc
/** Contract test cho ownership boundary và mã cọc của customer booking. */
class CustomerReservationApiContractTest {
    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired ReservationRepository reservations;
    @Autowired CustomerAccountRepository accounts;
    @Autowired RoomRepository rooms;
    @Autowired RoomTypeRepository roomTypes;
    @Autowired PaymentTransactionRepository payments;
    @Autowired InvoiceRepository invoices;
    @Autowired ReceiptRepository receipts;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void seed() throws Exception {
        payments.deleteAllInBatch();
        receipts.deleteAllInBatch();
        invoices.deleteAllInBatch();
        jdbc.update("delete from ChiTietDatPhong");
        reservations.deleteAllInBatch();
        accounts.deleteAllInBatch();
        rooms.deleteAllInBatch();
        roomTypes.deleteAllInBatch();
        RoomType type = new RoomType();
        type.setId("STD");
        type.setName("Standard");
        type.setDailyPrice(new BigDecimal("2400.00"));
        roomTypes.saveAndFlush(type);
        Room room = new Room();
        room.setId("R201");
        room.setName("Room 201");
        room.setFloor(2);
        room.setRoomType(type);
        rooms.saveAndFlush(room);
    }

    @Test
    void customerBookingUsesAuthenticatedOwnerAndReturnsPendingDepositInstruction() throws Exception {
        mockMvc.perform(post("/api/auth/customers/register").contentType(APPLICATION_JSON)
                        .content(json(new CustomerAccountDtos.RegisterRequest(
                                "0900000201", "customer-password", "Online Guest", "ID0900000201"))))
                .andExpect(status().isCreated());
        JsonNode login = objectMapper.readTree(mockMvc.perform(post("/api/auth/customers/login")
                        .contentType(APPLICATION_JSON)
                        .content(json(new CustomerAccountDtos.LoginRequest("0900000201", "customer-password"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        String bearer = "Bearer " + login.get("access_token").asText();
        var request = new CustomerReservationDtos.CreateRequest(ReservationDtos.RentalType.PACKAGE,
                List.of(new CustomerReservationDtos.RoomStay("R201",
                        LocalDateTime.of(2031, 1, 10, 14, 0), LocalDateTime.of(2031, 1, 11, 12, 0))), "customer-book-1");
        JsonNode booking = objectMapper.readTree(mockMvc.perform(post("/api/customer/reservations")
                        .header(AUTHORIZATION, bearer).contentType(APPLICATION_JSON).content(json(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.deposit_amount").value(1200.00))
                .andExpect(jsonPath("$.deposit_payment.status").value("PENDING"))
                .andExpect(jsonPath("$.deposit_payment.payment_code").value(org.hamcrest.Matchers.startsWith("HOS-")))
                .andReturn().getResponse().getContentAsString());
        long id = booking.get("id").asLong();
        JsonNode replay = objectMapper.readTree(mockMvc.perform(post("/api/customer/reservations")
                        .header(AUTHORIZATION, bearer).contentType(APPLICATION_JSON).content(json(request)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());
        assertThat(replay.get("id").asLong()).isEqualTo(id);
        assertThat(replay.at("/deposit_payment/payment_code").asText())
                .isEqualTo(booking.at("/deposit_payment/payment_code").asText());

        var conflictingRequest = new CustomerReservationDtos.CreateRequest(ReservationDtos.RentalType.PACKAGE,
                List.of(new CustomerReservationDtos.RoomStay("R201",
                        LocalDateTime.of(2031, 1, 12, 14, 0), LocalDateTime.of(2031, 1, 13, 12, 0))), "customer-book-1");
        mockMvc.perform(post("/api/customer/reservations").header(AUTHORIZATION, bearer)
                        .contentType(APPLICATION_JSON).content(json(conflictingRequest)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_CONFLICT"));
        assertThat(reservations.count()).isEqualTo(1);

        mockMvc.perform(get("/api/customer/reservations/{id}", id).header(AUTHORIZATION, bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id));
        mockMvc.perform(get("/api/customer/reservations/{id}/deposit-payment", id).header(AUTHORIZATION, bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.amount").value(1200.00));
    }

    @Test
    void anonymousCannotCreateCustomerBooking() throws Exception {
        mockMvc.perform(post("/api/customer/reservations").contentType(APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void verifiedDepositCallbackConfirmsBookingAndIsIdempotent() throws Exception {
        mockMvc.perform(post("/api/auth/customers/register").contentType(APPLICATION_JSON)
                        .content(json(new CustomerAccountDtos.RegisterRequest(
                                "0900000202", "customer-password", "Callback Guest", "ID0900000202"))))
                .andExpect(status().isCreated());
        JsonNode login = objectMapper.readTree(mockMvc.perform(post("/api/auth/customers/login")
                        .contentType(APPLICATION_JSON)
                        .content(json(new CustomerAccountDtos.LoginRequest("0900000202", "customer-password"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        String bearer = "Bearer " + login.get("access_token").asText();
        var create = new CustomerReservationDtos.CreateRequest(ReservationDtos.RentalType.PACKAGE,
                List.of(new CustomerReservationDtos.RoomStay("R201",
                        LocalDateTime.of(2031, 2, 10, 14, 0), LocalDateTime.of(2031, 2, 11, 12, 0))), "callback-book-1");
        JsonNode booking = objectMapper.readTree(mockMvc.perform(post("/api/customer/reservations")
                        .header(AUTHORIZATION, bearer).contentType(APPLICATION_JSON).content(json(create)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        String code = booking.at("/deposit_payment/payment_code").asText();
        var callback = new DepositPaymentWebhookDtos.Request("provider-event-1", code,
                new BigDecimal("1200.00"), "bank-ref-1", "SUCCESS");
        String signature = sign(callback, "test-secret");

        mockMvc.perform(post("/api/public/payment-callbacks/deposit")
                        .header("X-Payment-Signature", signature).contentType(APPLICATION_JSON).content(json(callback)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reservation_status").value("DEPOSIT_PAID"))
                .andExpect(jsonPath("$.payment_status").value("COMPLETED"));
        mockMvc.perform(post("/api/public/payment-callbacks/deposit")
                        .header("X-Payment-Signature", signature).contentType(APPLICATION_JSON).content(json(callback)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.accepted").value(true));
        assertThat(payments.findByExternalEventId("provider-event-1")).isPresent();
    }

    private String sign(DepositPaymentWebhookDtos.Request request, String secret) throws Exception {
        String canonical = request.providerEventId().trim() + "|" + request.paymentCode().trim() + "|"
                + request.amount().toPlainString() + "|" + request.status().trim().toUpperCase() + "|" + request.reference().trim();
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(canonical.getBytes(StandardCharsets.UTF_8)));
    }

    private String json(Object value) throws Exception { return objectMapper.writeValueAsString(value); }
}

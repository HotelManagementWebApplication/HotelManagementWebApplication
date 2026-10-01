package com.hospitality.mis.billing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospitality.mis.dao.auth.CustomerAccountRepository;
import com.hospitality.mis.dao.billing.*;
import com.hospitality.mis.dao.finance.FinancialLedgerEntryRepository;
import com.hospitality.mis.dao.reservation.ReservationRepository;
import com.hospitality.mis.dao.room.RoomRepository;
import com.hospitality.mis.dao.room.RoomTypeRepository;
import com.hospitality.mis.dto.auth.CustomerAccountDtos;
import com.hospitality.mis.entity.billing.VnpayPaymentStatus;
import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:vnpaycontract;MODE=MSSQLServer;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "hotel.payment.vnpay.tmn-code=DEMOV210",
        "hotel.payment.vnpay.hash-secret=vnpay-test-secret",
        "hotel.payment.vnpay.return-url=https://merchant.example/api/public/payments/vnpay/return",
        "hotel.payment.vnpay.frontend-result-url=http://localhost:5173/payment/vnpay-result"
})
@AutoConfigureMockMvc
class VnpayPaymentApiContractTest {
    private static final String SECRET = "vnpay-test-secret";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired VnpayPaymentAttemptRepository attempts;
    @Autowired PaymentTransactionRepository payments;
    @Autowired ReceiptRepository receipts;
    @Autowired InvoiceRepository invoices;
    @Autowired FinancialLedgerEntryRepository ledger;
    @Autowired ReservationRepository reservations;
    @Autowired CustomerAccountRepository accounts;
    @Autowired RoomRepository rooms;
    @Autowired RoomTypeRepository roomTypes;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void seed() {
        attempts.deleteAllInBatch();
        payments.deleteAllInBatch();
        receipts.deleteAllInBatch();
        ledger.deleteAllInBatch();
        invoices.deleteAllInBatch();
        jdbc.update("delete from ChiTietDatPhong");
        reservations.deleteAllInBatch();
        accounts.deleteAllInBatch();
        rooms.deleteAllInBatch();
        roomTypes.deleteAllInBatch();

        RoomType type = new RoomType();
        type.setId("DLX");
        type.setName("Deluxe");
        type.setDailyPrice(new BigDecimal("5200000.00"));
        type.setHourlyPrice(new BigDecimal("400000.00"));
        roomTypes.saveAndFlush(type);
        Room room = new Room();
        room.setId("903");
        room.setName("Phòng 903");
        room.setFloor(9);
        room.setRoomType(type);
        rooms.saveAndFlush(room);
    }

    @Test
    void checkoutRedirectIpnAndReplayKeepBookingAndFinanceConsistent() throws Exception {
        String bearer = registerAndLogin("0900000903", "ID0000000903");
        long reservationId = createBooking(bearer, "VNPAY", "vnpay-book-1").get("id").asLong();

        JsonNode firstCheckout = checkout(bearer, reservationId);
        JsonNode secondCheckout = checkout(bearer, reservationId);
        assertThat(firstCheckout.get("transaction_reference").asText())
                .isNotEqualTo(secondCheckout.get("transaction_reference").asText());
        assertThat(attempts.findByMerchantReference(firstCheckout.get("transaction_reference").asText()))
                .get().extracting(attempt -> attempt.getStatus()).isEqualTo(VnpayPaymentStatus.CANCELLED);

        URI checkoutUri = URI.create(secondCheckout.get("payment_url").asText());
        Map<String, String> checkoutParams = decodeQuery(checkoutUri.getRawQuery());
        assertThat(checkoutUri.getScheme() + "://" + checkoutUri.getHost() + checkoutUri.getPath())
                .isEqualTo("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html");
        assertThat(checkoutParams).doesNotContainKey("vnp_BankCode");
        assertThat(checkoutParams.get("vnp_Amount")).isEqualTo("260000000");
        assertThat(checkoutParams.get("vnp_TmnCode")).isEqualTo("DEMOV210");
        assertThat(checkoutParams.get("vnp_SecureHash")).isEqualTo(sign(checkoutParams));

        Map<String, String> callback = new TreeMap<>();
        callback.put("vnp_Amount", "260000000");
        callback.put("vnp_BankCode", "NCB");
        callback.put("vnp_BankTranNo", "NCB-DEMO-903");
        callback.put("vnp_CardType", "ATM");
        callback.put("vnp_OrderInfo", "Dat coc phong BK-" + reservationId);
        callback.put("vnp_PayDate", "20310101150000");
        callback.put("vnp_ResponseCode", "00");
        callback.put("vnp_TmnCode", "DEMOV210");
        callback.put("vnp_TransactionNo", "14226112903");
        callback.put("vnp_TransactionStatus", "00");
        callback.put("vnp_TxnRef", secondCheckout.get("transaction_reference").asText());
        callback.put("vnp_SecureHash", sign(callback));

        mockMvc.perform(withParams(get("/api/public/payments/vnpay/ipn"), callback))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.RspCode").value("00"));
        mockMvc.perform(withParams(get("/api/public/payments/vnpay/ipn"), callback))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.RspCode").value("02"));
        mockMvc.perform(withParams(get("/api/public/payments/vnpay/return"), callback))
                .andExpect(status().isFound())
                .andExpect(header().string(HttpHeaders.LOCATION,
                        org.hamcrest.Matchers.containsString("result=success")));

        mockMvc.perform(get("/api/customer/reservations/{id}", reservationId).header(AUTHORIZATION, bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DEPOSIT_PAID"))
                .andExpect(jsonPath("$.deposit_payment.status").value("PAID"));
        assertThat(payments.findByExternalEventId("VNPAY:14226112903")).isPresent();
        assertThat(receipts.findByReceiptNumber("DEP-VNPAY-" + reservationId)).isPresent();
        assertThat(ledger.count()).isEqualTo(2);
    }

    @Test
    void payAtHotelWaitsForFrontDeskAndDoesNotHoldInventory() throws Exception {
        String bearer = registerAndLogin("0900000904", "ID0000000904");
        JsonNode atHotel = createBooking(bearer, "PAY_AT_HOTEL", "hotel-book-1");
        assertThat(atHotel.at("/deposit_payment/status").asText()).isEqualTo("NOT_REQUIRED");
        assertThat(atHotel.at("/deposit_payment/payment_code").isNull()).isTrue();

        JsonNode online = createBooking(bearer, "VNPAY", "vnpay-overlap-1");
        assertThat(online.get("id").asLong()).isNotEqualTo(atHotel.get("id").asLong());
        assertThat(online.at("/deposit_payment/status").asText()).isEqualTo("PENDING");
    }

    private String registerAndLogin(String phone, String identity) throws Exception {
        mockMvc.perform(post("/api/auth/customers/register").contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CustomerAccountDtos.RegisterRequest(
                                phone, "customer-password", "VNPay Guest", identity))))
                .andExpect(status().isCreated());
        JsonNode login = objectMapper.readTree(mockMvc.perform(post("/api/auth/customers/login")
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CustomerAccountDtos.LoginRequest(phone, "customer-password"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        return "Bearer " + login.get("access_token").asText();
    }

    private JsonNode createBooking(String bearer, String paymentMethod, String key) throws Exception {
        String body = """
            {"rental_type":"PACKAGE","booking_source":"DIRECT","idempotency_key":"%s",
             "payment_method":"%s","rooms":[{"room_id":"903","expected_check_in":"2031-01-10T14:00:00",
             "expected_check_out":"2031-01-11T12:00:00","guest_count":2}]}
            """.formatted(key, paymentMethod);
        return objectMapper.readTree(mockMvc.perform(post("/api/customer/reservations")
                        .header(AUTHORIZATION, bearer).contentType(APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
    }

    private JsonNode checkout(String bearer, long reservationId) throws Exception {
        return objectMapper.readTree(mockMvc.perform(post("/api/customer/reservations/{id}/vnpay-payments", reservationId)
                        .header(AUTHORIZATION, bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andReturn().getResponse().getContentAsString());
    }

    private MockHttpServletRequestBuilder withParams(MockHttpServletRequestBuilder request, Map<String, String> params) {
        params.forEach(request::param);
        return request;
    }

    private Map<String, String> decodeQuery(String rawQuery) {
        Map<String, String> values = new TreeMap<>();
        for (String pair : rawQuery.split("&")) {
            String[] parts = pair.split("=", 2);
            values.put(URLDecoder.decode(parts[0], StandardCharsets.UTF_8),
                    parts.length == 1 ? "" : URLDecoder.decode(parts[1], StandardCharsets.UTF_8));
        }
        return values;
    }

    private String sign(Map<String, String> source) throws Exception {
        String canonical = source.entrySet().stream()
                .filter(entry -> entry.getKey().startsWith("vnp_")
                        && !entry.getKey().equals("vnp_SecureHash")
                        && !entry.getKey().equals("vnp_SecureHashType")
                        && entry.getValue() != null && !entry.getValue().isEmpty())
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8)
                        + "=" + URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8))
                .reduce((left, right) -> left + "&" + right).orElse("");
        Mac mac = Mac.getInstance("HmacSHA512");
        mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
        return HexFormat.of().formatHex(mac.doFinal(canonical.getBytes(StandardCharsets.UTF_8)));
    }
}

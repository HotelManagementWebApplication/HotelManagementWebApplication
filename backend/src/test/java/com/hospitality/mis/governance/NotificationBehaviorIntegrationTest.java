package com.hospitality.mis.governance;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.governance.NotificationDtos;
import com.hospitality.mis.dto.operations.EquipmentIncidentDtos;
import com.hospitality.mis.entity.operations.IncidentSeverity;
import com.hospitality.mis.service.governance.NotificationOutboxService;
import com.hospitality.mis.service.operations.EquipmentIncidentService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.List;
import java.util.Set;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real SQL Server proof: outbox commands, JWT scope, rollback and concurrent deduplication. */
@SpringBootTest(properties = {
        "spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}",
        "spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
@AutoConfigureMockMvc
class NotificationBehaviorIntegrationTest {
    private static final String TOPIC="NOTIFICATION_CUTOVER_TEST";
    private static final String ACTOR="NO-FD1";
    @Autowired NotificationOutboxService notifications;
    @Autowired EquipmentIncidentService incidents;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mockMvc;
    @Autowired PlatformTransactionManager transactions;

    @BeforeEach void cleanBefore(){cleanup();}
    @AfterEach void cleanup(){
        SecurityContextHolder.clearContext();
        jdbc.update("DELETE HangDoiThongBao WHERE chuDe=? OR noiDung LIKE N'%\"room_id\":\"NO-R\"%'",TOPIC);
        jdbc.update("DELETE SuCoThietBi WHERE maPhong=N'NO-R'");
        jdbc.update("DELETE BanGhiChongTrung WHERE nguoiThucHien=?",ACTOR);
        jdbc.update("DELETE NhatKyKiemSoat WHERE nguoiThucHien=?",ACTOR);
        jdbc.update("DELETE ThietBiPhong WHERE maPhong=N'NO-R'");
        jdbc.update("DELETE PhieuDatPhong WHERE maNhanVien=?",ACTOR);
        jdbc.update("DELETE Phong WHERE maPhong=N'NO-R'");
        jdbc.update("DELETE LoaiPhong WHERE maLoaiPhong=N'NO-T'");
        jdbc.update("DELETE KhachLuuTru WHERE soDienThoai=N'0909090922'");
        jdbc.update("DELETE NhanVien WHERE maNhanVien=?",ACTOR);
    }
    private List<NotificationDtos.Response> events(Set<String> roles){
        return notifications.pollForRoles(roles,null).stream().filter(x->TOPIC.equals(x.topic())).toList();
    }

    @Test void outboxDeduplicatesPollsOnlyJwtAllowedRoleAndLeavesDeliveredEventsOut(){
        var first=notifications.enqueue(TOPIC,"TECHNICAL","{\"id\":1}","no-dedupe-1");
        var replay=notifications.enqueue(TOPIC,"FRONT_DESK","{\"different\":true}","no-dedupe-1");
        notifications.enqueue(TOPIC,"FRONT_DESK","{\"id\":2}","no-dedupe-2");
        assertThat(replay).isEqualTo(first);
        assertThat(events(Set.of("TECHNICAL"))).containsExactly(first);
        assertThatThrownBy(()->notifications.pollForRoles(Set.of("TECHNICAL"),"FRONT_DESK"))
                .isInstanceOf(DomainException.class).extracting("code").isEqualTo("NOTIFICATION_SCOPE_FORBIDDEN");
        assertThat(notifications.pollForRoles(Set.of("TECHNICAL")," technical ")).contains(first);
        var delivered=notifications.markDelivered(first.id());
        assertThat(delivered.status()).isEqualTo("DELIVERED");
        assertThat(delivered.deliveredAt()).isNotNull();
        assertThat(events(Set.of("TECHNICAL"))).isEmpty();
        assertThat(jdbc.queryForObject("SELECT trangThai FROM HangDoiThongBao WHERE maThongBao=?",String.class,first.id())).isEqualTo("Đã gửi");
    }

    @Test void notificationControllerUsesJwtDepartmentScopeForPolling()throws Exception{
        notifications.enqueue(TOPIC,"TECHNICAL","{}","no-http-1");
        notifications.enqueue(TOPIC,"FRONT_DESK","{}","no-http-2");
        mockMvc.perform(get("/api/governance/notifications/outbox").param("role","TECHNICAL")
                .with(jwt().jwt(token->token.subject("technical-1").claim("principal_id","technical-1").claim("principal_type","EMPLOYEE"))
                .authorities(new SimpleGrantedAuthority("ROLE_TECHNICAL"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.dedupe_key=='no-http-1')].recipient_role").value(org.hamcrest.Matchers.contains("TECHNICAL")))
                .andExpect(jsonPath("$[?(@.dedupe_key=='no-http-2')]").isEmpty());
    }

    @Test void highSeverityIncidentWritesOutboxEventsForFrontDeskTechnicalAndManager(){
        jdbc.update("INSERT NhanVien(maNhanVien,hoVaTen,matKhau,vaiTro,soDienThoai) VALUES(?,N'Notification actor',N'not-a-password',N'Lễ tân',N'0909090921')",ACTOR);
        jdbc.update("INSERT KhachLuuTru(hoVaTen,soDienThoai,soGiayToTuyThan) VALUES(N'Notification guest',N'0909090922',N'NO-ID')");
        Long guest=jdbc.queryForObject("SELECT maKhachLuuTru FROM KhachLuuTru WHERE soDienThoai=N'0909090922'",Long.class);
        jdbc.update("INSERT LoaiPhong(maLoaiPhong,ten,giaTheoNgay) VALUES(N'NO-T',N'Notification room',100000)");
        jdbc.update("INSERT Phong(maPhong,maLoaiPhong,trangThai) VALUES(N'NO-R',N'NO-T',N'Đang có khách')");
        jdbc.update("INSERT ThietBiPhong(maPhong,ten,giaTriBanDau,ngayMua,soLuong,dangHoatDong) VALUES(N'NO-R',N'Television',2000000,'2025-01-01',1,1)");
        jdbc.update("INSERT PhieuDatPhong(maKhachLuuTru,maNhanVien,trangThai) VALUES(?,?,N'Đã nhận phòng')",guest,ACTOR);
        Long reservation=jdbc.queryForObject("SELECT maPhieuDatPhong FROM PhieuDatPhong WHERE maNhanVien=?",Long.class,ACTOR);
        jdbc.update("INSERT ChiTietDatPhong(maPhieuDatPhong,maPhong,thoiDiemNhanPhong,thoiDiemTraPhong,thoiDiemTraPhongBanDau,trangThai) VALUES(?,N'NO-R','2026-09-16T08:00:00','2026-09-17T08:00:00','2026-09-17T08:00:00',N'Đang có khách')",reservation);
        Long equipment=jdbc.queryForObject("SELECT maThietBiPhong FROM ThietBiPhong WHERE maPhong=N'NO-R'",Long.class);
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(ACTOR,"test","ROLE_FRONT_DESK"));
        var incident=incidents.record(reservation,new EquipmentIncidentDtos.CreateRequest("NO-R","Television",equipment,1,IncidentSeverity.HIGH),ACTOR,"no-routing");
        for(String role:List.of("FRONT_DESK","TECHNICAL","MANAGER")){
            assertThat(notifications.pollForRoles(Set.of(role),null).stream().filter(x->x.payload().contains("\"room_id\":\"NO-R\"")).toList())
                    .singleElement().satisfies(x->assertThat(x.topic()).isEqualTo("EQUIPMENT_INCIDENT"));
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM HangDoiThongBao WHERE khoaChongLap IN(?,?,?)",Integer.class,
                "equipment-incident-"+incident.id(),"equipment-incident-tech-"+incident.id(),"equipment-incident-manager-"+incident.id())).isEqualTo(3);
    }

    @Test void surroundingRollbackDoesNotLeavePendingOrDeliveredState(){
        new TransactionTemplate(transactions).executeWithoutResult(tx->{
            notifications.enqueue(TOPIC,"TECHNICAL","{}","no-rollback");tx.setRollbackOnly();
        });
        assertThat(events(Set.of("TECHNICAL"))).isEmpty();
        var event=notifications.enqueue(TOPIC,"TECHNICAL","{}","no-deliver-rollback");
        new TransactionTemplate(transactions).executeWithoutResult(tx->{notifications.markDelivered(event.id());tx.setRollbackOnly();});
        assertThat(events(Set.of("TECHNICAL"))).containsExactly(event);
    }

    @Test void missingAndOversizedCommandsDoNotWritePartialEvents(){
        assertThatThrownBy(()->notifications.markDelivered(Long.MAX_VALUE)).isInstanceOf(java.util.NoSuchElementException.class);
        assertThatThrownBy(()->notifications.enqueue("x".repeat(2000),"TECHNICAL","{}","no-invalid"))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM HangDoiThongBao WHERE khoaChongLap=N'no-invalid'",Integer.class)).isZero();
    }

    @Test void concurrentConnectionsReturnOneDurableEvent()throws Exception{
        var ready=new CountDownLatch(2);var start=new CountDownLatch(1);
        try(var executor=Executors.newFixedThreadPool(2)){
            Callable<NotificationDtos.Response> command=()->{ready.countDown();assertThat(start.await(10,TimeUnit.SECONDS)).isTrue();return notifications.enqueue(TOPIC,"TECHNICAL","{}","no-race");};
            var a=executor.submit(command);var b=executor.submit(command);
            assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue();start.countDown();
            assertThat(a.get(20,TimeUnit.SECONDS)).isEqualTo(b.get(20,TimeUnit.SECONDS));
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM HangDoiThongBao WHERE khoaChongLap=N'no-race'",Integer.class)).isEqualTo(1);
    }
}

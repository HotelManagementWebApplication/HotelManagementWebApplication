package com.hospitality.mis.guest;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.guest.GuestDatabase;
import com.hospitality.mis.dto.guest.GuestDtos;
import com.hospitality.mis.entity.guest.MembershipTier;
import com.hospitality.mis.service.guest.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
class GuestServiceTest {
    @Autowired GuestService service;
    @Autowired GuestDatabase database;
    @Autowired MembershipHistoryService history;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager manager;
    @BeforeEach @AfterEach void cleanup(){
        jdbc.update("DELETE NhatKyKiemSoat WHERE nguoiThucHien=N'GPR-actor'");
        jdbc.update("DELETE LichSuHangThanhVien WHERE maKhachLuuTru IN(SELECT maKhachLuuTru FROM KhachLuuTru WHERE soGiayToTuyThan LIKE N'GPR-%')");
        jdbc.update("DELETE KhachLuuTru WHERE soGiayToTuyThan LIKE N'GPR-%'");
    }
    @Test void createPersistsNormalizedProfileAndAudit(){
        var created=create("GPR-01","0909090621","  GPR Nguyen  ");
        assertThat(created.fullName()).isEqualTo("GPR Nguyen");assertThat(created.email()).isEqualTo("guest@example.test");assertThat(created.address()).isEqualTo("District 1");
        assertThat(created.membershipTier()).isEqualTo(MembershipTier.STANDARD);assertThat(created.totalSpend()).isZero();assertThat(created.bookingBlocked()).isFalse();
        assertThat(service.get(created.id())).isEqualTo(created);
        assertThat(jdbc.queryForObject("SELECT duLieuSau FROM NhatKyKiemSoat WHERE nguoiThucHien=N'GPR-actor'",String.class)).isEqualTo("GPR Nguyen");
    }
    @Test void duplicatePhoneIdentityAndValidationKeepPrecedence(){
        create("GPR-01","0909090621","GPR One");
        code(()->create("GPR-02","0909090621"," "),"GUEST_PHONE_EXISTS");
        code(()->create("GPR-01","0909090622","GPR Two"),"GUEST_IDENTITY_EXISTS");
        code(()->create(" ","0909090622","GPR Two"),"IDENTITYNUMBER_REQUIRED");
        code(()->create("GPR-02","0909090622"," "),"FULLNAME_REQUIRED");
    }
    @Test void searchesKeepStableNameIdOrderingAndMissingProfileFails(){
        var z=create("GPR-01","0909090621","GPR Z");var a=create("GPR-02","0909090622","GPR A");
        assertThat(service.search("gpr")).extracting(GuestDtos.Response::id).containsExactly(a.id(),z.id());
        assertThat(service.search("0909090622")).containsExactly(a);assertThat(service.search("GPR-01")).containsExactly(z);
        assertThat(service.search(" ")).contains(a,z);code(()->service.get(-10L),"GUEST_NOT_FOUND");
    }
    @Test void storageFailureAndOuterRollbackDoNotLeaveGuestOrAudit(){
        assertThatThrownBy(()->create("GPR-01","0909090621","x".repeat(101))).isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThatThrownBy(()->new TransactionTemplate(manager).execute(status->{create("GPR-02","0909090622","GPR rollback");throw new IllegalStateException("rollback");})).isInstanceOf(IllegalStateException.class);
        assertThat(service.search("GPR-")).isEmpty();assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE nguoiThucHien=N'GPR-actor'",Integer.class)).isZero();
    }
    @Test void staleProfileVersionCannotOverwriteCounters(){
        var created=create("GPR-01","0909090621","GPR One");long version=database.find(created.id()).orElseThrow().version();
        new TransactionTemplate(manager).executeWithoutResult(status->database.profile(created.id(),"GPR Changed","GPR-01",null,"changed",1995,version));
        code(()->new TransactionTemplate(manager).executeWithoutResult(status->database.profile(created.id(),"GPR Stale","GPR-01",null,null,null,version)),"VERSION_CONFLICT");
        assertThat(service.get(created.id()).fullName()).isEqualTo("GPR Changed");
        assertThat(service.get(created.id()).totalSpend()).isZero();
    }
    @Test void membershipHistoryIsTypedScopedAndOrdered(){
        var guest=create("GPR-01","0909090621","GPR One");
        jdbc.update("INSERT LichSuHangThanhVien(maKhachLuuTru,hangCu,hangMoi,lyDo,thoiDiemThayDoi) VALUES(?,N'Tiêu chuẩn',N'Bạc',N'first','2026-10-01'),(?,N'Bạc',N'Vàng',N'second','2026-10-02')",guest.id(),guest.id());
        var events=history.list(guest.id());assertThat(events).extracting(e->e.reason()).containsExactly("second","first");
        assertThat(events.getFirst().toTier()).isEqualTo(MembershipTier.GOLD);assertThat(history.list(-1L)).isEmpty();
    }
    @Test void concurrentDuplicatePhoneCommitsOnlyOneGuest()throws Exception{
        var pool=Executors.newFixedThreadPool(2);var gate=new CountDownLatch(1);
        try{var first=pool.submit(()->attempt(gate,"GPR-01"));var second=pool.submit(()->attempt(gate,"GPR-02"));gate.countDown();assertThat(List.of(first.get(20,TimeUnit.SECONDS),second.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder("OK","GUEST_PHONE_EXISTS");}finally{pool.shutdownNow();}
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM KhachLuuTru WHERE soDienThoai=N'0909090621'",Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE nguoiThucHien=N'GPR-actor'",Integer.class)).isEqualTo(1);
    }
    private String attempt(CountDownLatch gate,String id)throws Exception{gate.await();try{create(id,"0909090621","GPR Concurrent");return "OK";}catch(DomainException error){return error.getCode();}}
    private GuestDtos.Response create(String identity,String phone,String name){String email="GPR-01".equals(identity)?" guest@example.test ":identity+"@example.test";return service.create(new GuestDtos.CreateRequest(name,1990,identity,phone,email," District 1 "),"GPR-actor");}
    private void code(Runnable operation,String code){assertThatThrownBy(operation::run).isInstanceOf(DomainException.class).extracting("code").isEqualTo(code);}
}

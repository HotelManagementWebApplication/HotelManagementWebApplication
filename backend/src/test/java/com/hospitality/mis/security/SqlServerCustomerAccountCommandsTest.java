package com.hospitality.mis.security;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.auth.CustomerAccountDatabase;
import com.hospitality.mis.dto.auth.CustomerAccountDtos;
import com.hospitality.mis.dto.guest.GuestDtos;
import com.hospitality.mis.entity.identity.EmployeeRole;
import com.hospitality.mis.service.auth.CustomerAccountService;
import com.hospitality.mis.service.guest.GuestService;
import com.hospitality.mis.service.identity.EmployeeService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
class SqlServerCustomerAccountCommandsTest {
    @Autowired CustomerAccountService service;
    @Autowired CustomerAccountDatabase accounts;
    @Autowired GuestService guests;
    @Autowired EmployeeService employees;
    @Autowired PasswordEncoder encoder;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager manager;
    @BeforeEach @AfterEach void cleanup(){
        jdbc.update("DELETE NhatKyKiemSoat WHERE nguoiThucHien=N'CST-actor' OR (loaiDoiTuong=N'CUSTOMER_ACCOUNT' AND maDoiTuong IN(SELECT CONVERT(NVARCHAR(100),maTaiKhoanKhachHang) FROM TaiKhoanKhachHang WHERE soDienThoai LIKE N'090909064%'))");
        jdbc.update("DELETE MaLamMoiDangNhap WHERE maTaiKhoanKhachHang IN(SELECT maTaiKhoanKhachHang FROM TaiKhoanKhachHang WHERE soDienThoai LIKE N'090909064%') OR maNhanVien LIKE N'CST-%'");
        jdbc.update("DELETE TaiKhoanKhachHang WHERE soDienThoai LIKE N'090909064%'");
        jdbc.update("DELETE KhachLuuTru WHERE soGiayToTuyThan LIKE N'CST-%'");
        jdbc.update("DELETE NhanVien WHERE maNhanVien LIKE N'CST-%'");SecurityContextHolder.clearContext();
    }
    @Test void registrationPersistsBcryptAndPublicProfile(){
        var result=register("0909090641","CST-01","  CST New  ","valid-password");
        var account=accounts.find(result.id()).orElseThrow();assertThat(encoder.matches("valid-password",account.password())).isTrue();
        assertThat(service.me(result.id()).guest().fullName()).isEqualTo("CST New");assertThat(result.enabled()).isTrue();assertThat(result.accountNonLocked()).isTrue();
    }
    @Test void existingGuestIsReusedWithoutOverwritingNameOrMembership(){
        var guest=guests.create(new GuestDtos.CreateRequest("CST Existing",1990,"CST-01","0909090641",null,null),"CST-actor");
        jdbc.update("UPDATE KhachLuuTru SET hangThanhVien=N'Bạc',tongChiTieu=100,soLanLuuTruHoanThanh=3 WHERE maKhachLuuTru=?",guest.id());
        var account=register("0909090641","CST-01","CST Different","valid-password");
        assertThat(account.guestId()).isEqualTo(guest.id());assertThat(service.me(account.id()).guest().fullName()).isEqualTo("CST Existing");assertThat(service.me(account.id()).guest().totalSpend()).isEqualByComparingTo("100");
    }
    @Test void collisionsAndInvalidPasswordHaveStableErrorPrecedence(){
        register("0909090641","CST-01","CST One","valid-password");
        code(()->register("0909090641","CST-02","CST Other","short"),"PHONE_ALREADY_IN_USE");
        code(()->register("0909090642","CST-01","CST Other","valid-password"),"GUEST_IDENTITY_EXISTS");
        code(()->register("0909090642","CST-02","CST Other","short"),"PASSWORD_INVALID");
        guests.create(new GuestDtos.CreateRequest("CST Guest",null,"CST-03","0909090643",null,null),"CST-actor");
        code(()->register("0909090643","CST-04","CST Other","valid-password"),"GUEST_IDENTITY_MISMATCH");
        code(()->service.me(-1L),"CUSTOMER_ACCOUNT_NOT_FOUND");
    }
    @Test void profileUpdatesOnlyOwnedFieldsAndNullVsBlankRemainDistinct(){
        var account=register("0909090641","CST-01","CST One","valid-password");
        service.updateProfile(account.id(),new CustomerAccountDtos.UpdateProfileRequest(" CST Changed "," CST-01 "," one@example.test "," District ",1995));
        jdbc.update("UPDATE KhachLuuTru SET tongChiTieu=123,soLanHuyMuon=2,phienBan=phienBan+1 WHERE maKhachLuuTru=?",account.guestId());
        var kept=service.updateProfile(account.id(),new CustomerAccountDtos.UpdateProfileRequest("CST Keep","CST-01",null,null,null)).guest();
        assertThat(kept.email()).isEqualTo("one@example.test");assertThat(kept.birthYear()).isEqualTo(1995);assertThat(kept.totalSpend()).isEqualByComparingTo("123");assertThat(kept.lateCancellationCount()).isEqualTo(2);
        var blank=service.updateProfile(account.id(),new CustomerAccountDtos.UpdateProfileRequest("CST Blank","CST-01"," "," ",null)).guest();
        assertThat(blank.email()).isEmpty();assertThat(blank.address()).isEmpty();assertThat(blank.phone()).isEqualTo("0909090641");
    }
    @Test void failedStorageOrOuterRollbackCannotLeaveOrphanGuestAccountOrAudit(){
        assertThatThrownBy(()->register("0909090641","CST-01","x".repeat(101),"valid-password")).isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThatThrownBy(()->new TransactionTemplate(manager).execute(status->{register("0909090642","CST-02","CST Rollback","valid-password");throw new IllegalStateException("rollback");})).isInstanceOf(IllegalStateException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM KhachLuuTru WHERE soGiayToTuyThan LIKE N'CST-%'",Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM TaiKhoanKhachHang WHERE soDienThoai LIKE N'090909064%'",Integer.class)).isZero();
    }
    @Test void crossPrincipalPhoneRaceCreatesExactlyOneAccount()throws Exception{
        var results=concurrent(()->{SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("CST-owner","test","ROLE_DIRECTOR"));try{employees.provision("CST-01","CST Employee","valid-password",EmployeeRole.STAFF,"0909090641",null);return "OK";}finally{SecurityContextHolder.clearContext();}},()->{register("0909090641","CST-01","CST Customer","valid-password");return "OK";});
        assertThat(results).containsExactlyInAnyOrder("OK","PHONE_ALREADY_IN_USE");
        assertThat(jdbc.queryForObject("SELECT (SELECT COUNT(*) FROM NhanVien WHERE soDienThoai=N'0909090641')+(SELECT COUNT(*) FROM TaiKhoanKhachHang WHERE soDienThoai=N'0909090641')",Integer.class)).isEqualTo(1);
    }
    @Test void duplicateCustomerPhoneRaceCommitsOnlyOneRegistration()throws Exception{
        var results=concurrent(()->{register("0909090641","CST-01","CST First","valid-password");return "OK";},()->{register("0909090641","CST-02","CST Second","valid-password");return "OK";});
        assertThat(results).containsExactlyInAnyOrder("OK","PHONE_ALREADY_IN_USE");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM KhachLuuTru WHERE soDienThoai=N'0909090641'",Integer.class)).isEqualTo(1);
    }
    private CustomerAccountDtos.Response register(String phone,String identity,String name,String password){return service.register(new CustomerAccountDtos.RegisterRequest(phone,password,name,identity));}
    private void code(Runnable operation,String code){assertThatThrownBy(operation::run).isInstanceOf(DomainException.class).extracting("code").isEqualTo(code);}
    private List<String> concurrent(Callable<String> first,Callable<String> second)throws Exception{
        var gate=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
        try{var a=pool.submit(()->{gate.await();return attempt(first);});var b=pool.submit(()->{gate.await();return attempt(second);});gate.countDown();return List.of(a.get(25,TimeUnit.SECONDS),b.get(25,TimeUnit.SECONDS));}finally{pool.shutdownNow();}
    }
    private String attempt(Callable<String> action)throws Exception{try{return action.call();}catch(DomainException error){return error.getCode();}}
}

package com.hospitality.mis.identity;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.auth.RefreshTokenDatabase;
import com.hospitality.mis.dto.auth.EmployeeAdminDtos;
import com.hospitality.mis.entity.identity.Employee;
import com.hospitality.mis.entity.identity.EmployeeRole;
import com.hospitality.mis.service.identity.EmployeeService;
import com.hospitality.mis.service.auth.JwtTokenService;
import com.hospitality.mis.service.auth.AuthFailureException;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
class EmployeeServiceTest {
    @Autowired EmployeeService service;
    @Autowired PasswordEncoder encoder;
    @Autowired JdbcTemplate jdbc;
    @Autowired RefreshTokenDatabase tokens;
    @Autowired JwtTokenService jwt;
    @Autowired PlatformTransactionManager manager;
    @BeforeEach void seed(){cleanup();actor(EmployeeRole.DIRECTOR);}
    @AfterEach void cleanup(){
        jdbc.update("DELETE MaLamMoiDangNhap WHERE maNhanVien LIKE N'EMP-%'");
        jdbc.update("DELETE SuKienDangNhapNhanVien WHERE maNhanVien LIKE N'EMP-%'");
        jdbc.update("DELETE NhatKyKiemSoat WHERE nguoiThucHien LIKE N'EMP-%' OR maDoiTuong LIKE N'EMP-%'");
        jdbc.update("DELETE NhanVien WHERE maNhanVien LIKE N'EMP-%'");
        jdbc.update("DELETE TaiKhoanKhachHang WHERE soDienThoai=N'0909090602'");
        jdbc.update("DELETE KhachLuuTru WHERE soDienThoai=N'0909090602'");
        SecurityContextHolder.clearContext();
    }
    @Test void provisionPersistsBcryptAndImmutableIdentity(){
        var result=create("EMP-01",EmployeeRole.MANAGER,"0909090601");
        assertThat(result.employeeId()).isEqualTo("EMP-01");assertThat(result.role()).isEqualTo(EmployeeRole.MANAGER);
        assertThat(encoder.matches("valid-password",result.password())).isTrue();
        assertThat(service.detail("EMP-01").enabled()).isTrue();
        assertThat(service.list(false)).anyMatch(e->e.employeeId().equals("EMP-01"));
    }
    @Test void duplicateIdAndCustomerPhoneAreRejected(){
        create("EMP-01",EmployeeRole.STAFF,"0909090601");
        code(()->service.provision("EMP-01","Duplicate","valid-password",EmployeeRole.FRONT_DESK,"invalid",null),"EMPLOYEE_EXISTS");
        Long guest=jdbc.queryForObject("INSERT KhachLuuTru(hoVaTen,soDienThoai,soGiayToTuyThan) OUTPUT INSERTED.maKhachLuuTru VALUES(N'Employee phone test',N'0909090602',N'EMP-GUEST')",Long.class);
        jdbc.update("INSERT TaiKhoanKhachHang(maKhachLuuTru,soDienThoai,matKhau) VALUES(?,?,?)",guest,"0909090602",encoder.encode("valid-password"));
        code(()->create("EMP-02",EmployeeRole.STAFF,"0909090602"),"PHONE_ALREADY_IN_USE");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM NhanVien WHERE maNhanVien=N'EMP-02'",Integer.class)).isZero();
    }
    @Test void managerialCeilingsApplyToProvisionResetAndRoleChanges(){
        create("EMP-dir",EmployeeRole.DIRECTOR,"0909090603");create("EMP-hr",EmployeeRole.HR,"0909090604");
        actor(EmployeeRole.MANAGER);
        code(()->create("EMP-admin",EmployeeRole.ADMIN,"0909090605"),"ACCESS_DENIED");
        code(()->service.resetPassword("EMP-dir","valid-password"),"ACCESS_DENIED");
        code(()->service.setRole("EMP-hr",EmployeeRole.DIRECTOR),"ACCESS_DENIED");
        assertThat(service.resetPassword("EMP-hr","new-password").role()).isEqualTo(EmployeeRole.HR);
        actor(EmployeeRole.ADMIN);code(()->service.setEnabled("EMP-dir",false),"ACCESS_DENIED");
        actor(EmployeeRole.HR);code(()->service.setRole("EMP-hr",EmployeeRole.STAFF),"ACCESS_DENIED");
    }
    @Test void actorCannotChangeOwnRoleAccountOrSessions(){
        create("EMP-owner",EmployeeRole.DIRECTOR,"0909090606");
        code(()->service.setRole("EMP-owner",EmployeeRole.MANAGER),"SELF_ROLE_CHANGE_FORBIDDEN");
        code(()->service.setEnabled("EMP-owner",false),"SELF_ACCOUNT_STATUS_CHANGE_FORBIDDEN");
        code(()->service.revokeSession("EMP-owner",1L),"SELF_SESSION_REVOKE_FORBIDDEN");
        code(()->service.setEmployment("EMP-owner",new EmployeeAdminDtos.EmploymentRequest(Employee.EmploymentStatus.TERMINATED,null,null)),"SELF_ACCOUNT_STATUS_CHANGE_FORBIDDEN");
    }
    @Test void fifthFailureLocksAndSuccessDoesNotSilentlyUnlock(){
        create("EMP-01",EmployeeRole.STAFF,"0909090601");
        for(int n=0;n<5;n++)service.recordLoginFailure("EMP-01");
        assertThat(service.findRequired("EMP-01").accountNonLocked()).isFalse();
        assertThat(service.findRequired("EMP-01").failedLoginAttempts()).isEqualTo(5);
        service.recordLoginSuccess("EMP-01");var latest=service.findRequired("EMP-01");
        assertThat(latest.failedLoginAttempts()).isZero();assertThat(latest.accountNonLocked()).isFalse();assertThat(latest.lastLoginAt()).isNotNull();
        var history=service.loginHistory("EMP-01",0,1);assertThat(history.totalElements()).isEqualTo(6);assertThat(history.totalPages()).isEqualTo(6);assertThat(history.items().getFirst().outcome()).isEqualTo("SUCCEEDED");
        assertThat(service.resetPassword("EMP-01","new-password").accountNonLocked()).isTrue();
        assertThat(service.findRequired("EMP-01").lastFailedLoginAt()).isNotNull();
    }
    @Test void loginEventsAndCounterRollBackTogether(){
        create("EMP-01",EmployeeRole.STAFF,"0909090601");
        assertThatThrownBy(()->new TransactionTemplate(manager).execute(status->{service.recordLoginFailure("EMP-01");throw new IllegalStateException("rollback");})).isInstanceOf(IllegalStateException.class);
        assertThat(service.loginHistory("EMP-01",0,100).totalElements()).isZero();assertThat(service.findRequired("EMP-01").failedLoginAttempts()).isZero();
        service.recordLoginFailure("EMP-none");assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM SuKienDangNhapNhanVien WHERE maNhanVien=N'EMP-none'",Integer.class)).isZero();
    }
    @Test void employmentValidationTerminationAndReenableAreExplicit(){
        create("EMP-01",EmployeeRole.HR,"0909090601");
        code(()->service.setEmployment("EMP-01",new EmployeeAdminDtos.EmploymentRequest(Employee.EmploymentStatus.ON_LEAVE,null,null)),"INVALID_LEAVE_PERIOD");
        var leave=service.setEmployment("EMP-01",new EmployeeAdminDtos.EmploymentRequest(Employee.EmploymentStatus.ON_LEAVE,LocalDate.now(),LocalDate.now().plusDays(1)));
        assertThat(leave.enabled()).isTrue();assertThat(leave.leaveEnd()).isAfterOrEqualTo(leave.leaveStart());
        service.setEmployment("EMP-01",new EmployeeAdminDtos.EmploymentRequest(Employee.EmploymentStatus.TERMINATED,null,null));
        var working=service.setEmployment("EMP-01",new EmployeeAdminDtos.EmploymentRequest(Employee.EmploymentStatus.WORKING,null,null));
        assertThat(working.enabled()).isFalse();assertThat(working.leaveStart()).isNull();
        assertThat(service.setEnabled("EMP-01",true).enabled()).isTrue();
    }
    @Test void sessionRevocationChecksOwnershipAndDisablePreventsNewIssuance(){
        create("EMP-01",EmployeeRole.STAFF,"0909090601");create("EMP-02",EmployeeRole.STAFF,"0909090602");
        var issued=issue("EMP-01");var session=service.sessions("EMP-01").getFirst();
        code(()->service.revokeSession("EMP-02",session.id()),"SESSION_NOT_FOUND");
        service.revokeSession("EMP-01",session.id());assertThat(service.sessions("EMP-01").getFirst().revokedAt()).isNotNull();
        issue("EMP-01");service.setEnabled("EMP-01",false);
        assertThat(service.sessions("EMP-01")).allMatch(e->e.revokedAt()!=null);
        assertThatThrownBy(()->issue("EMP-01")).isInstanceOf(AuthFailureException.class);
        String family=jdbc.queryForObject("SELECT maNhomPhien FROM MaLamMoiDangNhap WHERE maBamToken=?",String.class,issued.refreshTokenHash());
        assertThat(tokens.activeFamily(family,Instant.now())).isEmpty();
    }
    @Test void passwordBoundariesAndMissingEmployeeRetainErrorPrecedence(){
        code(()->service.provision("EMP-01","test",null,null,null,null),"POSITION_REQUIRED");
        code(()->service.provision("EMP-01","test","short",EmployeeRole.STAFF,"invalid",null),"PASSWORD_REQUIRED");
        code(()->service.resetPassword("EMP-none","short"),"EMPLOYEE_NOT_FOUND");
        code(()->service.changeOwnPassword("EMP-none","short"),"PASSWORD_REQUIRED");
        create("EMP-01",EmployeeRole.STAFF,"0909090601");
        service.changeOwnPassword("EMP-01","changed-password");assertThat(encoder.matches("changed-password",service.findRequired("EMP-01").password())).isTrue();
    }
    @Test void concurrentFailuresDoNotLoseAnIncrement()throws Exception{
        create("EMP-01",EmployeeRole.STAFF,"0909090601");
        var pool=Executors.newFixedThreadPool(2);var gate=new CountDownLatch(1);
        try{
            var first=pool.submit(()->{gate.await();service.recordLoginFailure("EMP-01");return true;});
            var second=pool.submit(()->{gate.await();service.recordLoginFailure("EMP-01");return true;});
            gate.countDown();assertThat(first.get(20,TimeUnit.SECONDS)).isTrue();assertThat(second.get(20,TimeUnit.SECONDS)).isTrue();
        }finally{pool.shutdownNow();}
        assertThat(service.findRequired("EMP-01").failedLoginAttempts()).isEqualTo(2);assertThat(service.loginHistory("EMP-01",0,100).totalElements()).isEqualTo(2);
    }
    private com.hospitality.mis.dao.identity.EmployeeDatabase.Snapshot create(String id,EmployeeRole role,String phone){return service.provision(id,id,"valid-password",role,phone,"Office");}
    private JwtTokenService.IssuedTokens issue(String id){var family=jwt.generateFamilyId();var issued=jwt.issue(JwtTokenService.PrincipalType.EMPLOYEE,id,List.of(new SimpleGrantedAuthority("ROLE_STAFF")),family);new TransactionTemplate(manager).executeWithoutResult(status->tokens.issue(JwtTokenService.PrincipalType.EMPLOYEE,id,issued,family));return issued;}
    private void actor(EmployeeRole role){SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("EMP-owner","test","ROLE_"+role.name()));}
    private void code(Runnable run,String code){assertThatThrownBy(run::run).isInstanceOf(DomainException.class).extracting("code").isEqualTo(code);}
}

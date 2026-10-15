package com.hospitality.mis.identity;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.auth.EmployeeAdminDtos;
import com.hospitality.mis.entity.identity.Employee;
import com.hospitality.mis.entity.identity.EmployeeRole;
import com.hospitality.mis.service.identity.EmployeeService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.time.LocalDate;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
class EmployeeServiceTest {
    @Autowired EmployeeService service;
    @Autowired PasswordEncoder encoder;
    @Autowired JdbcTemplate jdbc;
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
    @Test void managerialCeilingsApplyToProvisionResetAndRoleChanges(){
        create("EMP-dir",EmployeeRole.DIRECTOR,"0909090603");create("EMP-hr",EmployeeRole.HR,"0909090604");
        actor(EmployeeRole.MANAGER);
        code(()->create("EMP-admin",EmployeeRole.ADMIN,"0909090605"),"ACCESS_DENIED");
        code(()->service.resetPassword("EMP-dir","valid-password"),"ACCESS_DENIED");
        code(()->service.setRole("EMP-hr",EmployeeRole.DIRECTOR),"ACCESS_DENIED");
        assertThat(service.resetPassword("EMP-hr","new-password").role()).isEqualTo(EmployeeRole.HR);
        actor(EmployeeRole.ADMIN);code(()->service.setEnabled("EMP-dir",false),"ACCESS_DENIED");
    }
    @Test void actorCannotChangeOwnRoleAccountOrSessions(){
        create("EMP-owner",EmployeeRole.DIRECTOR,"0909090606");
        code(()->service.setRole("EMP-owner",EmployeeRole.MANAGER),"SELF_ROLE_CHANGE_FORBIDDEN");
        code(()->service.setEnabled("EMP-owner",false),"SELF_ACCOUNT_STATUS_CHANGE_FORBIDDEN");
        code(()->service.revokeSession("EMP-owner",1L),"SELF_SESSION_REVOKE_FORBIDDEN");
        code(()->service.setEmployment("EMP-owner",new EmployeeAdminDtos.EmploymentRequest(Employee.EmploymentStatus.TERMINATED,null,null)),"SELF_ACCOUNT_STATUS_CHANGE_FORBIDDEN");
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
    private com.hospitality.mis.dao.identity.EmployeeDatabase.Snapshot create(String id,EmployeeRole role,String phone){return service.provision(id,id,"valid-password",role,phone,"Office");}
    private void actor(EmployeeRole role){SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("EMP-owner","test","ROLE_"+role.name()));}
    private void code(Runnable run,String code){assertThatThrownBy(run::run).isInstanceOf(DomainException.class).extracting("code").isEqualTo(code);}
}

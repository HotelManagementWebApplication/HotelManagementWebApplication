package com.hospitality.mis.security;

import com.hospitality.mis.dao.auth.RefreshTokenDatabase;
import com.hospitality.mis.dto.auth.AuthDtos;
import com.hospitality.mis.entity.identity.EmployeeRole;
import com.hospitality.mis.service.identity.EmployeeService;
import com.hospitality.mis.service.auth.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
class SqlServerRefreshConcurrencyTest {
    @Autowired AuthService auth;
    @Autowired EmployeeService employees;
    @Autowired RefreshTokenDatabase tokens;
    @Autowired PasswordEncoder encoder;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager manager;
    @BeforeEach void seed(){cleanup();jdbc.update("INSERT NhanVien(maNhanVien,hoVaTen,matKhau,vaiTro,soDienThoai) VALUES(N'RFR-01',N'Refresh test',?,N'Nhân viên',N'0909090631')",encoder.encode("refresh-password"));}
    @AfterEach void cleanup(){
        jdbc.update("DELETE MaLamMoiDangNhap WHERE maNhanVien LIKE N'RFR-%'");jdbc.update("DELETE SuKienDangNhapNhanVien WHERE maNhanVien LIKE N'RFR-%'");
        jdbc.update("DELETE NhatKyKiemSoat WHERE nguoiThucHien LIKE N'RFR-%' OR (loaiDoiTuong=N'REFRESH_TOKEN' AND maDoiTuong IN(SELECT maNhomPhien FROM MaLamMoiDangNhap WHERE maNhanVien LIKE N'RFR-%'))");
        jdbc.update("DELETE NhanVien WHERE maNhanVien LIKE N'RFR-%'");SecurityContextHolder.clearContext();
    }
    @Test void twoConnectionsRotatingSameTokenHaveOneWinnerAndReplayRevokesSuccessor()throws Exception{
        var original=login();var results=concurrent(()->rotate(original.refreshToken()),()->rotate(original.refreshToken()));
        assertThat(results).containsExactlyInAnyOrder("OK","REJECTED");assertThat(tokens.sessions("RFR-01")).hasSize(2).allMatch(t->t.revokedAt()!=null);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE nguoiThucHien=N'RFR-01' AND hanhDong=N'REFRESH_REPLAY_DETECTED'",Integer.class)).isEqualTo(1);
    }
    @Test void disableRacingRotationCannotLeaveLiveSuccessor()throws Exception{
        var original=login();concurrent(()->rotate(original.refreshToken()),()->{actor();employees.setEnabled("RFR-01",false);SecurityContextHolder.clearContext();return "DISABLED";});
        assertThat(employees.findRequired("RFR-01").enabled()).isFalse();assertThat(tokens.sessions("RFR-01")).allMatch(t->t.revokedAt()!=null);
    }
    @Test void rotationAndAuditRollbackRestoreOriginalToken(){
        var original=login();
        assertThatThrownBy(()->new TransactionTemplate(manager).execute(status->{auth.refresh(original.refreshToken());throw new IllegalStateException("rollback");})).isInstanceOf(IllegalStateException.class);
        assertThat(tokens.sessions("RFR-01")).singleElement().satisfies(t->assertThat(t.revokedAt()).isNull());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE nguoiThucHien=N'RFR-01' AND hanhDong=N'REFRESH_ROTATED'",Integer.class)).isZero();
        assertThat(auth.refresh(original.refreshToken()).refreshToken()).isNotEqualTo(original.refreshToken());
    }
    @Test void expiredTokenIsRevokedWithoutIssuingSuccessor(){
        var original=login();jdbc.update("UPDATE MaLamMoiDangNhap SET thoiDiemPhatHanh=DATEADD(DAY,-10,SYSDATETIMEOFFSET()),thoiDiemHetHan=DATEADD(DAY,-1,SYSDATETIMEOFFSET()) WHERE maNhanVien=N'RFR-01'");
        assertThatThrownBy(()->auth.refresh(original.refreshToken())).isInstanceOf(AuthFailureException.class);assertThat(tokens.sessions("RFR-01")).singleElement().satisfies(t->assertThat(t.revokedAt()).isNotNull());
    }
    @Test void principalTokenLockRequiresCallerTransaction(){
        var original=login();assertThatThrownBy(()->tokens.lock(JwtTokenService.hash(original.refreshToken()))).isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThat(auth.refresh(original.refreshToken()).refreshToken()).isNotBlank();
    }
    private AuthDtos.TokenResponse login(){return auth.login(new AuthDtos.LoginRequest("RFR-01","refresh-password"));}
    private String rotate(String raw){try{auth.refresh(raw);return "OK";}catch(AuthFailureException error){return "REJECTED";}}
    private void actor(){SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("RFR-owner","test","ROLE_DIRECTOR"));}
    private List<String> concurrent(Callable<String> first,Callable<String> second)throws Exception{
        var gate=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
        try{var a=pool.submit(()->{gate.await();return first.call();});var b=pool.submit(()->{gate.await();return second.call();});gate.countDown();return List.of(a.get(25,TimeUnit.SECONDS),b.get(25,TimeUnit.SECONDS));}finally{pool.shutdownNow();}
    }
}

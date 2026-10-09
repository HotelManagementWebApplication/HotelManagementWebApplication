package com.hospitality.mis.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.operations.MaintenanceDtos;
import com.hospitality.mis.service.operations.MaintenanceService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
class SqlServerMaintenanceTest {
    private static final String ACTOR="MAINT-CUTOVER";
    @Autowired JdbcTemplate jdbc;
    @Autowired MaintenanceService maintenance;
    @Autowired PlatformTransactionManager transactions;
    @BeforeEach void seed(){
        cleanup();
        jdbc.update("INSERT LoaiPhong(maLoaiPhong,ten,giaTheoNgay) VALUES(N'MNT-T',N'Maintenance test',100000)");
        jdbc.update("INSERT Phong(maPhong,maLoaiPhong) VALUES(N'MNT-R',N'MNT-T')");actor();
    }
    @AfterEach void cleanup(){
        jdbc.update("DELETE PhieuBaoTri WHERE maPhong=N'MNT-R'");
        jdbc.update("DELETE Phong WHERE maPhong=N'MNT-R'");jdbc.update("DELETE LoaiPhong WHERE maLoaiPhong=N'MNT-T'");
        jdbc.update("DELETE NhatKyKiemSoat WHERE nguoiThucHien=?",ACTOR);SecurityContextHolder.clearContext();
    }
    @Test void lifecycleAndRetriesKeepRoomVersionAndAuditConsistent(){
        var created=maintenance.create(request("MNT-1"),ACTOR);
        assertThat(created.status()).isEqualTo("CHUA_XU_LY");assertThat(created.type()).isEqualTo("repair");
        assertThat(roomStatus()).isEqualTo("Đang bảo trì");assertThat(version()).isEqualTo(1);
        code(()->update("MNT-1","DA_HOAN_THANH"),"INVALID_MAINTENANCE_TRANSITION");
        assertThat(update("MNT-1"," dang_bao_tri ").status()).isEqualTo("DANG_BAO_TRI");
        code(()->update("MNT-1","CHUA_XU_LY"),"INVALID_MAINTENANCE_TRANSITION");
        assertThat(update("MNT-1","DA_HOAN_THANH").status()).isEqualTo("DA_HOAN_THANH");
        assertThat(roomStatus()).isEqualTo("Sẵn sàng");assertThat(version()).isEqualTo(2);
        update("MNT-1","DA_HOAN_THANH");assertThat(version()).isEqualTo(2);assertThat(audits()).isEqualTo(3);
        assertThat(jdbc.queryForObject("SELECT duLieuTruoc FROM NhatKyKiemSoat WHERE nguoiThucHien=? AND duLieuSau='DA_HOAN_THANH'",String.class,ACTOR)).isEqualTo("DANG_BAO_TRI");
        code(()->update("MNT-1","DANG_BAO_TRI"),"INVALID_MAINTENANCE_TRANSITION");
    }
    @Test void occupiedMissingDuplicateAndInvalidInputDoNotPartiallyWrite(){
        jdbc.update("UPDATE Phong SET trangThai=N'Đang có khách' WHERE maPhong=N'MNT-R'");
        code(()->maintenance.create(request("MNT-1"),ACTOR),"ROOM_OCCUPIED");
        assertThat(maintenance.byRoom("MNT-R")).isEmpty();assertThat(audits()).isZero();
        jdbc.update("UPDATE Phong SET trangThai=N'Sẵn sàng' WHERE maPhong=N'MNT-R'");
        code(()->maintenance.create(new MaintenanceDtos.CreateRequest("MNT-1","missing","repair",LocalDate.now(),null),ACTOR),"ROOM_NOT_FOUND");
        assertThatThrownBy(()->maintenance.create(new MaintenanceDtos.CreateRequest("MNT-1","MNT-R","repair",null,null),ACTOR)).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThat(roomStatus()).isEqualTo("Sẵn sàng");assertThat(version()).isZero();assertThat(audits()).isZero();
        maintenance.create(request("MNT-1"),ACTOR);code(()->maintenance.create(request("MNT-1"),ACTOR),"MAINTENANCE_EXISTS");
        code(()->update("missing","DANG_BAO_TRI"),"MAINTENANCE_NOT_FOUND");
        code(()->update("MNT-1","wrong"),"INVALID_MAINTENANCE_STATUS");assertThat(audits()).isEqualTo(1);
    }
    @Test void outerRollbackUndoesRoomVersionOrderAndAudit(){
        new TransactionTemplate(transactions).executeWithoutResult(tx->{maintenance.create(request("MNT-1"),ACTOR);tx.setRollbackOnly();});
        assertThat(maintenance.byRoom("MNT-R")).isEmpty();assertThat(roomStatus()).isEqualTo("Sẵn sàng");assertThat(version()).isZero();assertThat(audits()).isZero();
    }
    @Test void readModelSortsScheduledDateAndKeepsNullDescription(){
        maintenance.create(request("MNT-1"),ACTOR);
        maintenance.create(new MaintenanceDtos.CreateRequest("MNT-2","MNT-R","inspect",LocalDate.of(2031,1,3),null),ACTOR);
        assertThat(maintenance.byRoom("MNT-R")).extracting(MaintenanceDtos.Response::id).containsExactly("MNT-2","MNT-1");
        assertThat(maintenance.byRoom("MNT-R").get(0).description()).isNull();assertThat(maintenance.byRoom("missing")).isEmpty();
    }
    @Test void twoConnectionsCannotCreateSameIdTwice()throws Exception{
        assertThat(race(()->maintenance.create(request("MNT-1"),ACTOR))).containsExactlyInAnyOrder("SUCCESS","MAINTENANCE_EXISTS");
        assertThat(maintenance.byRoom("MNT-R")).hasSize(1);assertThat(audits()).isEqualTo(1);assertThat(version()).isEqualTo(1);
    }
    @Test void twoConnectionsApplyingSameTransitionWriteOneAudit()throws Exception{
        maintenance.create(request("MNT-1"),ACTOR);
        assertThat(race(()->update("MNT-1","DANG_BAO_TRI"))).containsOnly("SUCCESS");
        assertThat(audits()).isEqualTo(2);assertThat(version()).isEqualTo(1);
    }
    private List<String> race(Runnable action)throws Exception{
        var ready=new CountDownLatch(2);var start=new CountDownLatch(1);
        try(var executor=Executors.newFixedThreadPool(2)){
            Callable<String> worker=()->{actor();try{ready.countDown();assertThat(start.await(10,TimeUnit.SECONDS)).isTrue();action.run();return "SUCCESS";}catch(DomainException e){return e.getCode();}finally{SecurityContextHolder.clearContext();}};
            var a=executor.submit(worker);var b=executor.submit(worker);assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue();start.countDown();return List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS));
        }
    }
    private static void actor(){SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(ACTOR,"","ROLE_TECHNICAL"));}
    private MaintenanceDtos.CreateRequest request(String id){return new MaintenanceDtos.CreateRequest(id,"MNT-R","repair",LocalDate.of(2031,1,2),"description");}
    private MaintenanceDtos.Response update(String id,String status){return maintenance.updateStatus(id,new MaintenanceDtos.StatusRequest(status),ACTOR);}
    private String roomStatus(){return jdbc.queryForObject("SELECT trangThai FROM Phong WHERE maPhong=N'MNT-R'",String.class);}
    private long version(){return jdbc.queryForObject("SELECT phienBan FROM Phong WHERE maPhong=N'MNT-R'",Long.class);}
    private int audits(){return jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE nguoiThucHien=?",Integer.class,ACTOR);}
    private void code(Runnable action,String code){assertThatThrownBy(action::run).isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(code));}
}

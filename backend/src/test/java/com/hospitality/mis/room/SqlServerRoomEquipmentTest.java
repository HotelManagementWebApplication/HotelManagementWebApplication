package com.hospitality.mis.room;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.room.RoomEquipmentDatabase;
import com.hospitality.mis.dto.room.RoomEquipmentDtos;
import com.hospitality.mis.service.room.RoomEquipmentService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.time.*;
import java.util.List;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
class SqlServerRoomEquipmentTest {
    private static final String ACTOR="EQ-CUTOVER";
    @Autowired JdbcTemplate jdbc;
    @Autowired RoomEquipmentDatabase database;
    @Autowired RoomEquipmentService equipment;
    @Autowired PlatformTransactionManager transactions;
    @BeforeEach void seed(){
        cleanup();
        jdbc.update("INSERT LoaiPhong(maLoaiPhong,ten,giaTheoNgay) VALUES(N'EQ-T',N'Equipment test',100000)");
        jdbc.update("INSERT Phong(maPhong,maLoaiPhong) VALUES(N'EQ-R',N'EQ-T'),(N'EQ-OTHER',N'EQ-T')");
        actor(ACTOR);
    }
    @AfterEach void cleanup(){
        jdbc.update("DELETE BanGhiChongTrung WHERE phamViLenh=N'room-equipment' AND nguoiThucHien=?",ACTOR);
        jdbc.update("DELETE ThietBiPhong WHERE maPhong IN(N'EQ-R',N'EQ-OTHER')");
        jdbc.update("DELETE Phong WHERE maPhong IN(N'EQ-R',N'EQ-OTHER')");
        jdbc.update("DELETE LoaiPhong WHERE maLoaiPhong=N'EQ-T'");
        jdbc.update("DELETE NhatKyKiemSoat WHERE nguoiThucHien=?",ACTOR);
        SecurityContextHolder.clearContext();
    }
    @Test void addUpdateActiveFilterAndRoomOwnershipPreserveApi(){
        var saved=equipment.add(request("TV"),ACTOR,"eq-add");
        assertThat(saved.id()).isPositive();assertThat(saved.quantity()).isEqualTo(2);
        assertThat(saved.originalValue()).isEqualByComparingTo("1000.00");
        assertThat(saved.purchasedOn()).isEqualTo(LocalDate.of(2020,1,2));
        code(()->equipment.update("EQ-OTHER",saved.id(),update("TV",true),ACTOR),"EQUIPMENT_NOT_FOUND");
        assertThat(equipment.list("EQ-R")).containsExactly(saved);
        var changed=equipment.update("EQ-R",saved.id(),update(" TV revised ",false),ACTOR);
        assertThat(changed.name()).isEqualTo("TV revised");assertThat(changed.active()).isFalse();
        assertThat(equipment.list("EQ-R")).isEmpty();assertThat(equipment.list("missing")).isEmpty();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE nguoiThucHien=?",Integer.class,ACTOR)).isEqualTo(2);
    }
    @Test void replayIsAnImmutableDurableSnapshotAndRejectsActorAndPayloadMismatch(){
        var request=request("TV");var first=equipment.add(request,ACTOR,"eq-replay");
        equipment.update("EQ-R",first.id(),update("changed",false),ACTOR);
        var restarted=new RoomEquipmentService(database,Clock.system(ZoneId.of("Asia/Ho_Chi_Minh")));
        assertThat(restarted.add(request,ACTOR,"eq-replay")).isEqualTo(first);
        code(()->equipment.add(request("other"),ACTOR,"eq-replay"),"IDEMPOTENCY_KEY_CONFLICT");
        actor("OTHER");code(()->equipment.add(request,"OTHER","eq-replay"),"IDEMPOTENCY_KEY_CONFLICT");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM ThietBiPhong WHERE maPhong=N'EQ-R'",Integer.class)).isEqualTo(1);
    }
    @Test void failedWritesRollBackMetadataAuditAndClaim(){
        code(()->equipment.add(new RoomEquipmentDtos.CreateRequest("missing","TV",BigDecimal.ONE,LocalDate.now(),1),ACTOR,"eq-missing"),"ROOM_NOT_FOUND");
        var invalid=new RoomEquipmentDtos.CreateRequest("EQ-R","TV",BigDecimal.ONE,LocalDate.now(),0);
        assertThatThrownBy(()->equipment.add(invalid,ACTOR,"eq-invalid")).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThat(equipment.list("EQ-R")).isEmpty();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM BanGhiChongTrung WHERE nguoiThucHien=?",Integer.class,ACTOR)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE nguoiThucHien=?",Integer.class,ACTOR)).isZero();
        var saved=equipment.add(request("TV"),ACTOR,"eq-valid");
        assertThatThrownBy(()->equipment.update("EQ-R",saved.id(),new RoomEquipmentDtos.UpdateRequest("bad",BigDecimal.ONE,LocalDate.now(),0,false),ACTOR)).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThat(equipment.list("EQ-R")).containsExactly(saved);
    }
    @Test void surroundingRollbackDoesNotLeaveEquipmentAuditOrReplay(){
        new TransactionTemplate(transactions).executeWithoutResult(tx->{equipment.add(request("TV"),ACTOR,"eq-outer");tx.setRollbackOnly();});
        assertThat(equipment.list("EQ-R")).isEmpty();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM BanGhiChongTrung WHERE nguoiThucHien=?",Integer.class,ACTOR)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE nguoiThucHien=?",Integer.class,ACTOR)).isZero();
    }
    @Test void twoConnectionsReplayOneInsertAndOneAudit()throws Exception{
        var results=race(false);assertThat(results.get(0)).isEqualTo(results.get(1));
        assertThat(equipment.list("EQ-R")).hasSize(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE nguoiThucHien=?",Integer.class,ACTOR)).isEqualTo(1);
    }
    @Test void twoConnectionsWithConflictingPayloadHaveExactlyOneWinner()throws Exception{
        assertThat(race(true)).contains("IDEMPOTENCY_KEY_CONFLICT");
        assertThat(equipment.list("EQ-R")).hasSize(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE nguoiThucHien=?",Integer.class,ACTOR)).isEqualTo(1);
    }
    private List<Object> race(boolean conflicting)throws Exception{
        var ready=new CountDownLatch(2);var start=new CountDownLatch(1);
        try(var executor=Executors.newFixedThreadPool(2)){
            var a=executor.submit(()->compete("TV",ready,start));var b=executor.submit(()->compete(conflicting?"other":"TV",ready,start));
            assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue();start.countDown();return List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS));
        }
    }
    private Object compete(String name,CountDownLatch ready,CountDownLatch start)throws Exception{
        actor(ACTOR);try{ready.countDown();assertThat(start.await(10,TimeUnit.SECONDS)).isTrue();return equipment.add(request(name),ACTOR,"eq-race");}
        catch(DomainException error){return error.getCode();}finally{SecurityContextHolder.clearContext();}
    }
    private static void actor(String actor){SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(actor,"","ROLE_TECHNICAL"));}
    private RoomEquipmentDtos.CreateRequest request(String name){return new RoomEquipmentDtos.CreateRequest("EQ-R",name,new BigDecimal("1000"),LocalDate.of(2020,1,2),2);}
    private RoomEquipmentDtos.UpdateRequest update(String name,boolean active){return new RoomEquipmentDtos.UpdateRequest(name,new BigDecimal("2000"),LocalDate.of(2021,1,2),1,active);}
    private void code(Runnable action,String code){assertThatThrownBy(action::run).isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo(code));}
}

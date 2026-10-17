package com.hospitality.mis.room;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.room.RoomAdminDtos;
import com.hospitality.mis.entity.room.RoomStatus;
import com.hospitality.mis.service.room.RoomAdminService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
class RoomAdminStateGuardTest {
    @Autowired RoomAdminService service;
    @Autowired JdbcTemplate jdbc;
    @BeforeEach void seed(){cleanup();jdbc.update("INSERT LoaiPhong(maLoaiPhong,ten,giaTheoNgay,trangThaiDanhMuc) VALUES(N'RAD-A',N'Active admin type',100,N'Đang hoạt động'),(N'RAD-D',N'Draft admin type',200,N'Bản nháp')");SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("RAD-tech","test","ROLE_TECHNICAL"));}
    @AfterEach void cleanup(){jdbc.update("DELETE NhatKyKiemSoat WHERE loaiDoiTuong=N'ROOM' AND maDoiTuong LIKE N'RAD-%'");jdbc.update("DELETE Phong WHERE maPhong LIKE N'RAD-%'");jdbc.update("DELETE LoaiPhong WHERE maLoaiPhong LIKE N'RAD-%'");SecurityContextHolder.clearContext();}
    @Test void newRoomCannotBeCreatedDirectlyOccupied(){code(()->service.create(request("RAD-A",RoomStatus.OCCUPIED),"RAD-tech"),"INVALID_INITIAL_ROOM_STATUS");assertThat(count()).isZero();}
    @Test void inactiveTypeAndDuplicateRoomKeepErrorPrecedence(){
        code(()->service.create(request("RAD-D",RoomStatus.READY),"RAD-tech"),"ROOM_TYPE_NOT_ACTIVE");
        var created=service.create(request("RAD-A",null),"RAD-tech");assertThat(created.status()).isEqualTo(RoomStatus.READY);
        code(()->service.create(request("RAD-D",RoomStatus.OCCUPIED),"RAD-tech"),"ROOM_EXISTS");assertThat(count()).isEqualTo(1);
    }
    @Test void updateMetadataAndStatusRunThroughGuardedSqlCommand(){
        service.create(request("RAD-A",null),"RAD-tech");
        var result=service.update("RAD-01",new RoomAdminDtos.Request("ignored-body","Changed room","RAD-A",2,"details",RoomStatus.MAINTENANCE),"RAD-tech");
        assertThat(result.name()).isEqualTo("Changed room");assertThat(result.status()).isEqualTo(RoomStatus.MAINTENANCE);assertThat(result.description()).isEqualTo("details");
        assertThat(service.list()).anyMatch(r->r.id().equals("RAD-01")&&r.status()==RoomStatus.MAINTENANCE);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE loaiDoiTuong=N'ROOM' AND maDoiTuong=N'RAD-01'",Integer.class)).isEqualTo(3);
    }
    @Test void invalidStatusRollsBackEarlierMetadataWrite(){
        service.create(request("RAD-A",null),"RAD-tech");
        code(()->service.update("RAD-01",new RoomAdminDtos.Request("RAD-01","Must rollback","RAD-A",3,"bad",RoomStatus.OCCUPIED),"RAD-tech"),"INVALID_ROOM_TRANSITION");
        var row=service.list().stream().filter(r->r.id().equals("RAD-01")).findFirst().orElseThrow();assertThat(row.name()).isEqualTo("Admin room");assertThat(row.status()).isEqualTo(RoomStatus.READY);
        assertThat(jdbc.queryForObject("SELECT phienBan FROM Phong WHERE maPhong=N'RAD-01'",Long.class)).isZero();
    }
    @Test void storageOverflowRollsBackWithoutAuditOrRoom(){assertThatThrownBy(()->service.create(new RoomAdminDtos.Request("RAD-01","x".repeat(101),"RAD-A",1,null,null),"RAD-tech")).isInstanceOf(org.springframework.dao.DataAccessException.class);assertThat(count()).isZero();}
    private RoomAdminDtos.Request request(String type,RoomStatus status){return new RoomAdminDtos.Request("RAD-01","Admin room",type,1,null,status);}
    private int count(){return jdbc.queryForObject("SELECT COUNT(*) FROM Phong WHERE maPhong=N'RAD-01'",Integer.class);}
    private void code(Runnable operation,String code){assertThatThrownBy(operation::run).isInstanceOf(DomainException.class).extracting("code").isEqualTo(code);}
}

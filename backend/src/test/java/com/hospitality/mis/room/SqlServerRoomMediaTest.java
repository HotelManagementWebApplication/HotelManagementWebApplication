package com.hospitality.mis.room;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.room.RoomMediaDatabase;
import com.hospitality.mis.dto.room.RoomMediaDtos;
import com.hospitality.mis.service.room.LocalRoomImageStorage;
import com.hospitality.mis.service.room.RoomMediaService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}","spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}","spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
class SqlServerRoomMediaTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired RoomMediaDatabase database;
    @Autowired PlatformTransactionManager transactions;
    @TempDir Path directory;
    RoomMediaService media;
    @BeforeEach void seed(){
        media=new RoomMediaService(database,new LocalRoomImageStorage(directory.toString()));
        jdbc.update("INSERT LoaiPhong(maLoaiPhong,ten,giaTheoNgay) VALUES(N'MEDIA-T',N'Media test',100000)");
        jdbc.update("INSERT Phong(maPhong,maLoaiPhong) VALUES(N'MEDIA-R',N'MEDIA-T')");
    }
    @AfterEach void cleanup(){
        jdbc.update("DELETE HinhAnhPhong WHERE maPhong=N'MEDIA-R'");
        jdbc.update("DELETE LoaiPhongTienNghi WHERE maLoaiPhong=N'MEDIA-T'");
        jdbc.update("DELETE TienNghi WHERE ten LIKE N'Media %'");
        jdbc.update("DELETE Phong WHERE maPhong=N'MEDIA-R'");
        jdbc.update("DELETE LoaiPhong WHERE maLoaiPhong=N'MEDIA-T'");
        jdbc.update("DELETE NhatKyKiemSoat WHERE nguoiThucHien=N'MEDIA'");
    }
    @Test void uploadAndScopedDeletePersistMetadataAuditAndPhysicalFile()throws Exception{
        var first=media.upload("MEDIA-R",file(),"MEDIA");
        assertThat(first.displayOrder()).isZero();assertThat(first.cover()).isTrue();assertThat(Files.exists(path(first))).isTrue();
        assertCode(()->media.delete("wrong",first.id(),"MEDIA"),"ROOM_IMAGE_NOT_FOUND");
        assertThat(Files.exists(path(first))).isTrue();assertThat(media.get("MEDIA-R").images()).hasSize(1);
        media.delete("MEDIA-R",first.id(),"MEDIA");
        assertThat(Files.exists(path(first))).isFalse();assertThat(media.get("MEDIA-R").images()).isEmpty();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE nguoiThucHien=N'MEDIA' AND loaiDoiTuong=N'ROOM_IMAGE'",Integer.class)).isEqualTo(2);
    }
    @Test void outerRollbackRemovesNewFileAndRollsBackMetadataAndAudit(){
        var template=new TransactionTemplate(transactions);
        final RoomMediaDtos.ImageResponse[] uploaded=new RoomMediaDtos.ImageResponse[1];
        template.executeWithoutResult(tx->{uploaded[0]=media.upload("MEDIA-R",file(),"MEDIA");assertThat(Files.exists(path(uploaded[0]))).isTrue();tx.setRollbackOnly();});
        assertThat(Files.exists(path(uploaded[0]))).isFalse();assertThat(media.get("MEDIA-R").images()).isEmpty();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE nguoiThucHien=N'MEDIA'",Integer.class)).isZero();
    }
    @Test void deletingWithinRolledBackTransactionDoesNotRemoveFile(){
        var uploaded=media.upload("MEDIA-R",file(),"MEDIA");
        new TransactionTemplate(transactions).executeWithoutResult(tx->{media.delete("MEDIA-R",uploaded.id(),"MEDIA");assertThat(Files.exists(path(uploaded))).isTrue();tx.setRollbackOnly();});
        assertThat(Files.exists(path(uploaded))).isTrue();assertThat(media.get("MEDIA-R").images()).hasSize(1);
    }
    @Test void concurrentTenthImageHasOneWinnerAndCleansTheLosingFile()throws Exception{
        for(int n=0;n<9;n++)media.upload("MEDIA-R",file(),"MEDIA");
        assertThat(race(()->{media.upload("MEDIA-R",file(),"MEDIA");return "SUCCESS";})).containsExactlyInAnyOrder("SUCCESS","ROOM_IMAGE_LIMIT");
        assertThat(media.get("MEDIA-R").images()).hasSize(10);
        try(var files=Files.walk(directory)){assertThat(files.filter(Files::isRegularFile).count()).isEqualTo(10);}
    }
    @Test void amenityCreateUpdateReplaceAndInvalidAssignmentAreAtomic(){
        var a=media.createAmenity(new RoomMediaDtos.CreateAmenityRequest(" Media A "),"MEDIA");
        var b=media.createAmenity(new RoomMediaDtos.CreateAmenityRequest("Media B"),"MEDIA");
        assertCode(()->media.createAmenity(new RoomMediaDtos.CreateAmenityRequest("Media A"),"MEDIA"),"AMENITY_ALREADY_EXISTS");
        assertThat(media.assignAmenities("MEDIA-T",new RoomMediaDtos.AssignAmenitiesRequest(List.of(a.id(),b.id(),a.id())),"MEDIA")).hasSize(2);
        media.updateAmenity(b.id(),new RoomMediaDtos.UpdateAmenityRequest("Media B",false),"MEDIA");
        assertThat(media.get("MEDIA-R").amenities()).containsExactly("Media A");
        assertCode(()->media.assignAmenities("MEDIA-T",new RoomMediaDtos.AssignAmenitiesRequest(List.of(a.id(),-1L)),"MEDIA"),"AMENITY_NOT_FOUND");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM LoaiPhongTienNghi WHERE maLoaiPhong=N'MEDIA-T'",Integer.class)).isEqualTo(2);
        assertThat(media.assignAmenities("MEDIA-T",new RoomMediaDtos.AssignAmenitiesRequest(List.of()),"MEDIA")).isEmpty();
        assertCode(()->media.get("missing"),"ROOM_NOT_FOUND");
    }
    @Test void duplicateConcurrentAmenityCreateHasOneWinner()throws Exception{
        assertThat(race(()->{media.createAmenity(new RoomMediaDtos.CreateAmenityRequest("Media race"),"MEDIA");return "SUCCESS";})).containsExactlyInAnyOrder("SUCCESS","AMENITY_ALREADY_EXISTS");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM TienNghi WHERE ten=N'Media race'",Integer.class)).isEqualTo(1);
    }
    @Test void orphanCleanupUsesViewReferencesAndGracePeriodOnRealFiles()throws Exception{
        var storage=new LocalRoomImageStorage(directory.toString());
        var kept=media.upload("MEDIA-R",file(),"MEDIA");
        var orphan=storage.store("MEDIA-R",file());
        var now=java.time.Instant.now();
        Files.setLastModifiedTime(path(kept),java.nio.file.attribute.FileTime.from(now.minusSeconds(7200)));
        Files.setLastModifiedTime(directory.resolve(orphan.relativePath()),java.nio.file.attribute.FileTime.from(now.minusSeconds(7200)));
        var cleanup=new com.hospitality.mis.service.room.RoomImageOrphanCleanupService(database,storage,java.time.Clock.fixed(now,java.time.ZoneOffset.UTC),60);
        assertThat(cleanup.cleanup()).isEqualTo(1);
        assertThat(Files.exists(path(kept))).isTrue();assertThat(Files.exists(directory.resolve(orphan.relativePath()))).isFalse();
    }
    private MockMultipartFile file(){return new MockMultipartFile("file","test.png","image/png",new byte[]{(byte)137,80,78,71,13,10,26,10,1,2,3});}
    private Path path(RoomMediaDtos.ImageResponse image){return directory.resolve(image.url().substring("/media/rooms/".length()));}
    private void assertCode(Runnable action,String code){assertThatThrownBy(action::run).isInstanceOf(DomainException.class).extracting("code").isEqualTo(code);}
    private List<String> race(Callable<String> action)throws Exception{
        var start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)){
            Callable<String> run=()->{start.await();try{return action.call();}catch(DomainException error){return error.getCode();}};
            var first=pool.submit(run);var second=pool.submit(run);start.countDown();return List.of(first.get(30,TimeUnit.SECONDS),second.get(30,TimeUnit.SECONDS));
        }
    }
}

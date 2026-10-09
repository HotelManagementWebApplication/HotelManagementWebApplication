package com.hospitality.mis.reservation;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.reservation.HotelServiceBookingDatabase;
import com.hospitality.mis.service.reservation.HotelServiceBookingService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.*;
import java.sql.SQLException;
import java.util.List;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.*;

/** Real procedure contract including replay, quota serialization and partial-write rollback. */
@SpringBootTest(properties={"spring.datasource.url=${MIGRATION_TEST_DB_URL}",
        "spring.datasource.username=${MIGRATION_TEST_DB_USERNAME}","spring.datasource.password=${MIGRATION_TEST_DB_PASSWORD}",
        "spring.flyway.enabled=true","spring.jpa.hibernate.ddl-auto=validate"})
class SqlServerHotelServiceBookingTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired HotelServiceBookingDatabase database;
    private HotelServiceBookingService service;
    private long reservation, guest, owner;
    private final LocalDateTime now=LocalDateTime.of(2035,1,10,12,0);

    @BeforeEach void seed() {
        service=new HotelServiceBookingService(database,Clock.fixed(now.atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant(),ZoneId.of("Asia/Ho_Chi_Minh")));
        jdbc.update("INSERT LoaiPhong(maLoaiPhong,ten,giaTheoNgay) VALUES(N'SB-TYPE',N'Test service booking',100000)");
        jdbc.update("INSERT Phong(maPhong,maLoaiPhong,trangThai) VALUES(N'SB-ROOM',N'SB-TYPE',N'Đang có khách')");
        guest=jdbc.queryForObject("INSERT KhachLuuTru(hoVaTen,soDienThoai,soGiayToTuyThan) OUTPUT INSERTED.maKhachLuuTru VALUES(N'Service guest',N'0997123412',N'SB-GUEST')",Long.class);
        owner=jdbc.queryForObject("INSERT TaiKhoanKhachHang(maKhachLuuTru,soDienThoai,matKhau) OUTPUT INSERTED.maTaiKhoanKhachHang VALUES(?,N'0997123412',N'unused')",Long.class,guest);
        reservation=jdbc.queryForObject("INSERT PhieuDatPhong(maKhachLuuTru,maTaiKhoanKhachHang,trangThai,hinhThucThue,trangThaiThanhToanCoc) OUTPUT INSERTED.maPhieuDatPhong VALUES(?,?,N'Đã nhận phòng',N'Theo gói',N'Đã thanh toán')",Long.class,guest,owner);
        jdbc.update("INSERT ChiTietDatPhong(maPhieuDatPhong,maPhong,thoiDiemNhanPhong,thoiDiemTraPhong,thoiDiemTraPhongBanDau,soLuongKhach,trangThai) VALUES(?,N'SB-ROOM','2035-01-10T00:00:00','2035-01-12T12:00:00','2035-01-12T12:00:00',2,N'Đang có khách')",reservation);
        for(String id:List.of("MAMREST","BREAKFAST","LNDRYSTD")) jdbc.update("INSERT DichVu(maDichVu,ten,gia,donViTinh,danhMuc,soLuongTonKho) VALUES(?,?,150000,N'lần',N'Nhà hàng cao cấp',10)",id,id);
        staff();
    }

    @AfterEach void cleanup() {
        SecurityContextHolder.clearContext();
        jdbc.update("DELETE NhatKyKiemSoat WHERE maDoiTuong=? AND loaiDoiTuong=N'RESERVATION'",String.valueOf(reservation));
        jdbc.update("DELETE BienDongKhoDichVu WHERE maDichVu IN('MAMREST','BREAKFAST','LNDRYSTD')");
        jdbc.update("DELETE DatDichVuKhachSan WHERE maPhieuDatPhong=?",reservation);
        jdbc.update("DELETE SuDungDichVu WHERE maPhieuDatPhong=?",reservation);
        jdbc.update("DELETE PhieuDatPhong WHERE maPhieuDatPhong=?",reservation);
        jdbc.update("DELETE TaiKhoanKhachHang WHERE maTaiKhoanKhachHang=?",owner);
        jdbc.update("DELETE KhachLuuTru WHERE maKhachLuuTru=?",guest);
        jdbc.update("DELETE Phong WHERE maPhong=N'SB-ROOM'");
        jdbc.update("DELETE LoaiPhong WHERE maLoaiPhong=N'SB-TYPE'");
        jdbc.update("DELETE DichVu WHERE maDichVu IN('MAMREST','BREAKFAST','LNDRYSTD')");
    }

    @Test void restaurantQueueContainsOnlyFoodOrdersForSelectedDateAndCanFilterStatus() {
        var lunch=book("MAMREST",2,"LUNCH","queue-1",now);
        var breakfast=book("BREAKFAST",1,null,"queue-2",now.minusHours(4));
        staff();
        service.markUsed(reservation,breakfast.id(),"KITCHEN");
        book("LNDRYSTD",1,null,"queue-3",now.minusHours(3));
        jdbc.update("UPDATE DichVu SET danhMuc=N'Giặt ủi' WHERE maDichVu=N'LNDRYSTD'");
        assertThat(service.restaurantBookings(now.toLocalDate(),null)).extracting(HotelServiceBookingService.Response::id).containsExactly(breakfast.id(),lunch.id());
        assertThat(service.restaurantBookings(now.toLocalDate()," confirmed ")).extracting(HotelServiceBookingService.Response::id).containsExactly(lunch.id());
    }

    @Test void markingRestaurantOrderUsedPersistsStatusStockMovementAndAudit() {
        var booked=book("MAMREST",2,"LUNCH","used-1",now);
        staff();
        assertThat(service.markRestaurantUsed(booked.id(),"KITCHEN").status()).isEqualTo("USED");
        assertThat(service.markRestaurantUsed(booked.id(),"KITCHEN").status()).isEqualTo("USED");
        assertThat(stock("MAMREST")).isEqualTo(8);
        assertThat(count("BienDongKhoDichVu")).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE hanhDong=N'HOTEL_SERVICE_USED' AND maDoiTuong=?",Integer.class,String.valueOf(reservation))).isEqualTo(1);
    }

    @Test void customerOwnershipIsEnforcedForReadAndCancel() {
        var booked=book("BREAKFAST",1,null,"ownership",now);
        customer(owner+100000);
        assertCode(()->service.customerBookings(reservation),"RESERVATION_NOT_FOUND");
        assertCode(()->service.cancelForCustomer(booked.id()),"SERVICE_BOOKING_NOT_FOUND");
        customer(owner);
        assertThat(service.customerBookings(reservation)).hasSize(1);
        assertThat(service.cancelForCustomer(booked.id()).status()).isEqualTo("CANCELLED");
        assertThat(service.cancelForCustomer(booked.id()).status()).isEqualTo("CANCELLED");
    }

    @Test void quotaReplayAndFingerprintConflictKeepOneBooking() {
        var first=book("BREAKFAST",2,null,"quota-1",now);
        var replay=book("BREAKFAST",2,null,"quota-1",now);
        assertThat(replay.id()).isEqualTo(first.id());
        assertCode(()->book("BREAKFAST",1,null,"quota-1",now),"IDEMPOTENCY_KEY_CONFLICT");
        assertThat(book("BREAKFAST",2,null,"quota-2",now).freeQuantity()).isZero();
        assertThat(first.freeQuantity()).isEqualTo(2);
        assertThat(count("DatDichVuKhachSan")).isEqualTo(2);
    }

    @Test void insufficientStockAndFutureUseRollBackAllWrites() {
        var booked=book("BREAKFAST",2,null,"rollback",now.plusHours(1));
        staff();
        assertCode(()->service.markUsed(reservation,booked.id(),"KITCHEN"),"SERVICE_NOT_DUE");
        jdbc.update("UPDATE DatDichVuKhachSan SET thoiDiemDuKien=? WHERE maDatDichVuKhachSan=?",now,booked.id());
        jdbc.update("UPDATE DichVu SET soLuongTonKho=1 WHERE maDichVu=N'BREAKFAST'");
        assertCode(()->service.markUsed(reservation,booked.id(),"KITCHEN"),"INSUFFICIENT_STOCK");
        assertThat(database.find(booked.id()).status()).isEqualTo("CONFIRMED");
        assertThat(stock("BREAKFAST")).isEqualTo(1);
        assertThat(count("BienDongKhoDichVu")).isZero();
    }

    @Test void frontDeskBookingAndConsumptionAreOneAtomicCommand() {
        assertThat(service.recordAtFrontDesk(new HotelServiceBookingService.Request(reservation,"SB-ROOM","BREAKFAST",null,2,null,null),"desk-1","KITCHEN").status()).isEqualTo("USED");
        assertThat(service.usedTotal(reservation)).isEqualByComparingTo("0");
        service=new HotelServiceBookingService(database,Clock.fixed(now.plusMinutes(5).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant(),ZoneId.of("Asia/Ho_Chi_Minh")));
        assertThat(service.recordAtFrontDesk(new HotelServiceBookingService.Request(reservation,"SB-ROOM","BREAKFAST",null,2,null,null),"desk-1","KITCHEN").status()).isEqualTo("USED");
        assertThat(stock("BREAKFAST")).isEqualTo(8);
        assertThat(count("DatDichVuKhachSan")).isEqualTo(1);
    }

    @Test void cancellationDoesNotBillUnusedService() {
        var used=book("BREAKFAST",3,null,"total-used",now);
        book("BREAKFAST",1,null,"total-cancel",now);
        staff(); service.markUsed(reservation,used.id(),"KITCHEN");
        service.cancelForReservation(reservation,"KITCHEN");
        assertThat(service.usedTotal(reservation)).isEqualByComparingTo("150000");
        assertThat(database.list(reservation,null)).extracting(HotelServiceBookingService.Response::status).containsExactly("USED","CANCELLED");
    }

    @Test void concurrentRequestsDoNotAllocateFreeAllowanceTwice() throws Exception {
        var start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var a=pool.submit(()->{start.await(); return book("BREAKFAST",2,null,"race-1",now);});
            var b=pool.submit(()->{start.await(); return book("BREAKFAST",2,null,"race-2",now);});
            start.countDown();
            assertThat(a.get(20,TimeUnit.SECONDS).freeQuantity()+b.get(20,TimeUnit.SECONDS).freeQuantity()).isEqualTo(2);
        }
        assertThat(count("DatDichVuKhachSan")).isEqualTo(2);
    }

    @Test void bookingOutsideMealHoursReturnsDomainErrorAndRollsBackAllWrites() {
        assertCode(()->book("MAMREST",1,"LUNCH","invalid-lunch",now.withHour(18).withMinute(30)),"SERVICE_OUTSIDE_MEAL_HOURS");
        assertCode(()->book("MAMREST",1,"DINNER","invalid-dinner",now),"SERVICE_OUTSIDE_MEAL_HOURS");
        assertThat(count("DatDichVuKhachSan")).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM NhatKyKiemSoat WHERE hanhDong=N'HOTEL_SERVICE_BOOKED' AND maDoiTuong=?",Integer.class,String.valueOf(reservation))).isZero();
        assertThat(book("MAMREST",1,"LUNCH","valid-lunch-start",now.withHour(11).withMinute(30)).status()).isEqualTo("CONFIRMED");
        assertThat(book("MAMREST",1,"LUNCH","valid-lunch-end",now.withHour(14)).status()).isEqualTo("CONFIRMED");
        assertThat(book("MAMREST",1,"DINNER","valid-dinner-start",now.withHour(18)).status()).isEqualTo("CONFIRMED");
        assertThat(book("MAMREST",1,"DINNER","valid-dinner-end",now.withHour(22)).status()).isEqualTo("CONFIRMED");
    }

    @Test void mealWindowTriggerRejectsLunchOutsidePublishedHours() {
        var booked=book("MAMREST",1,"LUNCH","meal-window",now);
        assertSqlError(()->jdbc.update("UPDATE DatDichVuKhachSan SET thoiDiemDuKien='2035-01-10T18:30:00' WHERE maDatDichVuKhachSan=?",booked.id()),53609);
        assertThat(database.find(booked.id()).scheduledAt()).isEqualTo(now);
    }

    @Test void stayWindowTriggerRejectsServiceOutsideTheBookedRoomInterval() {
        var booked=book("BREAKFAST",1,null,"stay-window",now);
        assertSqlError(()->jdbc.update("UPDATE DatDichVuKhachSan SET thoiDiemDuKien='2035-01-12T12:00:00' WHERE maDatDichVuKhachSan=?",booked.id()),53610);
        assertThat(database.find(booked.id()).scheduledAt()).isEqualTo(now);
    }

    @Test void usedStatusTriggerRequiresCheckedInReservation() {
        var booked=book("BREAKFAST",1,null,"used-state",now);
        jdbc.update("UPDATE PhieuDatPhong SET trangThai=N'Đã xác nhận' WHERE maPhieuDatPhong=?",reservation);
        assertSqlError(()->jdbc.update("UPDATE DatDichVuKhachSan SET trangThai=N'Đã sử dụng' WHERE maDatDichVuKhachSan=?",booked.id()),53611);
        assertThat(database.find(booked.id()).status()).isEqualTo("CONFIRMED");
    }

    private HotelServiceBookingService.Response book(String id,int quantity,String meal,String key,LocalDateTime at) {
        customer(owner);
        return service.bookForCustomer(new HotelServiceBookingService.Request(reservation,"SB-ROOM",id,at,quantity,meal,null),key);
    }
    private void staff(){SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("KITCHEN","", "ROLE_KITCHEN"));}
    private void customer(long id){
        var token=org.springframework.security.oauth2.jwt.Jwt.withTokenValue("service-test").header("alg","none")
                .subject(String.valueOf(id)).claim("principal_type","CUSTOMER").claim("principal_id",String.valueOf(id)).build();
        SecurityContextHolder.getContext().setAuthentication(new org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken(
                token,List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_CUSTOMER")),String.valueOf(id)));
    }
    private int stock(String id){return jdbc.queryForObject("SELECT soLuongTonKho FROM DichVu WHERE maDichVu=?",Integer.class,id);}
    private int count(String table){return jdbc.queryForObject("SELECT COUNT(*) FROM "+table,Integer.class);}
    private void assertCode(Runnable command,String code){assertThatThrownBy(command::run).isInstanceOf(DomainException.class).extracting("code").isEqualTo(code);}
    private void assertSqlError(Runnable command,int errorCode) {
        assertThatThrownBy(command::run).satisfies(error->{
            Throwable cause=error;
            while(cause!=null && !(cause instanceof SQLException)) cause=cause.getCause();
            assertThat(cause).isInstanceOf(SQLException.class);
            assertThat(((SQLException)cause).getErrorCode()).isEqualTo(errorCode);
        });
    }
}

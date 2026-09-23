package com.hospitality.mis.dao.reservation;
import com.hospitality.mis.entity.reservation.ReservationRoom;




import com.hospitality.mis.entity.reservation.Reservation;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import com.hospitality.mis.entity.room.RoomStatus;
import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.EntityGraph;

import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.jpa.repository.Lock;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import org.springframework.data.repository.query.Param;



import java.time.LocalDateTime;

import java.util.List;

import java.util.Optional;



/** Kho aggregate đặt phòng, gồm phân trang, nạp graph, khóa ghi và kiểm tra trùng lịch.
 * Các lần lưu thông thường dựa vào optimistic version; các phương thức @Lock khóa pessimistic theo nhu cầu cập nhật.
 */
public interface ReservationRepository extends JpaRepository<Reservation, Long> {
    /** Lấy booking của đúng customer account, kèm phòng và loại phòng cho DTO sở hữu. */
    @EntityGraph(attributePaths = {"rooms", "rooms.room", "rooms.room.roomType", "customerAccount"})
    @Query("select distinct r from Reservation r where r.id = :id and r.customerAccount.id = :customerAccountId")
    Optional<Reservation> findCustomerDetails(@Param("id") Long id,
                                               @Param("customerAccountId") Long customerAccountId);

    /** Liệt kê booking online của đúng customer, không trả dữ liệu của guest khác. */
    @EntityGraph(attributePaths = {"rooms", "rooms.room", "rooms.room.roomType", "customerAccount"})
    @Query("select distinct r from Reservation r where r.customerAccount.id = :customerAccountId order by r.bookedAt desc, r.id desc")
    List<Reservation> findCustomerDetails(@Param("customerAccountId") Long customerAccountId);
    /**
     * Giai đoạn một của phân trang: chỉ lấy ID theo bộ lọc và thứ tự ổn định.
     * Tầng gọi dùng các ID này để giới hạn truy vấn chi tiết, tránh phân trang
     * trực tiếp trên fetch collection làm ORM phải tải toàn bộ kết quả vào bộ nhớ.
     *
     * @param owner mã nhân viên sở hữu, null để bỏ lọc
     * @param status trạng thái đặt phòng, null để bỏ lọc
     * @param guestId ID khách, null để bỏ lọc
     * @param pageable trang và kích thước cần lấy
     * @return trang ID đặt phòng theo bookedAt giảm dần rồi ID giảm dần
     */
    @Query("select r.id from Reservation r where (:owner is null or (r.employee is not null and r.employee.employeeId = :owner)) "
            + "and (:status is null or r.status = :status) and (:guestId is null or r.guest.id = :guestId) "
            + "order by r.bookedAt desc, r.id desc")
    org.springframework.data.domain.Page<Long> searchIds(@Param("owner") String owner,
            @Param("status") ReservationStatus status, @Param("guestId") Long guestId,
            org.springframework.data.domain.Pageable pageable);

    /** Dashboard read model: filter, stable sort and page are evaluated by the database. */
    @Query(value = "select r.id from Reservation r "
            + "left join r.rooms sortRoom left join r.invoice dashboardInvoice "
            + "where (:status is null or r.status = :status) "
            + "and (:query = '' or lower(str(r.id)) like concat('%', :query, '%') "
            + "or lower(r.guest.fullName) like concat('%', :query, '%') "
            + "or r.guest.phone like concat('%', :query, '%') "
            + "or exists (select roomQuery from ReservationRoom roomQuery "
            + "where roomQuery.reservation = r and lower(roomQuery.room.id) like concat('%', :query, '%'))) "
            + "and (:bucket = 'ALL' "
            + "or (:bucket = 'ARRIVALS' and r.status in (com.hospitality.mis.entity.reservation.ReservationStatus.CONFIRMED, com.hospitality.mis.entity.reservation.ReservationStatus.DEPOSIT_PAID) "
            + "and exists (select arrivalRoom from ReservationRoom arrivalRoom where arrivalRoom.reservation = r and arrivalRoom.status = com.hospitality.mis.entity.room.RoomStatus.RESERVED and arrivalRoom.checkIn >= :fromAt and arrivalRoom.checkIn < :toAt) "
            + "and not exists (select earlierArrivalRoom from ReservationRoom earlierArrivalRoom where earlierArrivalRoom.reservation = r and earlierArrivalRoom.status = com.hospitality.mis.entity.room.RoomStatus.RESERVED and earlierArrivalRoom.checkIn < :fromAt)) "
            + "or (:bucket = 'DEPARTURES' and r.status = com.hospitality.mis.entity.reservation.ReservationStatus.CHECKED_IN "
            + "and exists (select departureRoom from ReservationRoom departureRoom where departureRoom.reservation = r and departureRoom.checkOut >= :fromAt and departureRoom.checkOut < :toAt) "
            + "and not exists (select laterDepartureRoom from ReservationRoom laterDepartureRoom where laterDepartureRoom.reservation = r and laterDepartureRoom.checkOut >= :toAt)) "
            + "or (:bucket = 'CURRENT' and r.status = com.hospitality.mis.entity.reservation.ReservationStatus.CHECKED_IN) "
            + "or (:bucket = 'UPCOMING' and r.status in (com.hospitality.mis.entity.reservation.ReservationStatus.CONFIRMED, com.hospitality.mis.entity.reservation.ReservationStatus.DEPOSIT_PAID) "
            + "and exists (select upcomingRoom from ReservationRoom upcomingRoom where upcomingRoom.reservation = r "
            + "and upcomingRoom.status = com.hospitality.mis.entity.room.RoomStatus.RESERVED and upcomingRoom.checkIn >= :toAt)) "
            + "or (:bucket = 'UNPAID_DEPOSITS' and (r.depositPaymentStatus = com.hospitality.mis.entity.reservation.DepositPaymentStatus.PENDING "
            + "or (r.depositAmount > 0 and r.depositPaymentStatus <> com.hospitality.mis.entity.reservation.DepositPaymentStatus.PAID))) "
            + "or (:bucket = 'INVOICE_BALANCES' and dashboardInvoice is not null and dashboardInvoice.amountDue > 0)) "
            + "group by r.id order by min(sortRoom.checkIn) asc, r.id asc",
            countQuery = "select count(r.id) from Reservation r left join r.invoice dashboardInvoice "
                    + "where (:status is null or r.status = :status) "
                    + "and (:query = '' or lower(str(r.id)) like concat('%', :query, '%') "
                    + "or lower(r.guest.fullName) like concat('%', :query, '%') "
                    + "or r.guest.phone like concat('%', :query, '%') "
                    + "or exists (select roomQuery from ReservationRoom roomQuery "
                    + "where roomQuery.reservation = r and lower(roomQuery.room.id) like concat('%', :query, '%'))) "
                    + "and (:bucket = 'ALL' "
                    + "or (:bucket = 'ARRIVALS' and r.status in (com.hospitality.mis.entity.reservation.ReservationStatus.CONFIRMED, com.hospitality.mis.entity.reservation.ReservationStatus.DEPOSIT_PAID) "
                    + "and exists (select arrivalRoom from ReservationRoom arrivalRoom where arrivalRoom.reservation = r and arrivalRoom.status = com.hospitality.mis.entity.room.RoomStatus.RESERVED and arrivalRoom.checkIn >= :fromAt and arrivalRoom.checkIn < :toAt) "
                    + "and not exists (select earlierArrivalRoom from ReservationRoom earlierArrivalRoom where earlierArrivalRoom.reservation = r and earlierArrivalRoom.status = com.hospitality.mis.entity.room.RoomStatus.RESERVED and earlierArrivalRoom.checkIn < :fromAt)) "
                    + "or (:bucket = 'DEPARTURES' and r.status = com.hospitality.mis.entity.reservation.ReservationStatus.CHECKED_IN "
                    + "and exists (select departureRoom from ReservationRoom departureRoom where departureRoom.reservation = r and departureRoom.checkOut >= :fromAt and departureRoom.checkOut < :toAt) "
                    + "and not exists (select laterDepartureRoom from ReservationRoom laterDepartureRoom where laterDepartureRoom.reservation = r and laterDepartureRoom.checkOut >= :toAt)) "
                    + "or (:bucket = 'CURRENT' and r.status = com.hospitality.mis.entity.reservation.ReservationStatus.CHECKED_IN) "
                    + "or (:bucket = 'UPCOMING' and r.status in (com.hospitality.mis.entity.reservation.ReservationStatus.CONFIRMED, com.hospitality.mis.entity.reservation.ReservationStatus.DEPOSIT_PAID) "
                    + "and exists (select upcomingRoom from ReservationRoom upcomingRoom where upcomingRoom.reservation = r "
                    + "and upcomingRoom.status = com.hospitality.mis.entity.room.RoomStatus.RESERVED and upcomingRoom.checkIn >= :toAt)) "
                    + "or (:bucket = 'UNPAID_DEPOSITS' and (r.depositPaymentStatus = com.hospitality.mis.entity.reservation.DepositPaymentStatus.PENDING "
                    + "or (r.depositAmount > 0 and r.depositPaymentStatus <> com.hospitality.mis.entity.reservation.DepositPaymentStatus.PAID))) "
                    + "or (:bucket = 'INVOICE_BALANCES' and dashboardInvoice is not null and dashboardInvoice.amountDue > 0))")
    Page<Long> dashboardIds(@Param("query") String query, @Param("status") ReservationStatus status,
                            @Param("bucket") String bucket, @Param("fromAt") LocalDateTime fromAt,
                            @Param("toAt") LocalDateTime toAt, Pageable pageable);

    /** Nạp bounded dashboard pages without changing the general reservation search contract. */
    @EntityGraph(attributePaths = {"guest", "rooms", "rooms.room", "invoice"})
    @Query("select distinct r from Reservation r where r.id in :ids")
    List<Reservation> findDashboardDetails(@Param("ids") List<Long> ids);

    /**
     * Giai đoạn hai của phân trang: nạp đầy đủ các aggregate theo danh sách ID.
     * Entity graph mở rộng khách, nhân viên, dòng phòng và phòng liên quan để
     * tránh lazy-load ngoài giao dịch; kết quả cần được ghép lại theo thứ tự ID
     * của giai đoạn một nếu hợp đồng hiển thị yêu cầu thứ tự đó.
     *
     * @param ids các ID đã được chọn ở giai đoạn phân trang trước
     * @return các đặt phòng có trong ids, kèm quan hệ được khai báo trong graph
     */
    @EntityGraph(attributePaths = {"guest", "employee", "rooms", "rooms.room"})
    @Query("select distinct r from Reservation r where r.id in :ids")
    List<Reservation> findPageDetails(@Param("ids") List<Long> ids);

    /**
     * Nạp một đặt phòng cùng khách, nhân viên, phòng, loại phòng và dịch vụ.
     * Entity graph xác định trước các quan hệ cần cho màn hình chi tiết để
     * việc đọc không phát sinh chuỗi truy vấn lazy ngoài transaction.
     *
     * @param id ID đặt phòng cần đọc
     * @return aggregate chi tiết hoặc rỗng khi không tồn tại
     */
    @EntityGraph(attributePaths = {"guest", "employee", "rooms", "rooms.room", "rooms.room.roomType", "serviceUsages", "serviceUsages.service"})
    @Query("select distinct r from Reservation r where r.id = :id")
    Optional<Reservation> findDetails(@Param("id") Long id);

    /** Tìm đặt phòng theo khóa chống lặp mà không khóa; dùng để nhận diện yêu cầu đã ghi nhận. */
    Optional<Reservation> findByIdempotencyKey(String idempotencyKey);

    /** Khóa booking theo mã cọc để callback payment không xử lý đồng thời hai lần. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select distinct r from Reservation r join fetch r.guest join fetch r.rooms rr join fetch rr.room join fetch rr.room.roomType where r.depositPaymentCode = :code")
    Optional<Reservation> findByDepositPaymentCodeForUpdate(@Param("code") String code);

    /** Lấy các booking customer giữ phòng quá hạn dưới khóa ghi để giải phóng an toàn. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Reservation r where r.status = com.hospitality.mis.entity.reservation.ReservationStatus.DRAFT "
            + "and r.depositPaymentStatus = com.hospitality.mis.entity.reservation.DepositPaymentStatus.PENDING "
            + "and r.depositPaymentExpiresAt <= :now order by r.id")
    List<Reservation> findExpiredCustomerHoldsForUpdate(@Param("now") LocalDateTime now);

    /** Khóa đặt phòng theo khóa chống lặp để kiểm tra và tạo dữ liệu đúng một lần trong transaction. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Reservation r where r.idempotencyKey = :key")
    Optional<Reservation> findByIdempotencyKeyForUpdate(@Param("key") String key);


    /**
     * Khóa đặt phòng và fetch các quan hệ cần cho cập nhật nghiệp vụ.
     * Khóa pessimistic chỉ có ý nghĩa khi phương thức được gọi trong transaction
     * ghi; truy vấn fetch giúp aggregate đã khóa không phụ thuộc lazy-load.
     *
     * @param id ID đặt phòng cần khóa
     * @return aggregate đã nạp hoặc rỗng nếu không tồn tại
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)

    @Query("select distinct r from Reservation r join fetch r.guest join fetch r.rooms rr join fetch rr.room join fetch rr.room.roomType where r.id = :id")
    Optional<Reservation> findForUpdate(@Param("id") Long id);


    /**
     * Kiểm tra giao nhau nửa kín của khoảng đặt với các phòng đang chiếm chỗ:
     * checkIn < to và checkOut > from. Các phòng đã hủy và trạng thái đặt phòng
     * bị bỏ qua không tham gia kết quả.
     *
     * @param roomId phòng cần kiểm tra
     * @param from thời điểm bắt đầu khoảng mới
     * @param to thời điểm kết thúc khoảng mới
     * @param cancelledRoom trạng thái dòng phòng đã hủy cần loại trừ
     * @param ignoredReservations các trạng thái đặt phòng không chiếm chỗ
     * @return true nếu có ít nhất một dòng phòng giao nhau
     */
    @Query("select count(rr) > 0 from ReservationRoom rr where rr.room.id = :roomId and rr.checkIn < :to and rr.checkOut > :from and rr.status <> :cancelledRoom and rr.reservation.status not in :ignoredReservations and not (rr.reservation.status = com.hospitality.mis.entity.reservation.ReservationStatus.DRAFT and rr.reservation.customerAccount is not null and rr.reservation.depositPaymentStatus = com.hospitality.mis.entity.reservation.DepositPaymentStatus.PENDING and rr.reservation.depositPaymentExpiresAt <= CURRENT_TIMESTAMP)")
    boolean hasOverlap(@Param("roomId") String roomId, @Param("from") LocalDateTime from,
                       @Param("to") LocalDateTime to, @Param("cancelledRoom") RoomStatus cancelledRoom,
                       @Param("ignoredReservations") List<ReservationStatus> ignoredReservations);



    /**
     * Kiểm tra giao nhau như hasOverlap nhưng loại trừ chính một đặt phòng,
     * phục vụ đổi ngày hoặc đổi phòng mà không tự xung đột với dữ liệu hiện tại.
     *
     * @param excludedReservationId ID đặt phòng đang được sửa
     * @param roomId phòng cần kiểm tra
     * @param from thời điểm bắt đầu khoảng mới
     * @param to thời điểm kết thúc khoảng mới
     * @param cancelledRoom trạng thái dòng phòng đã hủy cần loại trừ
     * @param ignoredReservations các trạng thái đặt phòng không chiếm chỗ
     * @return true nếu còn đặt phòng khác giao nhau
     */
    @Query("select count(rr) > 0 from ReservationRoom rr where rr.room.id = :roomId and rr.checkIn < :to and rr.checkOut > :from and rr.reservation.id <> :excludedReservationId and rr.status <> :cancelledRoom and rr.reservation.status not in :ignoredReservations and not (rr.reservation.status = com.hospitality.mis.entity.reservation.ReservationStatus.DRAFT and rr.reservation.customerAccount is not null and rr.reservation.depositPaymentStatus = com.hospitality.mis.entity.reservation.DepositPaymentStatus.PENDING and rr.reservation.depositPaymentExpiresAt <= CURRENT_TIMESTAMP)")
    boolean hasOverlapExcludingReservation(@Param("excludedReservationId") Long excludedReservationId,

                                           @Param("roomId") String roomId,

                                           @Param("from") LocalDateTime from,

                                           @Param("to") LocalDateTime to,

                                           @Param("cancelledRoom") RoomStatus cancelledRoom,
                                           @Param("ignoredReservations") List<ReservationStatus> ignoredReservations);

}

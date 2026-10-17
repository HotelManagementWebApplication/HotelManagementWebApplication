package com.hospitality.mis.dao.guest;



import com.hospitality.mis.entity.guest.Guest;
import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.jpa.repository.Query;

import org.springframework.data.repository.query.Param;



import java.util.List;
import java.util.Optional;


/**

 * Kho lưu trữ cho thành phần sở hữu khách chuẩn hóa.
 * JpaRepository xử lý kiểm tra optimistic version khi lưu bản ghi khách.
 */
public interface GuestRepository extends JpaRepository<Guest, Long> {
    /** Tra cứu khách theo số điện thoại để tái sử dụng hồ sơ dùng chung. */
    Optional<Guest> findByPhone(String phone);

    /** Tra cứu khách theo số giấy tờ định danh, thường dùng để chống tạo trùng hồ sơ. */
    Optional<Guest> findByIdentityNumber(String identityNumber);
    @Query("select g from Guest g where g.id = :id")
    Optional<Guest> findSharedById(@Param("id") Long id);

    /** Tìm gần đúng theo tên, giấy tờ hoặc điện thoại và trả kết quả ổn định theo tên rồi ID. */
    @Query("select g from Guest g where lower(g.fullName) like lower(concat('%', :q, '%')) " +
            "or g.identityNumber like concat('%', :q, '%') or g.phone like concat('%', :q, '%') " +
            "order by g.fullName asc, g.id asc")
    List<Guest> searchShared(@Param("q") String query);

    /** Lấy toàn bộ sổ khách dùng chung theo thứ tự tên rồi ID để phân phối ổn định. */
    @Query("select g from Guest g order by g.fullName asc, g.id asc")
    List<Guest> findAllShared();
}

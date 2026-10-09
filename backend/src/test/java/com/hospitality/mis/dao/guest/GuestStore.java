package com.hospitality.mis.dao.guest;



import com.hospitality.mis.entity.guest.Guest;



import java.util.List;

import java.util.Optional;



/** Cổng lưu trữ phục vụ các dịch vụ ứng dụng dành cho khách. */

public interface GuestStore {

    /** Tạo đối tượng khách mới chưa gắn với bản ghi bền vững. */
    Guest newGuest();



    /** Lưu và đồng bộ hồ sơ khách với persistence context; trả về thực thể được quản lý. */
    Guest save(Guest guest);



    /**
     * Tìm khách trong sổ đăng ký dùng chung trên toàn khách sạn.
     *
     * Phạm vi được nêu rõ trong cổng vì bản ghi khách không thuộc quyền sở hữu
     * của người tạo.
     */
    Optional<Guest> findSharedById(Long id);

    /** Tìm hồ sơ dùng chung theo số điện thoại. */
    Optional<Guest> findByPhone(String phone);

    /** Tìm hồ sơ dùng chung theo số giấy tờ định danh. */
    Optional<Guest> findByIdentityNumber(String identityNumber);

    /** Trả về mọi khách trong sổ đăng ký dùng chung trên toàn khách sạn. */
    List<Guest> findAllShared();

    /** Tìm kiếm trong sổ đăng ký dùng chung trên toàn khách sạn. */
    List<Guest> searchShared(String query);
}

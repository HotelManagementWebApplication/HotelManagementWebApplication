package com.hospitality.mis.dao.guest;



import com.hospitality.mis.dao.guest.GuestStore;

import com.hospitality.mis.entity.guest.Guest;

import org.springframework.stereotype.Repository;



import java.util.List;

import java.util.Optional;



/** Bộ chuyển tiếp JPA cho thực thể khách chuẩn hóa. */
@Repository

public class JpaGuestStore implements GuestStore {

    /** Repository JPA thực hiện các truy vấn trên sổ khách chuẩn hóa. */
    private final GuestRepository repository;



    public JpaGuestStore(GuestRepository repository) {

        this.repository = repository;

    }



    @Override

    /** Tạo aggregate khách mới để tầng ứng dụng điền dữ liệu trước khi lưu. */
    public Guest newGuest() {

        return new Guest();
    }



    @Override

    /** Ủy quyền lưu và flush để lỗi ràng buộc được phát hiện trong phạm vi giao dịch hiện tại. */
    public Guest save(Guest guest) {

        return repository.saveAndFlush(guest);
    }



    @Override

    /** Đọc hồ sơ khách dùng chung theo ID và giữ nguyên Optional khi không tìm thấy. */
    public Optional<Guest> findSharedById(Long id) {
        return repository.findSharedById(id);
    }

    @Override
    /** Đọc hồ sơ khách dùng chung theo số điện thoại. */
    public Optional<Guest> findByPhone(String phone) {
        return repository.findByPhone(phone);
    }

    @Override
    /** Đọc hồ sơ khách dùng chung theo số giấy tờ định danh. */
    public Optional<Guest> findByIdentityNumber(String identityNumber) {
        return repository.findByIdentityNumber(identityNumber);
    }

    @Override
    /** Trả về toàn bộ sổ khách theo thứ tự mà repository quy định. */
    public List<Guest> findAllShared() {
        return repository.findAllShared();
    }

    @Override
    /** Chuyển tiếp tìm kiếm gần đúng trên tên, giấy tờ và điện thoại. */
    public List<Guest> searchShared(String query) {
        return repository.searchShared(query);
    }
}

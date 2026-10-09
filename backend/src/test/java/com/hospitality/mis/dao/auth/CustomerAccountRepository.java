package com.hospitality.mis.dao.auth;

import com.hospitality.mis.entity.auth.CustomerAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Kho bền vững cho tài khoản khách và các truy vấn nhận diện tài khoản. */
public interface CustomerAccountRepository extends JpaRepository<CustomerAccount, Long> {
    /** Tìm tài khoản khách theo số điện thoại; kết quả rỗng nếu số chưa được đăng ký. */
    Optional<CustomerAccount> findByPhone(String phone);

    /** Kiểm tra nhanh tính duy nhất của số điện thoại trước khi tạo tài khoản. */
    boolean existsByPhone(String phone);

    /** Tải tài khoản cùng guest để customer booking không cần nhận guest_id từ client. */
    @EntityGraph(attributePaths = "guest")
    @Query("select a from CustomerAccount a where a.id = :id")
    Optional<CustomerAccount> findByIdWithGuest(@Param("id") Long id);

    /** Tìm tài khoản khách hàng theo địa chỉ email của khách. */
    @EntityGraph(attributePaths = "guest")
    @Query("select a from CustomerAccount a where lower(a.guest.email) = lower(:email)")
    Optional<CustomerAccount> findByGuestEmail(@Param("email") String email);

    /** Kiểm tra xem địa chỉ email đã được liên kết với tài khoản khách nào chưa. */
    @Query("select count(a) > 0 from CustomerAccount a where lower(a.guest.email) = lower(:email)")
    boolean existsByGuestEmail(@Param("email") String email);
}

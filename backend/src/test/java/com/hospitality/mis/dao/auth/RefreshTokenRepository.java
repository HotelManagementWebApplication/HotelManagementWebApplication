package com.hospitality.mis.dao.auth;



import com.hospitality.mis.entity.auth.RefreshToken;

import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.jpa.repository.Modifying;

import org.springframework.data.jpa.repository.Query;

import org.springframework.data.repository.query.Param;

import org.springframework.data.jpa.repository.Lock;



import jakarta.persistence.LockModeType;

import java.time.Instant;

import java.util.List;

import java.util.Optional;



/** Kho token làm mới, bao gồm đọc token và các thao tác thu hồi theo phạm vi. */
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    List<RefreshToken> findByEmployeeIdOrderByIssuedAtDesc(String employeeId);
    /** Lấy các token còn hiệu lực trong cùng một gia đình tại thời điểm kiểm tra. */
    List<RefreshToken> findByFamilyIdAndRevokedAtIsNullAndExpiresAtAfter(String familyId, Instant now);

    /** Đọc token và khóa pessimistic để việc xoay vòng hoặc thu hồi diễn ra độc quyền trong giao dịch. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)

    @Query("select token from RefreshToken token where token.tokenHash = :tokenHash")

    Optional<RefreshToken> findForUpdate(@Param("tokenHash") String tokenHash);



    /** Lấy toàn bộ token của một gia đình dưới khóa ghi để thu hồi nhất quán. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)

    List<RefreshToken> findAllByFamilyId(String familyId);



    /** Thu hồi các token chưa bị thu hồi trong một gia đình; trả về số dòng đã cập nhật. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)

    @Query("update RefreshToken token set token.revokedAt = :revokedAt "

            + "where token.familyId = :familyId and token.revokedAt is null")

    int revokeFamily(@Param("familyId") String familyId, @Param("revokedAt") Instant revokedAt);



    /** Thu hồi token đang hoạt động của nhân viên; thao tác bulk cần nằm trong giao dịch ghi. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)

    @Query("update RefreshToken token set token.revokedAt = :revokedAt "

            + "where token.employeeId = :employeeId and token.revokedAt is null")

    int revokeAllForEmployee(@Param("employeeId") String employeeId, @Param("revokedAt") Instant revokedAt);

    /** Thu hồi token đang hoạt động của tài khoản khách; trả về số bản ghi bị tác động và cần transaction ghi. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update RefreshToken token set token.revokedAt = :revokedAt where token.customerAccountId = :customerAccountId and token.revokedAt is null")
    int revokeAllForCustomer(@Param("customerAccountId") Long customerAccountId, @Param("revokedAt") Instant revokedAt);

}

package com.hospitality.mis.dao.guest;

import com.hospitality.mis.entity.guest.MembershipHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

/** Kho lịch sử thay đổi hạng thành viên của khách. */
public interface MembershipHistoryRepository extends JpaRepository<MembershipHistory, Long> {
    /** Lấy lịch sử thay đổi hạng thành viên của khách, thay đổi mới nhất trước. */
    List<MembershipHistory> findByGuestIdOrderByChangedAtDesc(Long guestId);
}

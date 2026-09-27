package com.hospitality.mis.dao.room;



import com.hospitality.mis.dao.room.ReservationOverlapPort;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Component;



import java.time.LocalDateTime;



/**

 * Thích ứng truy vấn kiểm tra trùng lịch đặt phòng hiện có cho cổng đọc thông tin phòng.

 * Không bổ sung thực thể, bảng, endpoint hoặc hành vi đặt phòng tại đây.

 */

@Component

public class JpaReservationOverlapAdapter implements ReservationOverlapPort {
    /** EntityManager chạy truy vấn đọc hiện có trên bảng đặt phòng và dòng phòng. */
    @PersistenceContext
    private EntityManager entityManager;

    public JpaReservationOverlapAdapter() {}


    @Override

    /**
     * Đếm các dòng phòng giao nhau theo khoảng nửa kín và loại trừ các trạng thái
     * không còn chiếm chỗ; kết quả boolean phục vụ kiểm tra khả dụng chỉ đọc.
     * Việc nhất quán với transaction và isolation của caller được giao cho tầng
     * dịch vụ bao quanh thao tác này.
     *
     * @param roomId mã phòng cần kiểm tra
     * @param from thời điểm bắt đầu khoảng cần kiểm tra
     * @param to thời điểm kết thúc khoảng cần kiểm tra
     * @return true khi truy vấn đếm được ít nhất một đặt phòng trùng khoảng
     */
    public boolean hasOverlap(String roomId, LocalDateTime from, LocalDateTime to) {

        Number count = (Number) entityManager.createNativeQuery("""
                select count(*)
                from ChiTietDatPhong rr
                join PhieuDatPhong r on r.maPhieuDatPhong = rr.maPhieuDatPhong
                where rr.maPhong = :roomId
                  and rr.thoiDiemNhanPhong < :to and rr.thoiDiemTraPhong > :from
                  and rr.trangThai <> N'Đã hủy'
                  and r.trangThai not in (N'Đã hủy', N'Không đến', N'Đã trả phòng')
                """)
                .setParameter("roomId", roomId)
                .setParameter("from", from)
                .setParameter("to", to)
                .getSingleResult();
        return count.longValue() > 0;
    }
}

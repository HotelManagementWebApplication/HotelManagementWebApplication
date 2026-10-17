package com.hospitality.mis.dao.identity;



import com.hospitality.mis.entity.identity.Employee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import java.util.Optional;


/**

 * Bộ chuyển tiếp lưu trữ chuẩn hóa cho aggregate tài khoản nhân viên.
 *

 * <p>Các chức năng ứng dụng danh tính, bảo mật và đặt phòng phụ thuộc vào
 * aggregate Nhân viên chuẩn hóa.</p>
 */

public interface EmployeeRepository extends JpaRepository<Employee, String> {
    /** Kiểm tra số điện thoại đã thuộc một tài khoản nhân viên hay chưa. */
    boolean existsByPhone(String phone);

    /** Khóa tài khoản nhân viên để cập nhật an toàn trong giao dịch hiện tại. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Employee> findForUpdateByEmployeeId(String employeeId);
}

package com.hospitality.mis.dao.billing;



import com.hospitality.mis.entity.billing.Service;
import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.jpa.repository.Lock;

import jakarta.persistence.LockModeType;

import java.util.Optional;
import java.util.List;



/** Kho danh mục dịch vụ, có khả năng khóa dịch vụ trước khi thay đổi số lượng hoặc giá. */
public interface ServiceRepository extends JpaRepository<Service, String> {
    /** Chỉ lấy dịch vụ active theo thứ tự tên ổn định cho public catalog. */
    List<Service> findByActiveTrueOrderByNameAsc();

    /** Lọc low-stock theo ngưỡng của từng mặt hàng ngay tại DB. */
    @org.springframework.data.jpa.repository.Query("select s from Service s where s.stockQuantity <= s.safetyThreshold order by s.name asc")
    List<Service> findLowStock();

    /** Khóa bản ghi dịch vụ để cập nhật tồn kho hoặc đơn giá độc quyền trong giao dịch. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)

    Optional<Service> findWithLockById(String id);
}

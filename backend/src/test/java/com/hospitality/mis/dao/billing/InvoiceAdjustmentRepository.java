package com.hospitality.mis.dao.billing;

import com.hospitality.mis.entity.billing.InvoiceAdjustment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

/** Kho các điều chỉnh hóa đơn và khóa chống lặp của chúng. */
public interface InvoiceAdjustmentRepository extends JpaRepository<InvoiceAdjustment, Long> {
    /** Lấy các điều chỉnh có khóa chống lặp thuộc cùng tiền tố nghiệp vụ. */
    List<InvoiceAdjustment> findByIdempotencyKeyStartingWith(String prefix);
}

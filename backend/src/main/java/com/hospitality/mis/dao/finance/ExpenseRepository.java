package com.hospitality.mis.dao.finance;

import com.hospitality.mis.entity.finance.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.time.LocalDateTime;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Kho các khoản chi vận hành và truy vấn theo trạng thái thanh toán. */
public interface ExpenseRepository extends JpaRepository<Expense, Long> {
    /** Lấy các khoản chi theo trạng thái, sắp xếp khoản thanh toán mới nhất trước. */
    List<Expense> findByStatusOrderByPaidAtDesc(Expense.ExpenseStatus status);

    /** Lấy toàn bộ khoản chi theo thời điểm thanh toán giảm dần. */
    List<Expense> findAllByOrderByPaidAtDesc();
    @Query("select e from Expense e where (:category is null or e.category = :category) and (:status is null or e.status = :status) and (:fromAt is null or e.paidAt >= :fromAt) and (:toAt is null or e.paidAt < :toAt)")
    Page<Expense> search(@Param("category") String category, @Param("status") Expense.ExpenseStatus status,
                         @Param("fromAt") LocalDateTime fromAt, @Param("toAt") LocalDateTime toAt, Pageable pageable);
}

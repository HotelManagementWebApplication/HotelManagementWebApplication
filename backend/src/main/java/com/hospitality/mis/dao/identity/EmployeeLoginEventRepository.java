package com.hospitality.mis.dao.identity;

import com.hospitality.mis.entity.identity.EmployeeLoginEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmployeeLoginEventRepository extends JpaRepository<EmployeeLoginEvent, Long> {
    Page<EmployeeLoginEvent> findByEmployeeEmployeeId(String employeeId, Pageable pageable);
}

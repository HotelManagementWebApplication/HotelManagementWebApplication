package com.hospitality.mis.dao.identity;
import com.hospitality.mis.entity.identity.EmployeeShift;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
import java.time.LocalDateTime;
import com.hospitality.mis.entity.identity.EmployeeShift.Status;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import java.util.Optional;
public interface EmployeeShiftRepository extends JpaRepository<EmployeeShift, Long> {
    List<EmployeeShift> findByShiftDateOrderByStartsAtAsc(LocalDate date);
    List<EmployeeShift> findByEmployeeEmployeeIdAndShiftDateOrderByStartsAtAsc(String employeeId, LocalDate date);
    List<EmployeeShift> findByShiftDateBetweenOrderByShiftDateAscStartsAtAsc(LocalDate from, LocalDate to);
    List<EmployeeShift> findByEmployeeEmployeeIdAndShiftDateBetweenOrderByShiftDateAscStartsAtAsc(String employeeId, LocalDate from, LocalDate to);
    @Query("select count(s) > 0 from EmployeeShift s where s.employee.employeeId = :employeeId and s.status <> :cancelled and s.startsAt < :endsAt and s.endsAt > :startsAt")
    boolean hasOverlap(@Param("employeeId") String employeeId, @Param("startsAt") LocalDateTime startsAt,
                       @Param("endsAt") LocalDateTime endsAt, @Param("cancelled") Status cancelled);
    @Query("select count(s) > 0 from EmployeeShift s where s.employee.employeeId = :employeeId and s.id <> :shiftId and s.status <> :cancelled and s.startsAt < :endsAt and s.endsAt > :startsAt")
    boolean hasOverlapExcluding(@Param("employeeId") String employeeId, @Param("shiftId") Long shiftId,
                                @Param("startsAt") LocalDateTime startsAt, @Param("endsAt") LocalDateTime endsAt,
                                @Param("cancelled") Status cancelled);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from EmployeeShift s where s.id = :id")
    Optional<EmployeeShift> findForUpdate(@Param("id") Long id);
    @Query("select count(s) from EmployeeShift s where s.shiftDate = :date and s.shiftCode = :shiftCode and s.status <> :cancelled and s.employee.enabled = true and (s.employee.employmentStatus = :working or (s.employee.employmentStatus = :onLeave and (s.employee.leaveStart > :date or s.employee.leaveEnd < :date)))")
    long countAvailable(@Param("date") LocalDate date, @Param("shiftCode") String shiftCode,
                        @Param("cancelled") Status cancelled,
                        @Param("working") com.hospitality.mis.entity.identity.Employee.EmploymentStatus working,
                        @Param("onLeave") com.hospitality.mis.entity.identity.Employee.EmploymentStatus onLeave);
    long countByShiftDateAndShiftCodeAndStatusNot(LocalDate date, String shiftCode, Status status);
}

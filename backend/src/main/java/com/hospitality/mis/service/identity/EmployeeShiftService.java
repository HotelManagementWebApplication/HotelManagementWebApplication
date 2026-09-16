package com.hospitality.mis.service.identity;
import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.identity.EmployeeRepository;
import com.hospitality.mis.dao.identity.EmployeeShiftRepository;
import com.hospitality.mis.dto.identity.EmployeeShiftDtos;
import com.hospitality.mis.entity.identity.EmployeeShift;
import com.hospitality.mis.service.governance.AuditService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.Clock;
import java.util.List;
@Service
public class EmployeeShiftService {
    private final EmployeeShiftRepository shifts; private final EmployeeRepository employees; private final AuditService audit; private final Clock clock;
    public EmployeeShiftService(EmployeeShiftRepository shifts, EmployeeRepository employees, AuditService audit, Clock clock) { this.shifts = shifts; this.employees = employees; this.audit = audit; this.clock = clock; }
    @Transactional
    public EmployeeShiftDtos.Response assign(EmployeeShiftDtos.Request request, String actor) {
        if (!request.startsAt().isBefore(request.endsAt())) throw new DomainException("INVALID_SHIFT_INTERVAL", "Giờ bắt đầu phải trước giờ kết thúc");
        if (!request.startsAt().toLocalDate().equals(request.shiftDate()))
            throw new DomainException("INVALID_SHIFT_DATE", "Ngày bắt đầu ca phải khớp shift_date");
        var employee = employees.findForUpdateByEmployeeId(request.employeeId()).orElseThrow(() -> new DomainException("EMPLOYEE_NOT_FOUND", "Không tìm thấy nhân viên"));
        if (shifts.hasOverlap(request.employeeId(), request.startsAt(), request.endsAt(), EmployeeShift.Status.CANCELLED))
            throw new DomainException("SHIFT_OVERLAP", "Nhân viên đã có ca trùng thời gian");
        var shift = new EmployeeShift(); shift.setEmployee(employee); shift.setShiftDate(request.shiftDate()); shift.setShiftCode(request.shiftCode()); shift.setStartsAt(request.startsAt()); shift.setEndsAt(request.endsAt()); shift.setCreatedBy(actor);
        shifts.save(shift); audit.record(actor, "EMPLOYEE_SHIFT_ASSIGNED", "EMPLOYEE_SHIFT", "new", null, request.employeeId(), null); return toResponse(shift);
    }
    @Transactional(readOnly = true)
    public List<EmployeeShiftDtos.Response> list(LocalDate date, String employeeId) {
        LocalDate selected = date == null ? LocalDate.now(clock) : date;
        var data = employeeId == null ? shifts.findByShiftDateOrderByStartsAtAsc(selected) : shifts.findByEmployeeEmployeeIdAndShiftDateOrderByStartsAtAsc(employeeId, selected);
        return data.stream().map(this::toResponse).toList();
    }
    @Transactional(readOnly = true)
    public List<EmployeeShiftDtos.Response> list(LocalDate from, LocalDate to, String employeeId) {
        LocalDate start = from == null ? LocalDate.now(clock) : from;
        LocalDate end = to == null ? start : to;
        if (end.isBefore(start) || end.isAfter(start.plusDays(6)))
            throw new DomainException("INVALID_SHIFT_RANGE", "Khoảng lịch ca phải từ một đến bảy ngày");
        var data = employeeId == null ? shifts.findByShiftDateBetweenOrderByShiftDateAscStartsAtAsc(start, end)
                : shifts.findByEmployeeEmployeeIdAndShiftDateBetweenOrderByShiftDateAscStartsAtAsc(employeeId, start, end);
        return data.stream().map(this::toResponse).toList();
    }
    @Transactional(readOnly = true)
    public EmployeeShiftDtos.CoverageResponse coverage(LocalDate date, String shiftCode, int minimumStaff) {
        if (minimumStaff < 1 || minimumStaff > 100) throw new DomainException("INVALID_MINIMUM_STAFF", "minimum_staff phải từ 1 đến 100");
        LocalDate selected = date == null ? LocalDate.now(clock) : date;
        long assigned = shifts.countAvailable(selected, shiftCode, EmployeeShift.Status.CANCELLED,
                com.hospitality.mis.entity.identity.Employee.EmploymentStatus.WORKING,
                com.hospitality.mis.entity.identity.Employee.EmploymentStatus.ON_LEAVE);
        long shortage = Math.max(0, minimumStaff - assigned);
        return new EmployeeShiftDtos.CoverageResponse(selected, shiftCode, minimumStaff, assigned, shortage, shortage > 0);
    }
    @Transactional
    public EmployeeShiftDtos.Response status(Long id, String rawStatus, String actor) {
        var shift = shifts.findForUpdate(id).orElseThrow(() -> new DomainException("SHIFT_NOT_FOUND", "Không tìm thấy ca làm việc"));
        EmployeeShift.Status next;
        try { next = EmployeeShift.Status.valueOf(rawStatus.trim().toUpperCase()); }
        catch (IllegalArgumentException ex) { throw new DomainException("INVALID_SHIFT_STATUS", "Trạng thái ca không hợp lệ"); }
        boolean allowed = next == shift.getStatus() || switch (shift.getStatus()) {
            case ASSIGNED -> next == EmployeeShift.Status.STARTED || next == EmployeeShift.Status.CANCELLED;
            case STARTED -> next == EmployeeShift.Status.COMPLETED || next == EmployeeShift.Status.CANCELLED;
            case COMPLETED, CANCELLED -> false;
        };
        if (!allowed) throw new DomainException("INVALID_SHIFT_STATUS_TRANSITION", "Chuyển trạng thái ca không hợp lệ");
        shift.setStatus(next);
        audit.record(actor, "EMPLOYEE_SHIFT_STATUS_CHANGED", "EMPLOYEE_SHIFT", String.valueOf(id), null, next.name(), null);
        return toResponse(shifts.save(shift));
    }
    @Transactional
    public EmployeeShiftDtos.Response update(Long id, EmployeeShiftDtos.UpdateRequest request, String actor) {
        if (!request.startsAt().isBefore(request.endsAt()) || !request.startsAt().toLocalDate().equals(request.shiftDate()))
            throw new DomainException("INVALID_SHIFT_INTERVAL", "Khoảng ca hoặc shift_date không hợp lệ");
        var shift = shifts.findForUpdate(id).orElseThrow(() -> new DomainException("SHIFT_NOT_FOUND", "Không tìm thấy ca làm việc"));
        if (shift.getStatus() != EmployeeShift.Status.ASSIGNED)
            throw new DomainException("SHIFT_NOT_EDITABLE", "Chỉ ca ASSIGNED mới được sửa");
        String employeeId = shift.getEmployee().getEmployeeId();
        employees.findForUpdateByEmployeeId(employeeId).orElseThrow(() -> new DomainException("EMPLOYEE_NOT_FOUND", "Không tìm thấy nhân viên"));
        if (shifts.hasOverlapExcluding(employeeId, id, request.startsAt(), request.endsAt(), EmployeeShift.Status.CANCELLED))
            throw new DomainException("SHIFT_OVERLAP", "Nhân viên đã có ca trùng thời gian");
        shift.setShiftDate(request.shiftDate()); shift.setShiftCode(request.shiftCode().trim());
        shift.setStartsAt(request.startsAt()); shift.setEndsAt(request.endsAt());
        audit.record(actor, "EMPLOYEE_SHIFT_UPDATED", "EMPLOYEE_SHIFT", String.valueOf(id), null,
                request.shiftCode(), null);
        return toResponse(shifts.save(shift));
    }
    private EmployeeShiftDtos.Response toResponse(EmployeeShift x) { return new EmployeeShiftDtos.Response(x.getId(), x.getEmployee().getEmployeeId(), x.getShiftDate(), x.getShiftCode(), x.getStartsAt(), x.getEndsAt(), x.getStatus().name(), x.getCreatedBy()); }
}

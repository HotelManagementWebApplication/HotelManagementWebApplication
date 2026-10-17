package com.hospitality.mis.service.operations;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.operations.HousekeepingTaskDatabase;
import com.hospitality.mis.dto.operations.HousekeepingDtos;
import com.hospitality.mis.entity.operations.HousekeepingTaskStatus;
import com.hospitality.mis.entity.identity.Employee;
import com.hospitality.mis.entity.identity.EmployeeRole;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import com.hospitality.mis.service.identity.EmployeeService;
import com.hospitality.mis.service.identity.EmployeeShiftService;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class HousekeepingService {
    private final HousekeepingTaskDatabase database;
    private final EmployeeService employees;
    private final EmployeeShiftService shifts;
    private final Clock clock;
    public HousekeepingService(HousekeepingTaskDatabase database,EmployeeService employees,EmployeeShiftService shifts,Clock clock){this.database=database;this.employees=employees;this.shifts=shifts;this.clock=clock;}
    public HousekeepingDtos.Response create(HousekeepingDtos.CreateRequest request,String actor,String key){
        String bound=authenticatedActor(actor);
        if(!hasAssignmentRole())throw new DomainException("HOUSEKEEPING_ASSIGNMENT_FORBIDDEN","Không có quyền phân công task housekeeping");
        if(request==null||request.roomId()==null||request.roomId().isBlank()||request.assignee()==null||request.assignee().isBlank())
            throw new DomainException("HOUSEKEEPING_ASSIGNEE_REQUIRED","Task phải có nhân viên housekeeping được phân công");
        if(request.shiftCode()!=null||request.shiftDate()!=null)validateShiftAssignment(request);
        return database.create(request,bound,IdempotencySupport.requireKey(key),IdempotencySupport.fingerprint("HOUSEKEEPING_CREATE|"+request),LocalDateTime.now(clock));
    }
    public HousekeepingDtos.Response update(Long id,HousekeepingDtos.UpdateRequest request,String actor,String key){
        String bound=authenticatedActor(actor);
        HousekeepingTaskStatus status=null;
        if(request!=null&&request.status()!=null){try{status=HousekeepingTaskStatus.valueOf(request.status().trim().toUpperCase(Locale.ROOT));}catch(IllegalArgumentException ignored){/* SQL returns the stable domain error after checking task existence. */}}
        if(status==HousekeepingTaskStatus.READY&&!hasManagementRole())
            throw new DomainException("HOUSEKEEPING_ACCEPTANCE_FORBIDDEN","Chỉ quản lý mới được nghiệm thu phòng");
        return database.update(id,request,status,bound,hasManagementRole(),IdempotencySupport.requireKey(key),IdempotencySupport.fingerprint("HOUSEKEEPING_UPDATE|"+id+"|"+request),LocalDateTime.now(clock));
    }
    @Transactional(readOnly=true)
    public List<HousekeepingDtos.Response> list(String room,String assignee,HousekeepingTaskStatus status){return list(room,assignee,status,SecurityActor.currentActor());}
    @Transactional(readOnly=true)
    public List<HousekeepingDtos.Response> list(String room,String assignee,HousekeepingTaskStatus status,String suppliedActor){
        String actor=authenticatedActor(suppliedActor);boolean management=hasManagementRole();
        if(!management&&assignee!=null&&!actor.equals(assignee))throw new DomainException("HOUSEKEEPING_TASK_SCOPE_FORBIDDEN","Không được xem task của nhân viên khác");
        return database.list(room,management?assignee:actor,status);
    }
        @Transactional(readOnly=true)
        public List<HousekeepingDtos.ShiftAssignmentResponse> shiftAssignments(String shiftCode,String suppliedActor){
        authenticatedActor(suppliedActor);
        if(!hasAssignmentRole())throw new DomainException("HOUSEKEEPING_ASSIGNMENT_FORBIDDEN","Không có quyền xem bảng phân công buồng phòng");
        if(shiftCode==null||shiftCode.isBlank())throw new DomainException("HOUSEKEEPING_SHIFT_REQUIRED","Phải chọn buổi làm việc");
        LocalDate today=LocalDate.now(clock);LocalDateTime now=LocalDateTime.now(clock);
        Set<String> employeeIds=new HashSet<>();
        shifts.list(today.minusDays(1),today,null).stream()
            .filter(shift->shift.shiftCode().equalsIgnoreCase(shiftCode.trim()))
            .filter(shift->"ASSIGNED".equals(shift.status())||"STARTED".equals(shift.status()))
            .filter(shift->!shift.startsAt().isAfter(now)&&shift.endsAt().isAfter(now))
            .forEach(shift->employeeIds.add(shift.employeeId()));
        var eligibleEmployees=employees.list(false).stream()
            .filter(employee->employeeIds.contains(employee.employeeId()))
            .filter(employee->employee.role()==EmployeeRole.HOUSEKEEPING&&employee.enabled()
                &&employee.employmentStatus()==Employee.EmploymentStatus.WORKING)
            .toList();
        Set<String> eligibleIds=new HashSet<>();eligibleEmployees.forEach(employee->eligibleIds.add(employee.employeeId()));
        Map<String,List<HousekeepingDtos.AssignedRoom>> roomsByEmployee=new HashMap<>();
        for(var task:database.list(null,null,null)){
            if(task.assignee()!=null&&eligibleIds.contains(task.assignee())&&!HousekeepingTaskStatus.READY.name().equals(task.status()))
            roomsByEmployee.computeIfAbsent(task.assignee(),ignored->new ArrayList<>())
                .add(new HousekeepingDtos.AssignedRoom(task.id(),task.roomId(),task.status()));
        }
        return eligibleEmployees.stream().map(employee->new HousekeepingDtos.ShiftAssignmentResponse(
            employee.employeeId(),employee.fullName(),shiftCode.trim(),roomsByEmployee.getOrDefault(employee.employeeId(),List.of())))
            .toList();
        }
    private boolean hasManagementRole(){
        var authentication=SecurityContextHolder.getContext().getAuthentication();
        return authentication!=null&&authentication.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_ADMIN")||a.getAuthority().equals("ROLE_DIRECTOR")||a.getAuthority().equals("ROLE_MANAGER"));
    }
    private boolean hasAssignmentRole(){return hasManagementRole();}
    private void validateShiftAssignment(HousekeepingDtos.CreateRequest request){
        var today=java.time.LocalDate.now(clock);
        if(request.shiftDate()==null||!request.shiftDate().equals(today)||request.shiftCode()==null||request.shiftCode().isBlank())
            throw new DomainException("HOUSEKEEPING_SHIFT_REQUIRED","Chỉ được phân công theo ca của hôm nay");
        var employee=employees.findRequired(request.assignee().trim());
        if(employee.role()!=EmployeeRole.HOUSEKEEPING||!employee.enabled()||employee.employmentStatus()!=Employee.EmploymentStatus.WORKING)
            throw new DomainException("HOUSEKEEPING_ASSIGNEE_INVALID","Chỉ nhân viên buồng phòng đang làm việc mới được nhận task");
        var now=LocalDateTime.now(clock);
        boolean scheduled=shifts.list(today.minusDays(1),today,employee.employeeId()).stream().anyMatch(shift->
                shift.shiftCode().equalsIgnoreCase(request.shiftCode().trim())
                        &&("ASSIGNED".equals(shift.status())||"STARTED".equals(shift.status()))
                &&!shift.startsAt().isAfter(now)
                        &&shift.endsAt().isAfter(now));
        if(!scheduled)throw new DomainException("HOUSEKEEPING_SHIFT_MISMATCH","Nhân viên không có ca đang được phân công cho buổi đã chọn");
    }
    private String authenticatedActor(String actor){
        try{return SecurityActor.requireBoundActor(actor);}
        catch(AuthenticationCredentialsNotFoundException e){throw new DomainException("ACTOR_REQUIRED","Thiếu actor đã xác thực");}
        catch(AccessDeniedException e){throw new DomainException("ACTOR_MISMATCH","Actor không khớp principal hiện tại");}
    }
}

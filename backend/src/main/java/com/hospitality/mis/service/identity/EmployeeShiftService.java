package com.hospitality.mis.service.identity;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.identity.EmployeeShiftDatabase;
import com.hospitality.mis.dto.identity.EmployeeShiftDtos;
import com.hospitality.mis.entity.identity.EmployeeShift;
import com.hospitality.mis.middleware.security.SecurityActor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.Clock;
import java.util.List;
import java.util.Locale;

/** API validation and authorization; SQL Server owns locking, transitions and audit. */
@Service
public class EmployeeShiftService {
    private final EmployeeShiftDatabase shifts;
    private final Clock clock;
    public EmployeeShiftService(EmployeeShiftDatabase shifts,Clock clock){this.shifts=shifts;this.clock=clock;}

    public EmployeeShiftDtos.Response assign(EmployeeShiftDtos.Request request,String actor){
        String principal=requireEmployeeActor(actor);
        String code=normalizeShiftCode(request.shiftCode());
        if(!request.startsAt().isBefore(request.endsAt())) throw new DomainException("INVALID_SHIFT_INTERVAL","Giờ bắt đầu phải trước giờ kết thúc");
        if(!request.startsAt().toLocalDate().equals(request.shiftDate())) throw new DomainException("INVALID_SHIFT_DATE","Ngày bắt đầu ca phải khớp shift_date");
        return shifts.assign(new EmployeeShiftDtos.Request(request.employeeId(),request.shiftDate(),code,request.startsAt(),request.endsAt()),principal);
    }
    @Transactional(readOnly=true)
    public List<EmployeeShiftDtos.Response> list(LocalDate date,String employeeId){
        LocalDate selected=date==null?LocalDate.now(clock):date;
        return shifts.list(selected,selected,employeeId);
    }
    @Transactional(readOnly=true)
    public List<EmployeeShiftDtos.Response> list(LocalDate from,LocalDate to,String employeeId){
        LocalDate start=from==null?LocalDate.now(clock):from;
        LocalDate end=to==null?start:to;
        if(end.isBefore(start)||end.isAfter(start.plusDays(6))) throw new DomainException("INVALID_SHIFT_RANGE","Khoảng lịch ca phải từ một đến bảy ngày");
        return shifts.list(start,end,employeeId);
    }
    @Transactional(readOnly=true)
    public EmployeeShiftDtos.CoverageResponse coverage(LocalDate date,String shiftCode,int minimumStaff){
        if(minimumStaff<1||minimumStaff>100)throw new DomainException("INVALID_MINIMUM_STAFF","minimum_staff phải từ 1 đến 100");
        String code=normalizeShiftCode(shiftCode);
        LocalDate selected=date==null?LocalDate.now(clock):date;
        long assigned=shifts.coverage(selected,code),shortage=Math.max(0,minimumStaff-assigned);
        return new EmployeeShiftDtos.CoverageResponse(selected,code,minimumStaff,assigned,shortage,shortage>0);
    }
    public EmployeeShiftDtos.Response status(Long id,String rawStatus,String actor){
        String principal=requireEmployeeActor(actor);
        EmployeeShift.Status next;
        try{next=EmployeeShift.Status.valueOf(rawStatus.trim().toUpperCase(Locale.ROOT));}
        catch(IllegalArgumentException ex){throw new DomainException("INVALID_SHIFT_STATUS","Trạng thái ca không hợp lệ");}
        return shifts.status(id,next,principal);
    }
    public EmployeeShiftDtos.Response update(Long id,EmployeeShiftDtos.UpdateRequest request,String actor){
        String principal=requireEmployeeActor(actor),code=normalizeShiftCode(request.shiftCode());
        if(!request.startsAt().isBefore(request.endsAt())||!request.startsAt().toLocalDate().equals(request.shiftDate())) throw new DomainException("INVALID_SHIFT_INTERVAL","Khoảng ca hoặc shift_date không hợp lệ");
        return shifts.update(id,new EmployeeShiftDtos.UpdateRequest(request.shiftDate(),code,request.startsAt(),request.endsAt()),principal);
    }
    private String requireEmployeeActor(String actor){
        if(!SecurityActor.currentPrincipal().isEmployee())throw new org.springframework.security.access.AccessDeniedException("Employee principal required");
        return SecurityActor.requireBoundActor(actor);
    }
    private static String normalizeShiftCode(String raw){
        String value=raw==null?"":raw.trim();
        try{new com.hospitality.mis.persistence.VietnameseCodeConverters.ShiftCodeConverter().convertToDatabaseColumn(value);return value;}
        catch(IllegalArgumentException ex){throw new DomainException("INVALID_SHIFT_CODE","Mã ca làm việc không hợp lệ");}
    }
}

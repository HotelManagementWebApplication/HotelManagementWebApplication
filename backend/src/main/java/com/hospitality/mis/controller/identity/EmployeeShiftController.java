package com.hospitality.mis.controller.identity;
import com.hospitality.mis.dto.identity.EmployeeShiftDtos;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.identity.EmployeeShiftService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;
@RestController @RequestMapping("/api/hr/shifts")
public class EmployeeShiftController {
    private final EmployeeShiftService service;
    public EmployeeShiftController(EmployeeShiftService service) { this.service = service; }
    @GetMapping @PreAuthorize("@departmentAccess.allows(authentication, 'SHIFT_READ')")
    public List<EmployeeShiftDtos.Response> list(@RequestParam(name = "date", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                                 @RequestParam(name = "to", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                                 @RequestParam(name = "employeeId", required = false) String employeeId) { return service.list(date, to, employeeId); }
    @GetMapping("/coverage") @PreAuthorize("@departmentAccess.allows(authentication, 'SHIFT_READ')")
    public EmployeeShiftDtos.CoverageResponse coverage(@RequestParam(name = "date", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                                        @RequestParam(name = "shiftCode") String shiftCode,
                                                        @RequestParam(name = "minimum_staff", defaultValue = "1") int minimumStaff) {
        return service.coverage(date, shiftCode, minimumStaff);
    }
    @PostMapping @PreAuthorize("@departmentAccess.allows(authentication, 'SHIFT_WRITE')")
    public EmployeeShiftDtos.Response assign(@Valid @RequestBody EmployeeShiftDtos.Request request) { return service.assign(request, SecurityActor.currentActor()); }
    @PatchMapping("/{id}/status") @PreAuthorize("@departmentAccess.allows(authentication, 'SHIFT_WRITE')")
    public EmployeeShiftDtos.Response status(@PathVariable Long id, @Valid @RequestBody EmployeeShiftDtos.StatusRequest request) {
        return service.status(id, request.status(), SecurityActor.currentActor());
    }
    @PutMapping("/{id}") @PreAuthorize("@departmentAccess.allows(authentication, 'SHIFT_WRITE')")
    public EmployeeShiftDtos.Response update(@PathVariable Long id, @Valid @RequestBody EmployeeShiftDtos.UpdateRequest request) {
        return service.update(id, request, SecurityActor.currentActor());
    }
}

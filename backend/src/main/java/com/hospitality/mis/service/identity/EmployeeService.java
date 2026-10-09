package com.hospitality.mis.service.identity;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.common.validation.PhoneNumberNormalizer;
import com.hospitality.mis.dao.identity.EmployeeDatabase;
import com.hospitality.mis.dao.identity.EmployeeDatabase.Snapshot;
import com.hospitality.mis.dao.auth.RefreshTokenDatabase;
import com.hospitality.mis.dto.auth.*;
import com.hospitality.mis.entity.identity.Employee;
import com.hospitality.mis.entity.identity.EmployeeRole;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.governance.AuditService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.util.*;

/** Account policy on immutable projections; SQL owns persistence and locking. */
@Service
public class EmployeeService {
    private final EmployeeDatabase employees;
    private final PasswordEncoder passwordEncoder;
    private final AuditService audit;
    private final RefreshTokenDatabase refreshTokens;
    private final Clock clock;
    public EmployeeService(EmployeeDatabase employees,PasswordEncoder passwordEncoder,AuditService audit,RefreshTokenDatabase refreshTokens,Clock clock){
        this.employees=employees;this.passwordEncoder=passwordEncoder;this.audit=audit;this.refreshTokens=refreshTokens;this.clock=clock;
    }
    @Transactional
    public Snapshot provision(String id,String name,String password,EmployeeRole role,String phone,String address){
        if(role==null)throw new DomainException("POSITION_REQUIRED","Phải chọn chức vụ nhân viên");
        requireCurrentActorCanManage(role);requirePassword(password);
        if(employees.find(id).isPresent())throw new DomainException("EMPLOYEE_EXISTS","Mã nhân viên đã tồn tại");
        return employees.create(id,name,passwordEncoder.encode(password),role,PhoneNumberNormalizer.normalize(phone),address,null,false,false);
    }
    @Transactional
    public AuthDtos.AutoProvisionResponse provisionAuto(AuthDtos.AutoProvisionRequest request){
        requireCurrentActorCanManage(request.role());
        String prefix=switch(request.role()){case HOUSEKEEPING->"HK";case KITCHEN,ACCOUNTING->"KT";case TECHNICAL->"TC";case HR->"HR";case MANAGER,DIRECTOR,ADMIN->"QL";default->"NV";};
        String password="MAM#"+UUID.randomUUID().toString().replace("-","").substring(0,8);
        var e=employees.create(prefix,request.fullName(),passwordEncoder.encode(password),request.role(),PhoneNumberNormalizer.normalize(request.phone()),request.address(),request.email().trim(),true,true);
        return new AuthDtos.AutoProvisionResponse(e.employeeId(),e.fullName(),e.role(),e.phone(),e.email(),password,true);
    }
    @Transactional
    public void changeOwnPassword(String id,String password){requirePassword(password);lockedRequired(id);write("own-password",id,passwordEncoder.encode(password),null,null,null,null,null);}
    @Transactional(readOnly=true)
    public Snapshot findRequired(String id){return employees.find(id).orElseThrow(()->new DomainException("EMPLOYEE_NOT_FOUND","Không tìm thấy nhân viên"));}
    private Snapshot lockedRequired(String id){return employees.lock(id).orElseThrow(()->new DomainException("EMPLOYEE_NOT_FOUND","Không tìm thấy nhân viên"));}
    @Transactional(readOnly=true)
    public List<EmployeeAdminDtos.Response> list(boolean includeInactive){return employees.list().stream().filter(e->includeInactive||e.enabled()).map(Snapshot::response).toList();}
    @Transactional(readOnly=true)
    public EmployeeAdminDtos.Response detail(String id){return findRequired(id).response();}
    @Transactional
    public EmployeeAdminDtos.Response setEnabled(String id,boolean enabled){
        var old=lockedRequired(id);requireNotSelf(id,"SELF_ACCOUNT_STATUS_CHANGE_FORBIDDEN");requireCurrentActorCanManage(old.role());
        var result=write("enabled",id,null,null,enabled,null,null,null);
        audit.record(SecurityActor.currentActor(),enabled?"EMPLOYEE_ENABLED":"EMPLOYEE_DISABLED","EMPLOYEE",id,String.valueOf(old.enabled()),String.valueOf(enabled),null);
        return result.response();
    }
    @Transactional(readOnly=true)
    public List<EmployeeAdminDtos.SessionResponse> sessions(String id){findRequired(id);return refreshTokens.sessions(id);}
    @Transactional
    public void revokeSession(String id,Long sessionId){
        var e=lockedRequired(id);requireNotSelf(id,"SELF_SESSION_REVOKE_FORBIDDEN");requireCurrentActorCanManage(e.role());
        var token=refreshTokens.find(sessionId).filter(t->id.equals(t.employeeId())).orElseThrow(()->new DomainException("SESSION_NOT_FOUND","Không tìm thấy phiên đăng nhập"));
        refreshTokens.revoke(token,clock.instant());audit.record(SecurityActor.currentActor(),"EMPLOYEE_SESSION_REVOKED","EMPLOYEE_SESSION",String.valueOf(sessionId),null,id,null);
    }
    @Transactional
    public EmployeeAdminDtos.Response setEmployment(String id,EmployeeAdminDtos.EmploymentRequest request){
        var e=lockedRequired(id);
        if(request.status()==Employee.EmploymentStatus.TERMINATED)requireNotSelf(id,"SELF_ACCOUNT_STATUS_CHANGE_FORBIDDEN");
        requireCurrentActorCanManage(e.role());
        if(request.status()==Employee.EmploymentStatus.ON_LEAVE){
            if(request.leaveStart()==null||request.leaveEnd()==null||request.leaveEnd().isBefore(request.leaveStart()))throw new DomainException("INVALID_LEAVE_PERIOD","Nghỉ phép phải có khoảng ngày hợp lệ");
        }else if(request.leaveStart()!=null||request.leaveEnd()!=null)throw new DomainException("INVALID_LEAVE_PERIOD","Chỉ trạng thái ON_LEAVE được khai báo ngày nghỉ");
        var result=write("employment",id,null,null,null,request.status(),request.leaveStart(),request.leaveEnd());
        audit.record(SecurityActor.currentActor(),"EMPLOYEE_EMPLOYMENT_CHANGED","EMPLOYEE",id,e.employmentStatus().name(),request.status().name(),null);return result.response();
    }
    @Transactional(readOnly=true)
    public EmployeeAdminDtos.LoginHistoryResponse loginHistory(String id,int page,int size){findRequired(id);return employees.loginHistory(id,Math.max(0,page),Math.max(1,Math.min(100,size)));}
    @Transactional
    public Snapshot resetPassword(String id,String password){
        var e=lockedRequired(id);requireCurrentActorCanManage(e.role());requirePassword(password);return write("password",id,passwordEncoder.encode(password),null,null,null,null,null);
    }
    @Transactional
    public void recordLoginFailure(String id){
        employees.lock(id).ifPresent(e->{var result=write("failure",id,null,null,null,null,null,null);audit.record(id,"LOGIN_FAILED","EMPLOYEE",id,null,String.valueOf(result.failedLoginAttempts()),"Invalid credentials");});
    }
    @Transactional
    public void recordLoginSuccess(String id){
        employees.lock(id).ifPresent(e->{write("success",id,null,null,null,null,null,null);audit.record(id,"LOGIN_SUCCEEDED","EMPLOYEE",id,null,null,null);});
    }
    private Snapshot write(String command,String id,String password,EmployeeRole role,Boolean flag,Employee.EmploymentStatus status,java.time.LocalDate start,java.time.LocalDate end){
        return employees.write(command,id,password,role,flag,status,start,end,clock.instant());
    }
    private void requirePassword(String password){if(password==null||password.isBlank()||password.length()<8||password.length()>72)throw new DomainException("PASSWORD_REQUIRED","Phải cung cấp mật khẩu mới");}
    public boolean canManageRole(Authentication auth,EmployeeRole target){var role=roleOf(auth);return role!=null&&role.canManage(target);}
    public boolean canResetEmployee(Authentication auth,String id){return employees.find(id).map(e->canManageRole(auth,e.role())).orElse(false);}
    public boolean canManageEmployeeRole(Authentication auth,String id,EmployeeRole role){return employees.find(id).map(e->!isCurrentActor(id)&&canManageRole(auth,e.role())&&canManageRole(auth,role)).orElse(false);}
    @Transactional
    public EmployeeAdminDtos.Response setRole(String id,EmployeeRole role){
        var e=lockedRequired(id);requireNotSelf(id,"SELF_ROLE_CHANGE_FORBIDDEN");requireCurrentActorCanManage(e.role());requireCurrentActorCanManage(role);
        var result=write("role",id,null,role,null,null,null,null);audit.record(SecurityActor.currentActor(),"EMPLOYEE_ROLE_CHANGED","EMPLOYEE",id,e.role().name(),role.name(),null);return result.response();
    }
    private void requireNotSelf(String id,String code){if(isCurrentActor(id))throw new DomainException(code,"Không được tự thay đổi tài khoản của chính mình");}
    private boolean isCurrentActor(String id){var auth=SecurityContextHolder.getContext().getAuthentication();return auth!=null&&auth.isAuthenticated()&&id!=null&&id.equals(auth.getName());}
    private void requireCurrentActorCanManage(EmployeeRole role){if(!canManageRole(SecurityContextHolder.getContext().getAuthentication(),role))throw new DomainException("ACCESS_DENIED","Không được quản lý chức vụ nhân viên này");SecurityActor.currentPrincipal();}
    private EmployeeRole roleOf(Authentication auth){
        if(auth==null||!auth.isAuthenticated())return null;
        return auth.getAuthorities().stream().map(a->a.getAuthority()).filter(a->a.startsWith("ROLE_")).map(a->{try{return EmployeeRole.valueOf(a.substring(5));}catch(IllegalArgumentException error){return null;}}).filter(Objects::nonNull).findFirst().orElse(null);
    }
}

package com.hospitality.mis.service.identity;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.common.validation.PhoneNumberNormalizer;
import com.hospitality.mis.dao.identity.PersonnelDatabase;
import com.hospitality.mis.dto.auth.AuthDtos;
import com.hospitality.mis.dto.identity.PersonnelDtos.*;
import com.hospitality.mis.entity.identity.EmployeeRole;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.governance.AuditService;
import com.hospitality.mis.service.governance.DurableIdempotencyService;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.util.*;

@Service
public class PersonnelService {
    private final PersonnelDatabase db;
    private final EmployeeService employees;
    private final DurableIdempotencyService durable;
    private final AuditService audit;
    private final Clock clock;
    public PersonnelService(PersonnelDatabase db,EmployeeService employees,DurableIdempotencyService durable,AuditService audit,Clock clock){this.db=db;this.employees=employees;this.durable=durable;this.audit=audit;this.clock=clock;}
    @Transactional(readOnly=true) public List<Profile> profiles(){requireReader();return db.profiles();}
    @Transactional(readOnly=true) public Profile profile(String id){requireReader();return db.profile(id).orElseThrow(()->error("PERSONNEL_NOT_FOUND","Không tìm thấy nhân viên"));}
    @Transactional public Profile updateProfile(String id,ProfileUpdate request,String key){
        requireHr();String actor=SecurityActor.currentActor();Details details=normalized(request.details(),false);
        if(details.phone()==null)throw error("PHONE_REQUIRED","Số điện thoại là bắt buộc");
        return durable.executeWithReplay("personnel-update",key,actor,hash(id,request),()->{
            Profile before=profile(id);Profile after=db.update(id,details,request.version(),actor,clock.instant());
            audit.record(actor,"PERSONNEL_PROFILE_UPDATED","EMPLOYEE",id,"version="+before.version(),"version="+after.version(),request.reason().trim());return after;
        },()->profile(id));
    }
    @Transactional(readOnly=true) public List<Onboarding> requests(){requireReader();return db.requests().stream().filter(this::visible).map(this::permissions).toList();}
    @Transactional public Onboarding save(UUID id,Draft request,String key){
        requireHr();String actor=SecurityActor.currentActor();var details=normalized(request.details(),false);
        var draft=new Draft(details,request.proposedRole(),request.reason().trim(),request.version());
        return durable.executeWithReplay("onboarding-save",key,actor,hash(id.toString(),draft),()->{
            var result=db.command("save",id.toString(),draft,request.version(),actor,null,null,clock.instant());
            audit.record(actor,"ONBOARDING_DRAFT_SAVED","ONBOARDING",id.toString(),null,auditSummary(result),draft.reason());return permissions(result);
        },()->permissions(required(id.toString(),false)));
    }
    @Transactional public Onboarding submit(UUID id,Submit request,String key){
        requireHr();String actor=SecurityActor.currentActor();
        return durable.executeWithReplay("onboarding-submit",key,actor,hash(id.toString(),request),()->{
            var before=required(id.toString(),true);normalized(before.details(),true);
            var result=db.command("submit",id.toString(),null,request.version(),actor,null,null,clock.instant());
            audit.record(actor,"ONBOARDING_SUBMITTED","ONBOARDING",id.toString(),null,auditSummary(result),result.reason());return permissions(result);
        },()->permissions(required(id.toString(),false)));
    }
    @Transactional public ReviewResult review(UUID id,Review request,String key){
        requireReviewer();String actor=SecurityActor.currentActor();
        return durable.executeWithReplay("onboarding-review",key,actor,hash(id.toString(),request),()->{
            var before=required(id.toString(),true);
            if(before.requester().equals(actor))throw error("SELF_APPROVAL_FORBIDDEN","Không được tự duyệt đề nghị của mình");
            if(!canReviewRole(before.proposedRole()))throw new AccessDeniedException("Vai trò đề xuất cần Giám đốc xét duyệt");
            if(before.status()!=Status.PENDING)throw error("INVALID_PERSONNEL_STATE","Đề nghị không còn chờ duyệt");
            if(before.version()!=request.version())throw error("PERSONNEL_VERSION_CONFLICT","Hồ sơ vừa thay đổi. Hãy tải lại trước khi duyệt");
            String employeeId=null,password=null;
            if(request.decision()==Decision.APPROVE){
                Details details=normalized(before.details(),true);
                var created=employees.provisionAuto(new AuthDtos.AutoProvisionRequest(details.fullName(),before.proposedRole(),details.phone(),details.email(),details.address()));
                employeeId=created.employeeId();password=created.temporaryPassword();
                db.initialize(employeeId,details,actor,clock.instant());
            }
            String command=switch(request.decision()){case APPROVE->"approve";case REQUEST_REVISION->"revise";case REJECT->"reject";};
            var result=db.command(command,id.toString(),null,request.version(),actor,request.reason().trim(),employeeId,clock.instant());
            audit.record(actor,"ONBOARDING_"+request.decision().name(),"ONBOARDING",id.toString(),auditSummary(before),auditSummary(result),request.reason().trim());
            return new ReviewResult(permissions(result),password);
        },()->new ReviewResult(permissions(required(id.toString(),false)),null));
    }
    private Onboarding required(String id,boolean lock){return db.request(id,lock).orElseThrow(()->error("PERSONNEL_NOT_FOUND","Không tìm thấy đề nghị tiếp nhận"));}
    private boolean visible(Onboarding request){return role()==EmployeeRole.HR||role()==EmployeeRole.DIRECTOR||role()==EmployeeRole.ADMIN||canReviewRole(request.proposedRole());}
    private Onboarding permissions(Onboarding item){
        String actor=SecurityActor.currentActor();boolean editable=role()==EmployeeRole.HR&&actor.equals(item.requester())&&Set.of(Status.DRAFT,Status.NEEDS_REVISION,Status.REJECTED).contains(item.status());
        return new Onboarding(item.id(),item.details(),item.proposedRole(),item.reason(),item.status(),item.requester(),item.reviewer(),item.decisionReason(),item.employeeId(),item.version(),item.createdAt(),item.submittedAt(),item.decidedAt(),editable,item.status()==Status.PENDING&&!actor.equals(item.requester())&&canReviewRole(item.proposedRole()));
    }
    private boolean canReviewRole(EmployeeRole proposed){var actor=role();return (actor==EmployeeRole.MANAGER||actor==EmployeeRole.DIRECTOR)&&actor.canManage(proposed);}
    private void requireReader(){if(!Set.of(EmployeeRole.HR,EmployeeRole.MANAGER,EmployeeRole.DIRECTOR,EmployeeRole.ADMIN).contains(role()))throw new AccessDeniedException("Không có quyền đọc hồ sơ nhân sự");}
    private void requireHr(){if(role()!=EmployeeRole.HR)throw new AccessDeniedException("HR phụ trách cập nhật hồ sơ và lập đề nghị");}
    private void requireReviewer(){if(role()!=EmployeeRole.MANAGER&&role()!=EmployeeRole.DIRECTOR)throw new AccessDeniedException("Quản lý hoặc Giám đốc xét duyệt đề nghị");}
    private EmployeeRole role(){SecurityActor.currentPrincipal();return SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream().map(a->a.getAuthority()).filter(a->a.startsWith("ROLE_")).map(a->EmployeeRole.valueOf(a.substring(5))).findFirst().orElseThrow(()->new AccessDeniedException("Employee required"));}
    private Details normalized(Details value,boolean complete){
        if(value.fullName()==null||value.fullName().trim().length()<2||value.fullName().trim().length()>100)throw error("INVALID_PERSONNEL_PROFILE","Họ tên phải có từ 2 đến 100 ký tự");
        String phone=blank(value.phone())?null:PhoneNumberNormalizer.normalize(value.phone());
        if(phone!=null&&phone.length()>15)throw error("PHONE_INVALID","Số điện thoại không được vượt quá 15 ký tự sau chuẩn hóa");
        if(complete&&(phone==null||blank(value.email())||value.gender()==null||value.birthDate()==null||blank(value.identityNumber())||value.hireDate()==null||value.contractType()==null))
            throw error("INCOMPLETE_PERSONNEL_PROFILE","Cần đủ điện thoại, email, giới tính, ngày sinh, giấy tờ, ngày vào làm và loại hợp đồng trước khi gửi duyệt");
        if(value.birthDate()!=null&&value.hireDate()!=null&&!value.hireDate().isAfter(value.birthDate()))throw error("INVALID_PERSONNEL_PROFILE","Ngày vào làm phải sau ngày sinh");
        return new Details(value.fullName().trim(),phone,trim(value.email()),trim(value.address()),value.gender(),value.birthDate(),trim(value.identityNumber()),value.hireDate(),value.contractType());
    }
    private String hash(String id,Object request){return IdempotencySupport.fingerprint(id+"|"+db.json(request));}
    private String auditSummary(Onboarding item){return "status="+item.status()+";version="+item.version()+";role="+item.proposedRole()+";employee="+item.employeeId();}
    private static boolean blank(String value){return value==null||value.isBlank();}
    private static String trim(String value){return blank(value)?null:value.trim();}
    private static DomainException error(String code,String message){return new DomainException(code,message);}
}

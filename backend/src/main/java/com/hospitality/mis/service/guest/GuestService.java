package com.hospitality.mis.service.guest;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.common.validation.PhoneNumberNormalizer;
import com.hospitality.mis.dao.guest.GuestDatabase;
import com.hospitality.mis.dto.guest.GuestDtos;
import com.hospitality.mis.service.governance.AuditService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class GuestService {
    private final GuestDatabase guests;
    private final AuditService audit;
    public GuestService(GuestDatabase guests,AuditService audit){this.guests=guests;this.audit=audit;}
    @Transactional
    public GuestDtos.Response create(GuestDtos.CreateRequest request,String actor){
        String identity=required(request.identityNumber(),"identityNumber"),phone=PhoneNumberNormalizer.normalize(request.phone());
        guests.lockRegistration();
        if(guests.phoneExists(phone))throw new DomainException("GUEST_PHONE_EXISTS","Số điện thoại khách hàng đã tồn tại");
        if(guests.identityExists(identity))throw new DomainException("GUEST_IDENTITY_EXISTS","Số giấy tờ khách hàng đã tồn tại");
        var saved=guests.create(new GuestDtos.CreateRequest(required(request.fullName(),"fullName"),request.birthYear(),identity,phone,optional(request.email()),optional(request.address())));
        audit.record(actor,"GUEST_CREATED","GUEST",saved.id().toString(),null,saved.fullName(),null);return saved;
    }
    @Transactional(readOnly=true)
    public GuestDtos.Response get(Long id){return guests.find(id).map(GuestDatabase.Snapshot::response).orElseThrow(()->new DomainException("GUEST_NOT_FOUND","Không tìm thấy khách hàng: "+id));}
    @Transactional(readOnly=true)
    public List<GuestDtos.Response> search(String query){return guests.search(query);}
    private static String required(String value,String field){if(value==null||value.isBlank())throw new DomainException(field.toUpperCase()+"_REQUIRED","Trường "+field+" là bắt buộc");return value.trim();}
    private static String optional(String value){return value==null||value.isBlank()?null:value.trim();}
}

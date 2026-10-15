package com.hospitality.mis.service.billing;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.billing.ServiceScheduleDatabase;
import com.hospitality.mis.dto.billing.ServiceScheduleDtos;
import com.hospitality.mis.middleware.security.SecurityActor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ServiceScheduleService {
    private final ServiceScheduleDatabase database;
    public ServiceScheduleService(ServiceScheduleDatabase database) { this.database=database; }
    @Transactional(readOnly=true)
    public ServiceScheduleDtos.Response get(String id) { return encode(database.get(id)); }
    public ServiceScheduleDtos.Response save(String id,ServiceScheduleDtos.Request request) {
        String mode=switch(request.mode()) {
            case "DURATION" -> "Theo thời lượng"; case "UNITS" -> "Theo lượt";
            case "STAY" -> "Theo kỳ lưu trú"; case "DAILY" -> "Theo ngày";
            case "OVERNIGHT" -> "Qua đêm"; case "STOCK" -> "Theo tồn kho";
            default -> throw new DomainException("INVALID_SCHEDULE_MODE","Cách tính khả dụng không hợp lệ");
        };
        if(request.mode().equals("STOCK")&&!request.consumesStock())
            throw new DomainException("INVALID_SCHEDULE_MODE","Khả dụng theo tồn kho phải bật trừ tồn khi sử dụng");
        return encode(database.save(id,request,mode,SecurityActor.currentActor()));
    }
    private ServiceScheduleDtos.Response encode(ServiceScheduleDtos.Response row) {
        String mode=row.mode()==null ? null : switch(row.mode()) {
            case "Theo thời lượng" -> "DURATION"; case "Theo kỳ lưu trú" -> "STAY";
            case "Theo ngày" -> "DAILY"; case "Qua đêm" -> "OVERNIGHT";
            case "Theo tồn kho" -> "STOCK"; default -> "UNITS";
        };
        return new ServiceScheduleDtos.Response(row.serviceId(),row.capacity(),row.unit(),row.minutesPerUnit(),mode,row.consumesStock());
    }
}

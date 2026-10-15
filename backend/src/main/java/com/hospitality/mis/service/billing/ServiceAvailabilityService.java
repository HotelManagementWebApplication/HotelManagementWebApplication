package com.hospitality.mis.service.billing;
import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.billing.ServiceAvailabilityDatabase;
import com.hospitality.mis.dto.billing.ServiceAvailabilityDtos;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;
@Service
public class ServiceAvailabilityService {
    private final ServiceAvailabilityDatabase database;
    public ServiceAvailabilityService(ServiceAvailabilityDatabase database){this.database=database;}
    @Transactional(readOnly=true)
    public List<ServiceAvailabilityDtos.Response> list(LocalDateTime from,LocalDateTime to){
        if(from==null||to==null||!from.isBefore(to)||to.isAfter(from.plusDays(31)))
            throw new DomainException("INVALID_AVAILABILITY_WINDOW","Chọn thời gian kết thúc sau thời gian bắt đầu, tối đa 31 ngày.");
        return database.list(from,to);
    }
}

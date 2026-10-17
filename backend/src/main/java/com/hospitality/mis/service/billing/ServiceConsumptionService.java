package com.hospitality.mis.service.billing;
import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.billing.ServiceConsumptionDatabase;
import com.hospitality.mis.dto.billing.ServiceConsumptionDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.List;
@Service
public class ServiceConsumptionService {
    private final ServiceConsumptionDatabase database;
    public ServiceConsumptionService(ServiceConsumptionDatabase database) { this.database=database; }
    @Transactional(readOnly=true)
    public List<ServiceConsumptionDto> list(LocalDate from,LocalDate to) {
        if(from==null||to==null||from.isAfter(to)||to.isAfter(from.plusDays(30)))
            throw new DomainException("INVALID_DATE_RANGE","Chọn khoảng báo cáo tối đa 31 ngày");
        return database.list(from,to);
    }
}

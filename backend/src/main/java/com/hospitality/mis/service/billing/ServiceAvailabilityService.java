package com.hospitality.mis.service.billing;
import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.billing.ServiceAvailabilityDatabase;
import com.hospitality.mis.dto.billing.ServiceAvailabilityDtos.*;
import com.hospitality.mis.middleware.security.SecurityActor;
import org.springframework.stereotype.Service;import java.time.*;import java.util.List;
@Service public class ServiceAvailabilityService {
 private final ServiceAvailabilityDatabase database;private final Clock clock;
 public ServiceAvailabilityService(ServiceAvailabilityDatabase database,Clock clock){this.database=database;this.clock=clock;}
 public List<Response> list(LocalDateTime from,LocalDateTime to){
  if(from==null)from=LocalDateTime.now(clock);if(to==null)to=from.plusMinutes(1);
  if(!from.isBefore(to)||Duration.between(from,to).toDays()>31)throw new DomainException("INVALID_INTERVAL","Khoảng giờ không hợp lệ");
  return database.list(from,to);
 }
 public void configure(String id,CapacityRequest request){database.configure(id,request,SecurityActor.currentActor());}
}

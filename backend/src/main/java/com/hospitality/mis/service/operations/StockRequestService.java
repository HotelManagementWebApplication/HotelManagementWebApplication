package com.hospitality.mis.service.operations;

import com.hospitality.mis.dao.operations.StockRequestDatabase;
import com.hospitality.mis.dto.operations.StockRequestDtos;
import com.hospitality.mis.dto.billing.ServiceDtos;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

@Service
public class StockRequestService {
    private final StockRequestDatabase database;
    private final Clock clock;
    public StockRequestService(StockRequestDatabase database,Clock clock){this.database=database;this.clock=clock;}
    @Transactional(readOnly=true)
    public List<StockRequestDtos.Response> list(){
        String actor=SecurityActor.currentActor();
        boolean warehouse=SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_KITCHEN"));
        return database.list(warehouse?null:actor);
    }
    @Transactional(readOnly=true)
    public List<ServiceDtos.Response> catalog(){return database.housekeepingStock();}
    @Transactional
    public StockRequestDtos.Response create(StockRequestDtos.CreateRequest request,String key){
        String room=request.roomId()==null||request.roomId().isBlank()?null:request.roomId().trim();
        return database.command("create",null,request.serviceId().trim(),request.quantity(),room,SecurityActor.currentActor(),request.reason().trim(),IdempotencySupport.requireKey(key),LocalDateTime.now(clock),switch(request.kind()){case "ISSUE"->"Cấp hàng";case "RETURN"->"Trả hàng";case "DAMAGE"->"Báo hỏng";default->throw new IllegalArgumentException("Invalid request kind");});
    }
    @Transactional
    public StockRequestDtos.Response decide(long id,boolean approve,String reason){
        return database.command(approve?"approve":"reject",id,null,null,null,SecurityActor.currentActor(),reason==null?null:reason.trim(),null,LocalDateTime.now(clock),null);
    }
}

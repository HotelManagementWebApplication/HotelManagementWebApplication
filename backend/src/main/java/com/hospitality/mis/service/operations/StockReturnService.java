package com.hospitality.mis.service.operations;

import com.hospitality.mis.dao.operations.StockReturnDatabase;
import com.hospitality.mis.dao.billing.ServiceCatalogDatabase;
import com.hospitality.mis.dto.operations.StockReturnDtos;
import com.hospitality.mis.dto.billing.ServiceDtos;
import com.hospitality.mis.middleware.security.SecurityActor;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

@Service
public class StockReturnService {
    private final StockReturnDatabase database;
    private final ServiceCatalogDatabase catalog;
    private final Clock clock;
    public StockReturnService(StockReturnDatabase database,ServiceCatalogDatabase catalog,Clock clock){this.database=database;this.catalog=catalog;this.clock=clock;}
    @Transactional(readOnly=true)
    public List<StockReturnDtos.Response> list(){
        String actor=SecurityActor.currentActor();
        boolean warehouse=SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_KITCHEN"));
        return database.list(warehouse?null:actor);
    }
    @Transactional(readOnly=true)
    public List<ServiceDtos.Response> catalog(){return catalog.all().stream().filter(item->Set.of("food","beverage","room-amenity").contains(item.category())).toList();}
    @Transactional
    public StockReturnDtos.Response create(StockReturnDtos.CreateRequest request,String key){
        String room=request.roomId()==null||request.roomId().isBlank()?null:request.roomId().trim();
        return database.command("create",null,request.serviceId().trim(),request.quantity(),room,SecurityActor.currentActor(),request.reason().trim(),IdempotencySupport.requireKey(key),LocalDateTime.now(clock));
    }
    @Transactional
    public StockReturnDtos.Response decide(long id,boolean approve,String reason){
        return database.command(approve?"approve":"reject",id,null,null,null,SecurityActor.currentActor(),reason==null?null:reason.trim(),null,LocalDateTime.now(clock));
    }
}

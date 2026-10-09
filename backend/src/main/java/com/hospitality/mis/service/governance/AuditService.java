package com.hospitality.mis.service.governance;

import com.hospitality.mis.dao.governance.AuditDatabase;
import com.hospitality.mis.dto.governance.AuditDtos;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.data.domain.Page;
import java.time.*;
import java.util.List;

/** Audit commands join the owner transaction; reads use immutable SQL projections. */
@Service
public class AuditService {
    private final AuditDatabase database;
    private final Clock clock;
    public AuditService(AuditDatabase database,Clock clock){this.database=database;this.clock=clock;}
    @Transactional(propagation=Propagation.MANDATORY)
    public void record(String actor,String action,String type,String id,String before,String after,String reason){record(actor,action,type,id,before,after,reason,null);}
    @Transactional(propagation=Propagation.MANDATORY)
    public void record(String actor,String action,String type,String id,String before,String after,String reason,String correlation){
        database.append(actor==null||actor.isBlank()?"SYSTEM":actor,action,type,id,before,after,reason,correlation,Instant.now(clock));
    }
    @Transactional(readOnly=true)
    public List<AuditDtos.Response> list(String actor,boolean global){return database.list(global?null:actor);}
    @Transactional(readOnly=true)
    public List<AuditDtos.Response> timeline(String type,String id){return database.timeline(type,id);}
    @Transactional(readOnly=true)
    public Page<AuditDtos.Response> page(String actor,boolean global,String action,String type,int page,int size){return page(actor,global,action,type,null,null,null,null,page,size);}
    @Transactional(readOnly=true)
    public Page<AuditDtos.Response> page(String actor,boolean global,String action,String type,String id,String correlation,Instant from,Instant to,int page,int size){
        return database.page(global?null:actor,action,type,id,correlation,from,to,Math.max(0,page),Math.max(1,Math.min(100,size)));
    }
}

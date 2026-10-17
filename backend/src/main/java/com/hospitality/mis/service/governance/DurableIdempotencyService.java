package com.hospitality.mis.service.governance;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.governance.IdempotencyDatabase;
import com.hospitality.mis.service.reservation.IdempotencySupport;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.time.*;
import java.util.Objects;
import java.util.function.Supplier;

/** Database claim and completion share the business transaction and its connection. */
@Service
public class DurableIdempotencyService {
    private final IdempotencyDatabase database;
    private final ObjectMapper mapper;
    private final Clock clock;
    public DurableIdempotencyService(IdempotencyDatabase database,ObjectMapper mapper,Clock clock){this.database=database;this.mapper=mapper;this.clock=clock;}
    @Transactional(propagation=Propagation.MANDATORY)
    public <T> T execute(String scope,String key,String actor,String hash,Class<T> type,Supplier<T> command){
        String normalized=IdempotencySupport.requireKey(key);validate(scope,actor,hash,type,command);
        var claim=database.claim(scope,normalized,actor,hash,LocalDateTime.now(clock));
        if(!claim.fresh()){
            if(!type.getName().equals(claim.responseType()))throw conflict();
            try{return mapper.readValue(claim.responseJson(),type);}catch(JsonProcessingException error){throw new IllegalStateException("Không thể đọc kết quả idempotency đã lưu",error);}
        }
        T result=command.get();
        try{database.complete(scope,normalized,actor,hash,type.getName(),mapper.writeValueAsString(result),LocalDateTime.now(clock));}
        catch(JsonProcessingException error){throw new IllegalStateException("Không thể lưu kết quả idempotency",error);}
        return result;
    }
    @Transactional(propagation=Propagation.MANDATORY)
    public <T> T executeWithReplay(String scope,String key,String actor,String hash,Supplier<T> command,Supplier<T> replayLoader){
        String normalized=IdempotencySupport.requireKey(key);validate(scope,actor,hash,Object.class,command);Objects.requireNonNull(replayLoader,"replayLoader");
        var claim=database.claim(scope,normalized,actor,hash,LocalDateTime.now(clock));
        if(!claim.fresh()){
            if(!"DB_REPLAY".equals(claim.responseType()))throw conflict();
            return replayLoader.get();
        }
        T result=command.get();
        database.complete(scope,normalized,actor,hash,"DB_REPLAY","{}",LocalDateTime.now(clock));return result;
    }
    private void validate(String scope,String actor,String hash,Class<?> type,Supplier<?> command){
        if(scope==null||scope.isBlank()||scope.length()>100)throw new DomainException("INVALID_IDEMPOTENCY_SCOPE","Idempotency scope không hợp lệ");
        Objects.requireNonNull(actor,"actor");Objects.requireNonNull(hash,"requestHash");Objects.requireNonNull(type,"responseType");Objects.requireNonNull(command,"command");
    }
    private DomainException conflict(){return new DomainException("IDEMPOTENCY_KEY_CONFLICT","Kiểu kết quả của Idempotency-Key không khớp");}
}

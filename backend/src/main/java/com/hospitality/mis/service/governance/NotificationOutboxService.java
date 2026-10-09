package com.hospitality.mis.service.governance;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.governance.NotificationDatabase;
import com.hospitality.mis.dto.governance.NotificationDtos;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Set;
import java.util.List;
import java.util.Locale;

@Service
public class NotificationOutboxService {
    private final NotificationDatabase database;
    private final Clock clock;
    public NotificationOutboxService(NotificationDatabase database,Clock clock){this.database=database;this.clock=clock;}
    public NotificationDtos.Response enqueue(String topic,String role,String payload,String key){return database.enqueue(topic,role,payload,key,LocalDateTime.now(clock));}
    @Transactional(readOnly=true)
    public List<NotificationDtos.Response> poll(String role){return database.poll(LocalDateTime.now(clock)).stream().filter(x->role==null||role.equals(x.recipientRole())).toList();}
    @Transactional(readOnly=true)
    public List<NotificationDtos.Response> pollForRoles(Set<String> allowedRoles,String requestedRole){
        String role=requestedRole==null||requestedRole.isBlank()?null:requestedRole.trim().toUpperCase(Locale.ROOT);
        if(role!=null&&!allowedRoles.contains(role))throw new DomainException("NOTIFICATION_SCOPE_FORBIDDEN","Không được đọc notification của department khác");
        return database.poll(LocalDateTime.now(clock)).stream().filter(x->allowedRoles.contains(x.recipientRole())).filter(x->role==null||role.equals(x.recipientRole())).toList();
    }
    public NotificationDtos.Response markDelivered(Long id){return database.deliver(id,LocalDateTime.now(clock));}
}

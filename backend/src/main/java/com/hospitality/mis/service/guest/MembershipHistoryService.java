package com.hospitality.mis.service.guest;

import com.hospitality.mis.dao.guest.GuestDatabase;
import com.hospitality.mis.dto.guest.MembershipHistoryDtos;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class MembershipHistoryService {
    private final GuestDatabase guests;
    public MembershipHistoryService(GuestDatabase guests){this.guests=guests;}
    @Transactional(readOnly=true)
    public List<MembershipHistoryDtos.Response> list(Long guestId){return guests.history(guestId);}
}

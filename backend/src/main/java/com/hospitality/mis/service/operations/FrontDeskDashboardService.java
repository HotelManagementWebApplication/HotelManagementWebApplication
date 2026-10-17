package com.hospitality.mis.service.operations;

import com.hospitality.mis.dao.operations.FrontDeskDashboardDatabase;
import com.hospitality.mis.dto.operations.FrontDeskDashboardDtos;
import com.hospitality.mis.entity.reservation.ReservationStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Locale;
import java.util.TreeMap;
import java.util.stream.Collectors;

/** Bounded read-model queries; no reservation/guest/payment aggregate is hydrated. */
@Service
public class FrontDeskDashboardService {
    private final FrontDeskDashboardDatabase database;
    private final Clock clock;
    public FrontDeskDashboardService(FrontDeskDashboardDatabase database,Clock clock){this.database=database;this.clock=clock;}

    @Transactional(readOnly=true)
    public FrontDeskDashboardDtos.Response get(LocalDate date,String query,ReservationStatus status,int page,int size){
        LocalDate day=date==null?LocalDate.now(clock):date;
        int safePage=Math.max(0,page),safeSize=Math.max(1,Math.min(100,size));
        String normalized=query==null?"":query.trim().toLowerCase(Locale.ROOT);
        var from=day.atStartOfDay();var to=day.plusDays(1).atStartOfDay();
        long total=database.count(normalized,status,from,to);
        var rooms=database.rooms();
        var counts=rooms.stream().collect(Collectors.groupingBy(r->r.status().databaseCode(),TreeMap::new,Collectors.counting()));
        return new FrontDeskDashboardDtos.Response(day,
                database.items(normalized,status,"ARRIVALS",from,to,safePage,safeSize),
                database.items(normalized,status,"DEPARTURES",from,to,safePage,safeSize),
                database.items(normalized,status,"CURRENT",from,to,safePage,safeSize),
                database.items(normalized,status,"UPCOMING",from,to,safePage,safeSize),
                database.items(normalized,status,"UNPAID_DEPOSITS",from,to,safePage,safeSize),
                database.items(normalized,status,"INVOICE_BALANCES",from,to,safePage,safeSize),
                rooms,counts,database.incidents(safePage,safeSize),safePage,safeSize,total,(int)Math.ceil((double)total/safeSize));
    }
}

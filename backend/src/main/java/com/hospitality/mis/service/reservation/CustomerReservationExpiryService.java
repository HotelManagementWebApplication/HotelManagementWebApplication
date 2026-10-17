package com.hospitality.mis.service.reservation;

import com.hospitality.mis.dao.reservation.CustomerReservationExpiryDatabase;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;

/** Scheduled entrypoint for the atomic SQL customer-hold expiry batch. */
@Service
public class CustomerReservationExpiryService {
    private final CustomerReservationExpiryDatabase database;
    private final Clock clock;
    public CustomerReservationExpiryService(CustomerReservationExpiryDatabase database,Clock clock){this.database=database;this.clock=clock;}
    @Scheduled(fixedDelayString="${hotel.booking.hold-expiry-scan-ms:60000}")
    @Transactional public void expireHolds(){database.expire(LocalDateTime.now(clock));}
}

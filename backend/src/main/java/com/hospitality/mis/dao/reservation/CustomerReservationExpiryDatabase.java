package com.hospitality.mis.dao.reservation;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;

@Repository
public class CustomerReservationExpiryDatabase {
    private final JdbcTemplate jdbc;
    public CustomerReservationExpiryDatabase(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public void expire(LocalDateTime now){jdbc.update("EXEC dbo.uspHetHanGiuCoc ?",now);}
}

package com.hospitality.mis.entity.room;

import java.time.LocalDateTime;

/** Validates input intervals; SQL fnKiemTraPhongTrong owns actual room availability. */
public final class RoomAvailabilityPolicy {
    public void validateInterval(LocalDateTime from, LocalDateTime to) {
        if (from == null || to == null || !from.isBefore(to))
            throw new IllegalArgumentException("from must be before to");
    }
}

package com.hospitality.mis.entity.reservation;

/** Allocation of a room to a booking, independent of the room's operational readiness. */
public enum ReservationRoomStatus {
    DRAFT, TEMPORARILY_HELD, RESERVED, OCCUPIED, RETURNED, CANCELLED
}

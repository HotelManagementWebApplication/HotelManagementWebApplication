-- Normalize the room-status values written by V1 and enforce one canonical contract.
-- This migration is the only conversion point for already persisted legacy values.

UPDATE rooms
SET status = CASE status
    WHEN 'SAN_SANG' THEN 'available'
    WHEN 'DANG_O' THEN 'occupied'
    WHEN 'DANG_DON_DEP' THEN 'cleaning'
    WHEN 'BAO_TRI' THEN 'maintenance'
    WHEN 'NGUNG_SU_DUNG' THEN 'out_of_service'
    WHEN 'DA_DAT' THEN 'reserved'
    ELSE status
END
WHERE status IN ('SAN_SANG', 'DANG_O', 'DANG_DON_DEP', 'BAO_TRI',
                 'NGUNG_SU_DUNG', 'DA_DAT');

UPDATE reservation_rooms
SET status = CASE status
    WHEN 'SAN_SANG' THEN 'available'
    WHEN 'DANG_O' THEN 'occupied'
    WHEN 'DANG_DON_DEP' THEN 'cleaning'
    WHEN 'BAO_TRI' THEN 'maintenance'
    WHEN 'NGUNG_SU_DUNG' THEN 'out_of_service'
    WHEN 'DA_DAT' THEN 'reserved'
    WHEN 'DA_TRA' THEN 'returned'
    WHEN 'DA_HUY' THEN 'cancelled'
    ELSE status
END
WHERE status IN ('SAN_SANG', 'DANG_O', 'DANG_DON_DEP', 'BAO_TRI',
                 'NGUNG_SU_DUNG', 'DA_DAT', 'DA_TRA', 'DA_HUY');

ALTER TABLE rooms
    MODIFY status VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin
        NOT NULL DEFAULT 'available',
    ADD CONSTRAINT chk_rooms_status_canonical CHECK (
        status IN ('available', 'occupied', 'cleaning', 'maintenance',
                   'out_of_service', 'reserved')
    );

ALTER TABLE reservation_rooms
    MODIFY status VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin
        NOT NULL DEFAULT 'reserved',
    ADD CONSTRAINT chk_reservation_rooms_status_canonical CHECK (
        status IN ('available', 'occupied', 'cleaning', 'maintenance',
                   'out_of_service', 'reserved', 'returned', 'cancelled')
    );

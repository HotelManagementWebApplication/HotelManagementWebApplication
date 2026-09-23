-- Room numbers are the identifiers used by hotel operations.  Earlier demo data
-- kept legacy Rxxx keys after moving rooms to floors 5-20, which made a room
-- such as 502 require the unrelated key R102.  Normalize every reference first,
-- then the room primary key, so API room_id and the visible room number agree.

CREATE TEMPORARY TABLE room_id_normalization (
    old_id VARCHAR(10) NOT NULL PRIMARY KEY,
    new_id VARCHAR(10) NOT NULL UNIQUE
);

INSERT INTO room_id_normalization (old_id, new_id)
SELECT id, TRIM(name)
FROM rooms
WHERE id <> TRIM(name);

SET FOREIGN_KEY_CHECKS = 0;

UPDATE reservation_rooms rr JOIN room_id_normalization m ON m.old_id = rr.room_id
SET rr.room_id = m.new_id;
UPDATE equipment_incidents ei JOIN room_id_normalization m ON m.old_id = ei.room_id
SET ei.room_id = m.new_id;
UPDATE hotel_service_bookings hsb JOIN room_id_normalization m ON m.old_id = hsb.room_id
SET hsb.room_id = m.new_id;
UPDATE housekeeping_tasks ht JOIN room_id_normalization m ON m.old_id = ht.room_id
SET ht.room_id = m.new_id;
UPDATE maintenance_work_orders mw JOIN room_id_normalization m ON m.old_id = mw.room_id
SET mw.room_id = m.new_id;
UPDATE room_equipment re JOIN room_id_normalization m ON m.old_id = re.room_id
SET re.room_id = m.new_id;
UPDATE room_images ri JOIN room_id_normalization m ON m.old_id = ri.room_id
SET ri.room_id = m.new_id;
UPDATE room_transfers rt JOIN room_id_normalization m ON m.old_id = rt.from_room_id
SET rt.from_room_id = m.new_id;
UPDATE room_transfers rt JOIN room_id_normalization m ON m.old_id = rt.to_room_id
SET rt.to_room_id = m.new_id;
UPDATE technical_assets ta JOIN room_id_normalization m ON m.old_id = ta.room_id
SET ta.room_id = m.new_id;
UPDATE technical_work_orders tw JOIN room_id_normalization m ON m.old_id = tw.room_id
SET tw.room_id = m.new_id;

UPDATE rooms r JOIN room_id_normalization m ON m.old_id = r.id
SET r.id = m.new_id;

SET FOREIGN_KEY_CHECKS = 1;

DROP TEMPORARY TABLE room_id_normalization;

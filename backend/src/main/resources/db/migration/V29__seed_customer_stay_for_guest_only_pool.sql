-- Keep one future overnight stay paid for the demo customer so the pool's
-- guest-only policy can be tested end to end from the customer portal.
INSERT IGNORE INTO reservations
    (id, guest_id, employee_id, customer_account_id, booked_at, deposit_amount,
     status, rental_type, actual_check_in, actual_check_out, extension_minutes,
     idempotency_key, version, deposit_payment_code, deposit_payment_expires_at,
     deposit_payment_status, booking_source)
VALUES
    (6, 1, NULL, 1, NOW(), 3900000.00, 'DEPOSIT_PAID', 'PACKAGE', NULL, NULL, 0,
     'DEMO-RES-006', 0, 'DEMO-DEP-006', DATE_ADD(NOW(), INTERVAL 7 DAY),
     'PAID', 'DIRECT');

INSERT IGNORE INTO reservation_rooms
    (reservation_id, room_id, check_in, check_out, original_check_out, status, transfer_count)
VALUES
    (6, 'R1001', TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '14:00:00'),
     TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 4 DAY), '12:00:00'),
     TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 4 DAY), '12:00:00'), 'reserved', 0);

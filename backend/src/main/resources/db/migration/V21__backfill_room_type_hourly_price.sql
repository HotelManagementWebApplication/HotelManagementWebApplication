UPDATE room_types
SET hourly_price = ROUND(daily_price / 24, 2)
WHERE hourly_price = 0;

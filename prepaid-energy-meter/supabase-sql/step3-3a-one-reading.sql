-- STEP 3 / SQL 3a: send ONE new reading, like the ESP32 would (you edit the numbers).
-- RUN IT AGAIN AND AGAIN while the dashboard is open.
-- EVERY RUN needs:  a HIGHER p_seq   and   a slightly HIGHER p_e (cumulative kWh).
-- If p_seq is not higher, the reading is ignored as a duplicate / reboot.
-- The backfill (SQL 2) ends at about 12.09 kWh, so start above that.

select public.process_reading(
  'meter-001',                         -- p_device_id
  362,                                 -- p_seq   <- raise by 1 each run
  extract(epoch from now())::bigint,   -- p_ts    (now, in epoch seconds)
  231.4,                               -- p_v     voltage (V)
  0.82,                                -- p_i     current (A)
  189.7,                               -- p_p     power (W)
  12.200,                              -- p_e     cumulative kWh <- must be higher than the last one; add 0.001 each run
  1,                                   -- p_relay 1 = on
  0                                    -- p_fault 0 = no fault
);

-- STEP 4 / SQL 1 (optional): small helpers for the tests. Run ONE at a time.

-- A) Show where meter-001 stands (use these numbers for your curl tests).
select last_seq, last_energy_kwh, balance, min_balance, relay_state, device_online, last_seen
from public.meters
where device_id = 'meter-001';

-- B) Make the balance very low, to test the automatic cut-off.
-- update public.meters set balance = 0 where device_id = 'meter-001';

-- C) Put money back after the cut-off test (test-only edit, skips the ledger).
-- update public.meters set balance = 500.00 where device_id = 'meter-001';

-- D) The newest commands, to see what the functions created.
-- select id, action, value, status, created_at, acked_at
-- from public.commands order by created_at desc limit 10;

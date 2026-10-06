-- STEP 3 / SQL 3b: send ONE new reading with NO editing between runs.
-- It reads the meter's last seq and energy, adds 1 and 0.001 kWh, and wobbles
-- the voltage and current a little. Run it as often as you like while the
-- dashboard is open. Use this INSTEAD of SQL 3a, not together with it.

select public.process_reading(
  m.device_id,
  coalesce(m.last_seq, 0) + 1,
  extract(epoch from now())::bigint,
  r.v,
  r.i,
  round(r.v * r.i, 1),
  coalesce(m.last_energy_kwh, 0) + 0.001,
  1,
  0
)
from public.meters m
cross join lateral (
  select round((230 + (random() - 0.5) * 4)::numeric, 1) as v,
         round((0.4 + random() * 0.8)::numeric, 2)       as i
) r
where m.device_id = 'meter-001';

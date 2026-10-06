-- STEP 3 / SQL 5 (optional): delete ALL readings of meter-001 and reset its
-- counters, so you can run the backfill again. Test meter only!

delete from public.readings
where meter_id = (select id from public.meters where device_id = 'meter-001');

update public.meters
   set last_seq = 0, last_energy_kwh = 0
 where device_id = 'meter-001';

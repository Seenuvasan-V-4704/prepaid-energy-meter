-- STEP 3 / SQL 2 (a): 30 minutes of fake history for meter-001.
-- One reading every 5 seconds: voltage about 230 V, current 0.4 to 1.2 A,
-- power = voltage x current, energy rising slowly (cumulative kWh).
-- Rows are inserted straight into public.readings (test data only).
-- It also sets the meter's last_seq / last_energy_kwh / last_seen so your
-- next process_reading call continues smoothly from here.
-- It refuses to run if meter-001 already has readings (use SQL 5 first).

do $$
declare
  v_meter_id   uuid;
  v_points     constant integer := 361;  -- 30 minutes at 5-second steps
  v_ts_type    text;
  v_relay_type text;
  v_fault_type text;
  v_ts_expr    text;
  v_relay_expr text;
  v_fault_expr text;
  v_last_seq   bigint;
  v_last_e     numeric;
begin
  select id into v_meter_id from public.meters where device_id = 'meter-001';
  if v_meter_id is null then
    raise exception 'meter-001 was not found in public.meters';
  end if;

  if exists (select 1 from public.readings where meter_id = v_meter_id) then
    raise exception 'meter-001 already has readings. Run SQL 5 (cleanup) first to start again.';
  end if;

  -- Look at your column types so the same script works with any of them.
  select data_type into v_ts_type from information_schema.columns
   where table_schema = 'public' and table_name = 'readings' and column_name = 'ts';
  select data_type into v_relay_type from information_schema.columns
   where table_schema = 'public' and table_name = 'readings' and column_name = 'relay';
  select data_type into v_fault_type from information_schema.columns
   where table_schema = 'public' and table_name = 'readings' and column_name = 'fault';

  v_ts_expr := case when v_ts_type like 'timestamp%' then 'c.t'
                    else 'extract(epoch from c.t)::bigint' end;
  v_relay_expr := case when v_relay_type = 'boolean' then 'true'
                       when v_relay_type in ('text', 'character varying') then '''1'''
                       else '1' end;
  v_fault_expr := case when v_fault_type = 'boolean' then 'false'
                       when v_fault_type in ('text', 'character varying') then '''0'''
                       else '0' end;

  execute format($sql$
    insert into public.readings
      (meter_id, ts, seq, voltage, current, power, energy_kwh, relay, fault, created_at)
    with base as (
      select n,
             now() - ((%1$s - 1 - n) * interval '5 seconds') as t,
             round((230 + 2.5 * sin(n / 18.0) + (random() - 0.5) * 1.6)::numeric, 1) as v,
             round(greatest(0.4, least(1.2,
                   0.8 + 0.3 * sin(n / 30.0) + (random() - 0.5) * 0.12))::numeric, 2) as i
      from generate_series(0, %1$s - 1) as n
    ), c as (
      select base.*, round(base.v * base.i, 1) as p from base
    )
    select %2$L::uuid, %3$s, n + 1, c.v, c.i, c.p,
           round((12 + sum(c.p) over (order by n) * 5 / 3600.0 / 1000.0)::numeric, 3),
           %4$s, %5$s, c.t
    from c
  $sql$, v_points, v_meter_id, v_ts_expr, v_relay_expr, v_fault_expr);

  select max(seq), max(energy_kwh) into v_last_seq, v_last_e
    from public.readings where meter_id = v_meter_id;

  update public.meters
     set last_seq = v_last_seq,
         last_energy_kwh = v_last_e,
         last_seen = now()
   where id = v_meter_id;
end $$;

-- Result check: you should see 361 rows and a 30-minute span.
select count(*) as readings, min(created_at) as first_reading, max(created_at) as last_reading
from public.readings
where meter_id = (select id from public.meters where device_id = 'meter-001');

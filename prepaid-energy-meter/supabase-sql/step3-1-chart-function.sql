-- STEP 3 / SQL 1: the function the graphs use, plus an index. Safe to run again.
-- It averages readings into time buckets, so even 6 hours of data
-- reaches the browser as about 500 points.
-- "security invoker" means the normal row-level security still applies:
-- a user only ever gets the readings of their own meters.

create index if not exists readings_meter_created_idx
  on public.readings (meter_id, created_at desc);

create or replace function public.get_reading_series(
  p_meter_id       uuid,
  p_since          timestamptz,
  p_bucket_seconds integer
)
returns table (
  bucket_start timestamptz,
  voltage      numeric,
  current      numeric,
  power        numeric,
  n            integer,
  last_at      timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    to_timestamp((floor(extract(epoch from r.created_at) / b.size) * b.size)::double precision),
    avg(r.voltage)::numeric,
    avg(r.current)::numeric,
    avg(r.power)::numeric,
    count(*)::integer,
    max(r.created_at)
  from public.readings r
  cross join (select greatest(p_bucket_seconds, 1) as size) b
  where r.meter_id = p_meter_id
    and r.created_at >= p_since
  group by 1
  order by 1
$$;

revoke all on function public.get_reading_series(uuid, timestamptz, integer) from public, anon;
grant execute on function public.get_reading_series(uuid, timestamptz, integer) to authenticated, service_role;

-- Ask the API layer to notice the new function straight away.
notify pgrst, 'reload schema';

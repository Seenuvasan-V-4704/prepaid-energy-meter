-- STEP 4 / SQL 0: read-only checks. Changes nothing.
-- Shows what the new Edge Functions rely on. Run it once and keep the result.

select 'process_reading returns' as item,
       pg_get_function_result('public.process_reading(text,bigint,bigint,numeric,numeric,numeric,numeric,integer,integer)'::regprocedure) as result

union all
select 'process_ack arguments',
       pg_get_function_arguments('public.process_ack(text,uuid,boolean,integer)'::regprocedure)

union all
select 'process_ack returns',
       pg_get_function_result('public.process_ack(text,uuid,boolean,integer)'::regprocedure)

union all
select 'process_status arguments',
       pg_get_function_arguments('public.process_status(text,boolean)'::regprocedure)

union all
select 'commands columns',
       string_agg(column_name || ': ' || data_type || case when is_nullable = 'NO' then ' NOT NULL' else '' end,
                  ', ' order by ordinal_position)
from information_schema.columns
where table_schema = 'public' and table_name = 'commands'

union all
select 'commands CHECK rules (allowed statuses)',
       coalesce(string_agg(pg_get_constraintdef(oid), ' | '), 'none')
from pg_constraint
where conrelid = 'public.commands'::regclass and contype = 'c'

union all
select 'meter-001 right now',
       'balance=' || balance || ', min_balance=' || min_balance
       || ', relay_state=' || relay_state::text
       || ', last_seq=' || coalesce(last_seq::text, 'null')
       || ', last_energy_kwh=' || coalesce(last_energy_kwh::text, 'null')
       || ', owner=' || coalesce(owner_id::text, 'none')
from public.meters
where device_id = 'meter-001';

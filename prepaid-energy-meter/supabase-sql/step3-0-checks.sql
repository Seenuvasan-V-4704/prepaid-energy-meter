-- STEP 3 / SQL 0: read-only checks. Changes nothing.
-- Shows what Realtime needs and the exact column types of your tables.

select 'tables in realtime publication' as item,
       coalesce(string_agg(tablename, ', ' order by tablename), 'NONE') as result
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'

union all
select 'SELECT policies on readings',
       coalesce(string_agg(policyname || ' [' || cmd || ']', '; '), 'NONE - Realtime will deliver nothing')
from pg_policies
where schemaname = 'public' and tablename = 'readings' and cmd in ('SELECT', 'ALL')

union all
select 'SELECT policies on meters',
       coalesce(string_agg(policyname || ' [' || cmd || ']', '; '), 'NONE - Realtime will deliver nothing')
from pg_policies
where schemaname = 'public' and tablename = 'meters' and cmd in ('SELECT', 'ALL')

union all
select 'readings columns',
       string_agg(column_name || ': ' || data_type, ', ' order by ordinal_position)
from information_schema.columns
where table_schema = 'public' and table_name = 'readings'

union all
select 'meters columns',
       string_agg(column_name || ': ' || data_type, ', ' order by ordinal_position)
from information_schema.columns
where table_schema = 'public' and table_name = 'meters'

union all
select 'claim_meter returns', pg_get_function_result('public.claim_meter(text)'::regprocedure)

union all
select 'process_reading arguments', pg_get_function_arguments('public.process_reading(text,bigint,bigint,numeric,numeric,numeric,numeric,integer,integer)'::regprocedure);

select jsonb_build_object(
 'migration_applied',exists(select 1 from supabase_migrations.schema_migrations where version='20261105032021'),
 'number_column',exists(select 1 from information_schema.columns where table_schema='public' and table_name='sales_documents' and column_name='sph_number' and data_type='bigint'),
 'number_guard',exists(select 1 from pg_trigger where tgrelid='public.sales_documents'::regclass and tgname='sales_sph_number_guard' and tgenabled='O'),
 'number_unique',exists(select 1 from pg_indexes where schemaname='public' and indexname='sales_sph_number_unique'),
 'sales_rls',(select relrowsecurity from pg_class where oid='public.sales_documents'::regclass),
 'counter_rls',(select relrowsecurity from pg_class where oid='gsp_private.sph_counters'::regclass),
 'counter_access',has_table_privilege('authenticated','gsp_private.sph_counters','select'),
 'direct_write',has_table_privilege('authenticated','public.sales_documents','insert'),
 'attachment_rpc_anon',has_function_privilege('anon','public.attach_sales_document(uuid,uuid[])','execute'),
 'attachment_rpc_authenticated',has_function_privilege('authenticated','public.attach_sales_document(uuid,uuid[])','execute'),
 'attachment_rpc_is_invoker',(select not prosecdef from pg_proc where oid='public.attach_sales_document(uuid,uuid[])'::regprocedure),
 'register_consistent',not exists(
  select 1 from public.sales_documents where kind='sph' group by organization_id
  having min(sph_number)<>1 or max(sph_number)<>count(*) or count(distinct sph_number)<>count(*)
 ),
 'documents',(select count(*) from public.sales_documents)
) as verification;

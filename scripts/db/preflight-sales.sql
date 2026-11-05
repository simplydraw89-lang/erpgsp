select jsonb_build_object(
 'documents', (select coalesce(jsonb_agg(x),'[]') from (select kind,count(*) as total from public.sales_documents group by kind) x),
 'columns', (select jsonb_agg(x) from (select column_name,data_type from information_schema.columns where table_schema='public' and table_name='sales_documents' order by ordinal_position) x),
 'migrations', (select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
 'creation_rpc', pg_get_functiondef('public.save_sales_document(uuid,uuid,jsonb)'::regprocedure),
 'rls', (select relrowsecurity from pg_class where oid='public.sales_documents'::regclass),
 'anonymous_write',has_table_privilege('anon','public.sales_documents','insert'),
 'authenticated_write',has_table_privilege('authenticated','public.sales_documents','insert')
) as preflight;

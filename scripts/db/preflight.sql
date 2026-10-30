select jsonb_build_object(
  'tables',(select jsonb_agg(table_name order by table_name) from information_schema.tables where table_schema='public'),
  'columns',(select jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',data_type) order by table_name,ordinal_position) from information_schema.columns
    where table_schema='public' and table_name in ('approval_requests','company_assets','payment_records','workflow_documents')),
  'constraints',(select jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'name',conname,'definition',pg_get_constraintdef(oid))) from pg_constraint
    where conrelid in (to_regclass('public.approval_requests'),to_regclass('public.integration_sources'))),
  'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),
  'policies',(select jsonb_agg(jsonb_build_object('table',tablename,'name',policyname,'command',cmd)) from pg_policies where schemaname='public'),
  'migration_history',to_regclass('supabase_migrations.schema_migrations')::text
) as schema;

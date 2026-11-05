select jsonb_build_object(
 'migrations',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
 'clients',(select count(*) from public.sales_clients),
 'documents',(select count(*) from public.sales_documents),
 'duplicate_tax_id_groups',(select count(*) from (select regexp_replace(npwp,'[^0-9]','','g') from public.sales_clients where npwp is not null and regexp_replace(npwp,'[^0-9]','','g')<>'' group by organization_id,regexp_replace(npwp,'[^0-9]','','g') having count(*)>1) x),
 'client_constraints',(select jsonb_agg(jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid))) from pg_constraint where conrelid='public.sales_clients'::regclass),
 'document_constraints',(select jsonb_agg(jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid))) from pg_constraint where conrelid='public.sales_documents'::regclass),
 'policies',(select jsonb_agg(jsonb_build_object('table',tablename,'policy',policyname,'using',qual,'check',with_check)) from pg_policies where schemaname='public' and tablename in ('sales_clients','sales_documents','procurement_events','procurement_attachments')),
 'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='gsp_private' and p.proname in ('api_save_sales_client','api_save_sales_document','api_accept_sales_sph','document_storage_access')),
 'purchase_count',(select count(*) from public.purchase_requests),
 'journal_count',(select count(*) from public.accounting_journals),
 'auth_user_count',(select count(*) from auth.users)
) as preflight;

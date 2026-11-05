begin read only;
select jsonb_build_object(
 'migration_applied',exists(select 1 from supabase_migrations.schema_migrations where version='20261105070347'),
 'register_migration_applied',exists(select 1 from supabase_migrations.schema_migrations where version='20261105083655'),
 'migration_count',(select count(*) from supabase_migrations.schema_migrations),
 'sales_columns',(select jsonb_agg(column_name order by column_name) from information_schema.columns where table_schema='public' and table_name='sales_documents' and column_name in ('version','work_area','work_scopes','deal_status','valid_until','client_snapshot','submitted_at','review_note','amount')),
 'client_branch_nullable',(select is_nullable='YES' from information_schema.columns where table_schema='public' and table_name='sales_clients' and column_name='branch_id'),
 'client_fk',(select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.sales_documents'::regclass and conname='sales_documents_company_client'),
 'marketing_supported',(select pg_get_constraintdef(oid) like '%marketing%' from pg_constraint where conname='work_assignments_job_role_check' and conrelid='public.work_assignments'::regclass),
 'public_functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'invoker',not p.prosecdef,'anon_execute',has_function_privilege('anon',p.oid,'execute'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'execute'))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('can_register_sales_client','can_read_sales_clients','can_read_sales_document','save_sph_request','review_sph_request','sph_review_allowed','sph_review_queue','can_upload_sales_document','can_read_sales_attachment','decide_sph','sph_register','sph_spk_context','sales_notifications')),
 'legacy_bypass_blocked',not has_function_privilege('authenticated','gsp_private.api_save_sph_request_base(uuid,uuid,jsonb,uuid,integer,boolean)','execute') and not has_function_privilege('authenticated','gsp_private.api_save_sales_document_base(uuid,uuid,jsonb)','execute'),
 'policies',(select jsonb_agg(jsonb_build_object('table',tablename,'policy',policyname,'using',qual,'check',with_check)) from pg_policies where schemaname='public' and tablename in ('sales_clients','sales_documents','procurement_events','procurement_attachments')),
 'rls_enabled',(select bool_and(relrowsecurity) from pg_class where oid in ('public.sales_clients'::regclass,'public.sales_documents'::regclass,'public.procurement_attachments'::regclass)),
 'counts',jsonb_build_object('clients',(select count(*) from public.sales_clients),'documents',(select count(*) from public.sales_documents),'purchases',(select count(*) from public.purchase_requests),'journals',(select count(*) from public.accounting_journals),'auth_users',(select count(*) from auth.users))
) as verification;
rollback;

-- Read-only verification of deployment, isolation and API readiness.
select jsonb_build_object(
 'auth_user_count',(select count(*) from auth.users),
 'branches',(select jsonb_agg(jsonb_build_object('code',code,'name',name,'kind',kind,'mapped',entity_id is not null) order by code) from public.business_units),
 'accounts',(select count(*) from public.finance_accounts where is_active),
 'open_periods',(select count(*) from public.accounting_periods where period_status='open'),
 'purchase_count',(select count(*) from public.purchase_requests),
 'vendor_count',(select count(*) from public.procurement_vendors),
 'private_bucket',(select not public from storage.buckets where id='procurement-documents'),
 'rls',(select jsonb_agg(jsonb_build_object('table',c.relname,'enabled',c.relrowsecurity)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('business_units','work_assignments','procurement_vendors','purchase_requests','procurement_events','procurement_attachments')),
 'api',(select jsonb_agg(jsonb_build_object('name',p.proname,'invoker',not p.prosecdef,'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('initialize_purchasing_workspace','save_procurement_vendor','review_procurement_vendor','save_purchase_request','submit_purchase_request','review_purchase_request','pay_purchase_request')),
 'storage_guards',(select count(*) from pg_policies where schemaname='storage' and policyname like 'gsp_document_%guard'),
 'migration_versions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations)
) as verification;

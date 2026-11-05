select jsonb_build_object(
 'project_database',current_database(),
 'auth_users',(select count(*) from auth.users),
 'chart',(select jsonb_agg(x) from (select organization_id,count(*) total,count(*) filter(where parent_account_id is null) roots,count(*) filter(where is_postable) posting_accounts,count(*) filter(where not is_postable) groups from public.finance_accounts group by organization_id)x),
 'invalid_parents',(select count(*) from public.finance_accounts a join public.finance_accounts p on p.id=a.parent_account_id where p.organization_id<>a.organization_id or p.is_postable or p.account_type<>a.account_type or p.report_section<>a.report_section),
 'journals',(select count(*) from public.accounting_journals),
 'purchases',(select count(*) from public.purchase_requests),
 'vendors',(select count(*) from public.procurement_vendors),
 'rpc',(select jsonb_agg(jsonb_build_object('name',proname,'definer',prosecdef,'anon',has_function_privilege('anon',p.oid,'execute'),'authenticated',has_function_privilege('authenticated',p.oid,'execute'))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('save_finance_account','install_recommended_coa')),
 'audit_source',(select jsonb_agg(jsonb_build_object('action',action,'details',details)) from public.audit_events where action='coa.migration_seeded'),
 'migration',(select max(version) from supabase_migrations.schema_migrations)
) verification;

-- Read-only recovery snapshot for the functions/policies/grants changed by the
-- branch migration. This is a schema snapshot, not a full business-data backup.
select jsonb_build_object(
 'captured_at',now(),
 'functions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'definition',pg_get_functiondef(p.oid),'acl',p.proacl))
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where (n.nspname='public' and p.proname in ('has_org_role','validate_accounting_journal')) or (n.nspname='gsp_private' and p.proname in ('check_writer','guard_legacy_scope','calculate_purchase','api_pay_purchase_request','api_initialize_purchasing_workspace'))),
 'policies',(select jsonb_agg(to_jsonb(p)) from pg_policies p where schemaname in ('public','storage')),
 'rls',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'enabled',c.relrowsecurity,'forced',c.relforcerowsecurity)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','storage') and c.relkind='r'),
 'grants',(select jsonb_agg(to_jsonb(g)) from information_schema.role_table_grants g where table_schema in ('public','storage')),
 'migrations',(select jsonb_agg(to_jsonb(m)) from supabase_migrations.schema_migrations m)
) as schema_snapshot;

-- Read-only confirmation of deployed definitions relevant to audit findings.
select jsonb_build_object(
 'version_checks',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'nullable_comparison',position('d.version<>p_version' in pg_get_functiondef(p.oid))>0)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='gsp_private' and p.proname in ('api_submit_purchase_request','api_review_purchase_request','api_pay_purchase_request')),
 'rls_auto_enable',(select jsonb_build_object('return_type',pg_get_function_result(p.oid),'definition',pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='rls_auto_enable'),
 'audit_event_policies',(select jsonb_agg(jsonb_build_object('policy',policyname,'command',cmd,'roles',roles,'using',qual,'check',with_check)) from pg_policies where schemaname='public' and tablename='audit_events'),
 'storage_guards',(select count(*) from pg_policies where schemaname='storage' and policyname like 'gsp_document_%guard')
) as audit;

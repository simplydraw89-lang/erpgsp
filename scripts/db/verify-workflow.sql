begin;
select set_config('request.jwt.claim.sub',(select user_id::text from public.organization_members where role='owner' limit 1),true);
set local role authenticated;
do $$
declare org uuid; doc uuid; live_count bigint; blocked boolean; t text;
begin
  select organization_id into org from public.organization_members where user_id=auth.uid() and role='owner' limit 1;
  if org is null then raise exception 'Verification requires an existing owner.'; end if;
  foreach t in array array['company_assets','workflow_documents','workflow_executions','approval_policies','approval_requests','crm_clients','crm_projects','operational_work_items','finance_accounts','hr_employees','tax_records'] loop
    if has_table_privilege('authenticated','public.'||t,'INSERT,UPDATE,DELETE,TRUNCATE') then raise exception 'Direct write privilege remains: %',t; end if;
  end loop;
  select count(*) into live_count from public.company_assets where organization_id=org;
  doc:=public.save_workflow_draft(org,'asset',jsonb_build_object('code','VERIFY-'||gen_random_uuid()::text,'name','Transactional verification - rolled back','category','Verification','purchase_cost','1.00','condition','good','status','active'));
  if (select count(*) from public.company_assets where organization_id=org)<>live_count then raise exception 'Draft changed live inventory.'; end if;
  blocked:=false;
  begin update public.workflow_documents set state='executed' where id=doc;
  exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Direct state update was allowed.'; end if;
  blocked:=false;
  begin perform public.execute_workflow_document(doc,1);
  exception when others then
    if sqlerrm like '%belum disetujui%' then blocked:=true; else raise; end if;
  end;
  if not blocked then raise exception 'Unapproved execution was allowed.'; end if;
end $$;
rollback;
select jsonb_build_object(
  'checks','Draft, direct-write denial and unapproved-execution checks passed; test data rolled back',
  'rls_enabled',(select bool_and(relrowsecurity) from pg_class where oid in ('public.company_assets'::regclass,'public.workflow_documents'::regclass,'public.workflow_executions'::regclass,'public.approval_policies'::regclass)),
  'anonymous_execute',has_function_privilege('anon','public.execute_workflow_document(uuid,integer)','EXECUTE'),
  'authenticated_execute',has_function_privilege('authenticated','public.execute_workflow_document(uuid,integer)','EXECUTE')
) as verification;

begin;
select set_config('request.jwt.claim.sub',(select user_id::text from public.organization_members where role='owner' order by created_at limit 1),true);
set local role authenticated;
select jsonb_build_object(
 'actor_is_owner',public.has_business_job((select organization_id from public.organization_members where user_id=auth.uid() and role='owner' limit 1),null,array['accounting_tax','finance']),
 'branches',(select count(*) from (select id,code,name,kind,entity_id from public.business_units where kind='branch') b),
 'assignments',(select count(*) from (select branch_id from public.work_assignments where user_id=auth.uid()) w),
 'approved_vendors',(select count(*) from public.procurement_vendors where status='approved'),
 'purchase_accounts',(select count(*) from (select id,code,name,account_type,posting_category,is_postable from public.finance_accounts where is_active and is_postable) a),
 'open_periods',(select count(*) from (select entity_id from public.accounting_periods where period_status='open') p)
) owner_form_references;
rollback;

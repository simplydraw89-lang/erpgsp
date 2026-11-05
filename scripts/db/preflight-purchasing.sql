-- Read-only deployment preflight; no invoice or personal contact data is read.
select jsonb_build_object(
  'auth_user_count',(select count(*) from auth.users),
  'memberships',(select jsonb_agg(x) from (select organization_id,role,count(*) as users from public.organization_members group by organization_id,role) x),
  'organizations',(select jsonb_agg(jsonb_build_object('id',id,'name',name)) from public.organizations),
  'entities',(select jsonb_agg(jsonb_build_object('id',id,'organization_id',organization_id,'code',entity_code,'name',legal_name,'type',entity_type,'parent_id',parent_entity_id,'currency',functional_currency,'active',is_active)) from public.company_entities),
  'account_count',(select count(*) from public.finance_accounts where is_active),
  'open_period_count',(select count(*) from public.accounting_periods where period_status='open'),
  'branch_schema',to_regclass('public.business_units'),
  'purchase_schema',to_regclass('public.purchase_requests'),
  'attachment_schema',to_regclass('public.procurement_attachments'),
  'storage_ready',to_regclass('storage.objects') is not null
) as preflight;

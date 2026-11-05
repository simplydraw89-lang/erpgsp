select jsonb_build_object(
 'accounts',(select jsonb_agg(jsonb_build_object('id',id,'organization_id',organization_id,'code',code,'name',name,'type',account_type,'parent',parent_account_id,'active',is_active)) from public.finance_accounts),
 'entities',(select jsonb_agg(jsonb_build_object('id',id,'organization_id',organization_id,'type',entity_type,'code',entity_code)) from public.company_entities),
 'periods',(select count(*) from public.accounting_periods where period_status='open'),
 'journal_count',(select count(*) from public.accounting_journals),
 'uploads',(select jsonb_agg(x) from (select id,storage_path,file_name,content_type,byte_size,created_at from public.procurement_attachments order by created_at desc limit 3) x),
 'schema',(select jsonb_agg(jsonb_build_object('column',column_name,'type',data_type)) from information_schema.columns where table_schema='public' and table_name='finance_accounts')
) as preflight;

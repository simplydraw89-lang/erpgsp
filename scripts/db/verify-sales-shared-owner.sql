begin read only;
do $$begin perform set_config('request.jwt.claim.sub',(select user_id::text from public.organization_members where role='owner' limit 1),true);end$$;
set local role authenticated;
select jsonb_build_object(
 'register',public.sph_register(organization_id,null,0),
 'notifications',public.sales_notifications(organization_id),
 'review_queue',public.sph_review_queue(organization_id),
 'client_reader',public.can_read_sales_clients(organization_id)
) as owner_read_probe from public.organization_members where user_id=auth.uid() and role='owner';
rollback;

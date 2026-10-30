create index if not exists workflow_documents_personal_state_idx
  on public.workflow_documents(organization_id,created_by,state);
create index if not exists approval_requests_reviewer_pending_idx
  on public.approval_requests(organization_id,required_role,created_at)
  where status='pending';
create index if not exists tax_records_open_deadline_idx
  on public.tax_records(organization_id,due_on)
  where status<>'reported';

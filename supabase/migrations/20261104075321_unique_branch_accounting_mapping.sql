-- Application-level checks alone cannot prevent two concurrent mappings from
-- choosing the same accounting unit. Enforce branch isolation in PostgreSQL.
create unique index business_units_accounting_entity_unique
 on public.business_units(organization_id,entity_id)
 where entity_id is not null;

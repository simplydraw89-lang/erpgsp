-- Rename default/legacy organization to PT. Global Solusi Prima
update public.organizations
set name = 'PT. Global Solusi Prima'
where name ilike '%Gema Sinergi Peradaban%' or name is null;

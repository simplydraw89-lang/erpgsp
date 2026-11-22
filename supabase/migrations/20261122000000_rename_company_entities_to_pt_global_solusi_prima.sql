-- ============================================================================
-- SINKRONISASI NAMA ENTITAS RESMI: PT. GLOBAL SOLUSI PRIMA (Pusat & Cabang)
-- Sistem Pemilik: GSP, Aplikasi: uliquapp
-- Klien Pengguna Sistem: PT. Global Solusi Prima (beserta seluruh cabangnya)
-- ============================================================================

-- 1. Perbarui Organisasi Utama
update public.organizations
set name = 'PT. Global Solusi Prima'
where name ilike '%Gema Sinergi Peradaban%' or name is null or name = '';

-- 2. Perbarui Entitas Induk (Parent) di Pembukuan
update public.company_entities
set legal_name = 'PT. Global Solusi Prima'
where (legal_name ilike '%Gema Sinergi Peradaban%' or legal_name is null) and entity_type = 'parent';

-- 3. Perbarui Seluruh Entitas Cabang di Pembukuan
update public.company_entities
set legal_name = replace(legal_name, 'Gema Sinergi Peradaban', 'PT. Global Solusi Prima')
where legal_name ilike '%Gema Sinergi Peradaban%';

-- 4. Pastikan entitas spesifik cabang memiliki format nama resmi
update public.company_entities
set legal_name = 'PT. Global Solusi Prima - Jakarta'
where entity_code = 'JKT' and legal_name <> 'PT. Global Solusi Prima - Jakarta';

update public.company_entities
set legal_name = 'PT. Global Solusi Prima - Jogjakarta'
where entity_code = 'JOG' and legal_name <> 'PT. Global Solusi Prima - Jogjakarta';

update public.company_entities
set legal_name = 'PT. Global Solusi Prima - Surabaya'
where entity_code = 'SBY' and legal_name <> 'PT. Global Solusi Prima - Surabaya';

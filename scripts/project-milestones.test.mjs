import test from "node:test"
import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto"

test("Project milestones SQL migration seeds 5 defaults, enforces PM/PIC write & client read, and grants milestone attachment access", async () => {
  const db = new PGlite({ extensions: { pgcrypto } })

  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users(
        id uuid primary key,
        email text,
        raw_user_meta_data jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
    `)

    const skipFiles = new Set([
      "20261110030000_seed_demo_account.sql",
      "20261111_auto_link_auth_users_and_client_portal.sql",
      "20261111_automated_client_user_provisioning.sql",
      "20261111_fix_gotrue_null_tokens_and_identities.sql",
      "20261111_fix_list_org_users_and_client_names.sql",
      "reset_transactional_data_fresh_start.sql",
    ])

    const migrationFiles = (await readdir(new URL("../supabase/migrations/", import.meta.url)))
      .filter((name) => name.endsWith(".sql") && !skipFiles.has(name))
      .sort()

    for (const file of migrationFiles) {
      const sql = await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8")
      await db.exec(sql)
    }

    const ownerId = "60000000-0000-4000-8000-000000000001"
    const pmId = "60000000-0000-4000-8000-000000000002"
    const clientId = "60000000-0000-4000-8000-000000000003"
    const demoId = "60000000-0000-4000-8000-000000000004"

    await db.query("insert into auth.users(id, email) values($1, 'owner@gsp.test')", [ownerId])
    await db.query("insert into auth.users(id, email) values($1, 'pm@sby.test')", [pmId])
    await db.query("insert into auth.users(id, email) values($1, 'client@bara.test')", [clientId])
    await db.query("insert into auth.users(id, email, raw_user_meta_data) values($1, 'demo@gsp.test', '{\"is_demo\":true}'::jsonb)", [demoId])

    const orgId = (
      await db.query("insert into public.organizations(name, slug) values('GSP Test', 'gsp-test') returning id")
    ).rows[0].id

    const branchId = (
      await db.query("select id from public.business_units where organization_id = $1 and code = 'SBY'", [orgId])
    ).rows[0].id

    await db.query("insert into public.organization_members(organization_id, user_id, role) values($1, $2, 'owner')", [orgId, ownerId])
    await db.query("insert into public.organization_members(organization_id, user_id, role) values($1, $2, 'staff')", [orgId, pmId])
    await db.query("insert into public.organization_members(organization_id, user_id, role) values($1, $2, 'staff')", [orgId, clientId])
    await db.query("insert into public.organization_members(organization_id, user_id, role) values($1, $2, 'director')", [orgId, demoId])

    await db.query("insert into public.person_profiles(organization_id, user_id, relationship_status) values($1, $2, 'permanent')", [orgId, pmId])
    await db.query("insert into public.person_profiles(organization_id, user_id, relationship_status) values($1, $2, 'client')", [orgId, clientId])
    await db.query("insert into public.person_profiles(organization_id, user_id, relationship_status) values($1, $2, 'permanent')", [orgId, demoId])

    await db.query("insert into public.work_assignments(organization_id, user_id, branch_id, job_role) values($1, $2, $3, 'project_manager')", [orgId, pmId, branchId])
    await db.query("insert into public.work_assignments(organization_id, user_id, branch_id, job_role) values($1, $2, null, 'president')", [orgId, demoId])

    // Disable legacy write guards for test setup project creation
    const projectId = (
      await db.query(
        `insert into public.crm_projects(organization_id, branch_id, code, name, status, approval_status, created_by)
         values($1, $2, 'PRJ/TEST/001', 'Proyek Uji Milestone', 'active', 'active', $3) returning id`,
        [orgId, branchId, ownerId]
      )
    ).rows[0].id

    await db.query(
      "insert into public.project_access_scopes(organization_id, project_id, branch_id) values($1, $2, $3)",
      [orgId, projectId, branchId]
    )
    await db.query(
      "insert into public.project_memberships(organization_id, project_id, user_id, member_type, can_submit, is_active, granted_by) values($1, $2, $3, 'client', true, true, $4)",
      [orgId, projectId, clientId, ownerId]
    )

    const as = (userId, sql, args = []) =>
      db.transaction(async (tx) => {
        await tx.exec("set local role authenticated")
        await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId])
        return tx.query(sql, args)
      })

    // 1. Trigger automatically seeded 5 default milestones
    const seeded = (await as(clientId, "select * from public.get_or_seed_project_milestones($1)", [projectId])).rows
    assert.equal(seeded.length, 5)
    assert.equal(seeded[2].milestone_number, 3)
    assert.equal(seeded[2].progress, 75)
    assert.equal(seeded[2].status, "in_progress")

    // 2. Upload an attachment as PM & attach it to Stage 3
    const attId = "70000000-0000-4000-8000-000000000001"
    const storagePath = `${orgId}/${branchId}/${pmId}/${attId}.pdf`
    await as(
      pmId,
      `insert into public.procurement_attachments(id, organization_id, branch_id, uploaded_by, domain, storage_path, file_name, content_type, byte_size)
       values($1, $2, $3, $4, 'sales', $5, 'CoA_Lab_Air_2026.pdf', 'application/pdf', 4096)`,
      [attId, orgId, branchId, pmId, storagePath]
    )

    // 3. PM updates Stage 3 to 100% completed with new PIC, description, deliverables, client_actions, and CoA Lab attachment
    await as(
      pmId,
      `select public.save_project_milestone(
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text[], $11::text[], $12::uuid[]
      )`,
      [
        projectId,
        3,
        "3. Kajian Lapangan & Uji Laboratorium",
        "Uji laboratorium terakreditasi KAN selesai",
        "completed",
        100,
        "Dr. Budi Santoso (PM Surabaya)",
        "Selesai 12 Nov 2026",
        "Seluruh parameter uji air dan udara telah terbit CoA resmi.",
        ["Berita Acara Sampling Lapangan", "CoA_Lab_Air_2026.pdf"],
        ["Tinjau CoA Lab pada laci dokumen"],
        [attId],
      ]
    )

    // 4. Client reads updated milestones -> sees 100% completed & CoA Lab attachment
    const clientMilestones = (
      await as(clientId, "select * from public.project_milestones where project_id = $1 order by milestone_number", [projectId])
    ).rows
    assert.equal(clientMilestones[2].status, "completed")
    assert.equal(clientMilestones[2].progress, 100)
    assert.equal(clientMilestones[2].pic_name, "Dr. Budi Santoso (PM Surabaya)")
    assert.deepEqual(clientMilestones[2].attachment_ids, [attId])

    // Client can read the milestone attachment via can_read_sales_attachment
    const canReadAtt = (await as(clientId, "select public.can_read_sales_attachment($1) as allowed", [attId])).rows[0].allowed
    assert.equal(canReadAtt, true)

    // 5. Client cannot mutate milestones
    await assert.rejects(
      as(
        clientId,
        `select public.save_project_milestone($1, 3, 'Hack', '', 'completed', 100, 'Client', '', '', '{}'::text[], '{}'::text[], '{}'::uuid[])`,
        [projectId]
      ),
      /Akses ditolak/
    )

    // 6. Demo read-only user cannot mutate milestones
    await assert.rejects(
      as(
        demoId,
        `select public.save_project_milestone($1, 3, 'Demo Edit', '', 'completed', 100, 'Demo', '', '', '{}'::text[], '{}'::text[], '{}'::uuid[])`,
        [projectId]
      ),
      /Mode Pratinjau/
    )
  } finally {
    await db.close()
  }
})

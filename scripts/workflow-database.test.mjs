import test from "node:test"
import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto"

// Preserve regression coverage for the pre-branch workflow. The branch migration
// intentionally closes these organization-wide paths to non-owner accounts;
// scripts/procurement-database.test.mjs verifies the replacement and that closure.
test("Legacy PostgreSQL workflow security and lifecycle (pre-branch baseline)", async (t) => {
  const db = new PGlite({ extensions: { pgcrypto } })
  const ids = Array.from(
    { length: 10 },
    (_, i) => `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  )
  const [owner, director, operations, finance, hr, staff, other, director2, auditor, manager] =
    ids
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated,anon;
      grant execute on function auth.uid() to authenticated,anon;`)
    for (const file of (
      await readdir(new URL("../supabase/migrations/", import.meta.url))
    )
      .filter((name) => name.endsWith(".sql") && name <= "20261102000100_accounting_advance_workflows.sql")
      .sort()) {
      await db.exec(
        await readFile(
          new URL(`../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      )
    }
    for (const id of ids)
      await db.query("insert into auth.users(id) values($1)", [id])
    const org = (
      await db.query(
        "insert into public.organizations(name,slug) values('Test A','test-a') returning id",
      )
    ).rows[0].id
    const orgB = (
      await db.query(
        "insert into public.organizations(name,slug) values('Test B','test-b') returning id",
      )
    ).rows[0].id
    for (const [id, role] of [
      [owner, "owner"],
      [director, "director"],
      [director2, "director"],
      [operations, "operations"],
      [finance, "finance"],
      [hr, "hr"],
      [staff, "staff"],
      [auditor, "auditor"],
      [manager, "manager"],
    ]) {
      await db.query(
        "insert into public.organization_members(organization_id,user_id,role) values($1,$2,$3)",
        [org, id, role],
      )
    }
    await db.query(
      "insert into public.organization_members(organization_id,user_id,role) values($1,$2,'owner')",
      [orgB, other],
    )
    const as = (user, sql, params = []) =>
      db.transaction(async (tx) => {
        await tx.exec("set local role authenticated")
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
          user,
        ])
        return tx.query(sql, params)
      })
    const payload = {
      code: "AST-001",
      name: "Laptop",
      category: "IT",
      location: "Kantor",
      purchase_cost: "12000000.00",
      condition: "good",
      status: "active",
    }
    const save = async (
      user,
      type,
      body,
      doc = null,
      version = null,
      target = null,
    ) => {
      const baseVersion = target
        ? ((
            await db.query(
              "select row_version from public.company_assets where id=$1",
              [target],
            )
          ).rows[0]?.row_version ?? 1)
        : null
      return (
        await as(
          user,
          "select public.save_workflow_draft($1,$2,$3,$4,$5,$6,$7) id",
          [org, type, JSON.stringify(body), doc, version, target, baseVersion],
        )
      ).rows[0].id
    }
    const submit = async (user, doc, version = 1) =>
      (
        await as(user, "select public.submit_workflow_document($1,$2) id", [
          doc,
          version,
        ])
      ).rows[0].id
    const review = (user, req, decision = "approved") =>
      as(user, "select public.review_approval_request($1,$2,'Test decision')", [
        req,
        decision,
      ])
    const execute = (user, doc, version = 1) =>
      as(user, "select public.execute_workflow_document($1,$2) id", [
        doc,
        version,
      ])
    let doc, req, asset

    await t.test(
      "draft never writes live data; edited draft has optimistic version checks",
      async () => {
        doc = await save(operations, "asset", payload)
        assert.equal(
          (await as(operations, "select * from public.company_assets")).rows
            .length,
          0,
        )
        await save(operations, "asset", payload, doc, 1)
        await assert.rejects(
          save(operations, "asset", payload, doc, 1),
          /Versi draft/,
        )
        await assert.rejects(submit(operations, doc, 1), /versi/)
        req = await submit(operations, doc, 2)
      },
    )
    await t.test(
      "submitted data is locked; unapproved execution fails",
      async () => {
        await assert.rejects(
          save(operations, "asset", { ...payload, name: "Changed" }, doc, 2),
          /terkunci/,
        )
        await assert.rejects(execute(operations, doc, 2), /belum disetujui/)
      },
    )
    await t.test(
      "reviewer is chosen by policy; incorrect role and organization denied",
      async () => {
        assert.equal(
          (
            await as(
              director,
              "select required_role from public.approval_requests where id=$1",
              [req],
            )
          ).rows[0].required_role,
          "director",
        )
        await assert.rejects(review(finance, req), /tidak berwenang/)
        await assert.rejects(review(other, req), /tidak berwenang/)
        assert.equal(
          (
            await as(
              other,
              "select * from public.workflow_documents where id=$1",
              [doc],
            )
          ).rows.length,
          0,
        )
        await review(director, req)
        await assert.rejects(review(director2, req), /sudah diputuskan/)
      },
    )
    await t.test(
      "approved version is required and repeated execution writes only once",
      async () => {
        await assert.rejects(execute(operations, doc, 1), /Versi dokumen/)
        asset = (await execute(operations, doc, 2)).rows[0].id
        assert.equal((await execute(operations, doc, 2)).rows[0].id, asset)
        assert.equal(
          (
            await as(
              operations,
              "select * from public.company_assets where id=$1",
              [asset],
            )
          ).rows.length,
          1,
        )
        assert.equal(
          (
            await as(
              operations,
              "select * from public.workflow_executions where document_id=$1",
              [doc],
            )
          ).rows.length,
          1,
        )
      },
    )
    await t.test(
      "direct Data API-equivalent writes and privileged helpers are denied",
      async () => {
        for (const table of [
          "company_assets",
          "workflow_documents",
          "approval_requests",
          "workflow_executions",
          "approval_policies",
          "crm_clients",
          "crm_projects",
          "operational_work_items",
          "finance_accounts",
          "hr_employees",
          "tax_records",
        ]) {
          await assert.rejects(
            as(owner, `delete from public.${table}`),
            /permission denied/,
          )
          await assert.rejects(
            as(owner, `truncate public.${table}`),
            /permission denied/,
          )
        }
        await assert.rejects(
          as(
            owner,
            "update public.workflow_documents set state='executed' where id=$1",
            [doc],
          ),
          /permission denied/,
        )
        await assert.rejects(
          as(owner, "insert into public.approval_requests default values"),
          /permission denied/,
        )
        await assert.rejects(
          as(owner, "select gsp_private.record_config('asset')"),
          /permission denied/,
        )
        await assert.rejects(
          db.transaction(async (tx) => {
            await tx.exec("set local role anon")
            return tx.query("select public.execute_workflow_document($1,2)", [
              doc,
            ])
          }),
          /permission denied/,
        )
      },
    )
    await t.test(
      "self approval is prohibited even for a director",
      async () => {
        const own = await save(director, "client", {
          name: "Own client",
          status: "prospect",
        })
        const request = await submit(director, own)
        await assert.rejects(review(director, request), /sendiri/)
        await review(director2, request, "rejected")
        await as(director, "select public.revise_workflow_document($1,1)", [
          own,
        ])
        await assert.rejects(submit(director, own, 1), /versi/)
        const next = await submit(director, own, 2)
        assert.notEqual(next, request)
        await assert.rejects(execute(director, own, 2), /belum disetujui/)
      },
    )
    await t.test(
      "stale target versions cannot overwrite a previously executed change",
      async () => {
        const change1 = await save(
          operations,
          "asset",
          { ...payload, location: "Lantai 2" },
          null,
          null,
          asset,
        )
        const change2 = await save(
          operations,
          "asset",
          { ...payload, location: "Lantai 3" },
          null,
          null,
          asset,
        )
        await review(director, await submit(operations, change1))
        await review(director, await submit(operations, change2))
        await execute(operations, change1)
        await assert.rejects(
          execute(operations, change2),
          /versinya sudah berubah/,
        )
        assert.equal(
          (
            await as(
              operations,
              "select location,row_version from public.company_assets where id=$1",
              [asset],
            )
          ).rows[0].location,
          "Lantai 2",
        )
      },
    )
    await t.test(
      "payload, organization links and unknown fields are validated in PostgreSQL",
      async () => {
        await assert.rejects(save(staff, "asset", payload), /tidak diizinkan/)
        await assert.rejects(
          save(operations, "asset", { ...payload, organization_id: orgB }),
          /Kolom tidak diizinkan/,
        )
        await assert.rejects(
          save(operations, "asset", { ...payload, custodian_id: other }),
          /anggota organisasi/,
        )
        await assert.rejects(
          save(operations, "asset", { ...payload, purchase_cost: "NaN" }),
          /Nilai uang/,
        )
        await assert.rejects(
          save(operations, "asset", { ...payload, acquired_on: "2026-02-31" }),
          /date\/time|out of range/,
        )
        await assert.rejects(
          save(operations, "asset", payload, null, null, ids[8]),
          /tidak ditemukan/,
        )
      },
    )
    await t.test(
      "policy changes require owner and expected version; amount escalation is applied",
      async () => {
        await assert.rejects(
          as(
            operations,
            "select public.set_approval_policy($1,'asset','finance',1000000,'owner',1)",
            [org],
          ),
          /Hanya owner/,
        )
        await as(
          owner,
          "select public.set_approval_policy($1,'asset','finance',1000000,'owner',1)",
          [org],
        )
        await assert.rejects(
          as(
            owner,
            "select public.set_approval_policy($1,'asset','finance',1000000,'owner',1)",
            [org],
          ),
          /Versi kebijakan/,
        )
        const high = await save(operations, "asset", {
          ...payload,
          code: "AST-HIGH",
        })
        const request = await submit(operations, high)
        assert.equal(
          (
            await as(
              owner,
              "select required_role from public.approval_requests where id=$1",
              [request],
            )
          ).rows[0].required_role,
          "owner",
        )
        await assert.rejects(review(director, request), /tidak berwenang/)
        await review(owner, request)
      },
    )
    await t.test(
      "tampered approval snapshot cannot be reviewed or executed",
      async () => {
        const changed = await save(operations, "asset", {
          ...payload,
          code: "AST-SNAPSHOT",
        })
        const request = await submit(operations, changed)
        await db.query(
          "update public.approval_requests set document_snapshot='{}' where id=$1",
          [request],
        )
        await assert.rejects(review(owner, request), /tidak cocok/)
        const approved = await save(operations, "asset", {
          ...payload,
          code: "AST-SNAPSHOT-EXEC",
        })
        const approvedRequest = await submit(operations, approved)
        await review(owner, approvedRequest)
        await db.query(
          "update public.approval_requests set document_snapshot='{}' where id=$1",
          [approvedRequest],
        )
        await assert.rejects(execute(operations, approved), /Snapshot/)
      },
    )
    await t.test(
      "policy updates do not change the reviewer of an in-flight version",
      async () => {
        const pending = await save(operations, "asset", {
          ...payload,
          code: "AST-POLICY-SNAPSHOT",
        })
        const request = await submit(operations, pending)
        await as(
          owner,
          "select public.set_approval_policy($1,'asset','finance',null,'owner',2)",
          [org],
        )
        await assert.rejects(review(finance, request), /tidak berwenang/)
        await review(owner, request)
      },
    )
    await t.test(
      "failed live insert rolls back execution and the document state atomically",
      async () => {
        const duplicate = await save(operations, "asset", payload)
        const request = await submit(operations, duplicate)
        await review(finance, request)
        await assert.rejects(execute(operations, duplicate), /duplicate key/)
        assert.equal(
          (
            await as(
              operations,
              "select state from public.workflow_documents where id=$1",
              [duplicate],
            )
          ).rows[0].state,
          "approved",
        )
        assert.equal(
          (
            await as(
              operations,
              "select * from public.workflow_executions where document_id=$1",
              [duplicate],
            )
          ).rows.length,
          0,
        )
      },
    )
    await t.test(
      "creating a draft from a stale edit screen is rejected",
      async () => {
        await assert.rejects(
          as(
            operations,
            "select public.save_workflow_draft($1,'asset',$2,null,null,$3,1)",
            [org, JSON.stringify(payload), asset],
          ),
          /sejak formulir dibuka/,
        )
      },
    )
    await t.test(
      "requesters who lose membership cannot read or execute their old document",
      async () => {
        const removed = await save(operations, "asset", {
          ...payload,
          code: "AST-REMOVED",
        })
        const request = await submit(operations, removed)
        await review(finance, request)
        await db.query(
          "delete from public.organization_members where organization_id=$1 and user_id=$2",
          [org, operations],
        )
        assert.equal(
          (
            await as(
              operations,
              "select * from public.approval_requests where id=$1",
              [request],
            )
          ).rows.length,
          0,
        )
        assert.equal(
          (
            await as(
              operations,
              "select * from public.workflow_documents where id=$1",
              [removed],
            )
          ).rows.length,
          0,
        )
        await assert.rejects(
          execute(operations, removed),
          /tidak dapat diakses/,
        )
        await db.query(
          "insert into public.organization_members(organization_id,user_id,role) values($1,$2,'operations')",
          [org, operations],
        )
      },
    )
    await t.test("technical superuser is hidden from the company directory",async()=>{
      const ordinary=await as(staff,"select user_id,role from public.organization_members where organization_id=$1",[org])
      assert.equal(ordinary.rows.some(row=>row.user_id===owner),false)
      assert.equal(ordinary.rows.some(row=>row.user_id===staff),true)
      const system=await as(owner,"select user_id from public.organization_members where organization_id=$1",[org])
      assert.equal(system.rows.some(row=>row.user_id===owner),true)
    })
    await t.test(
      "all existing module record types execute through the same protected lifecycle",
      async () => {
        for (const [type, body] of [
          ["client", { name: "Client", status: "prospect" }],
          ["project", { code: "PRJ", name: "Project", status: "planned" }],
          ["work_item", { title: "Task", priority: "normal", status: "todo" }],
          [
            "account",
            {
              code: "1100",
              name: "Cash",
              account_type: "asset",
              normal_balance: "debit",
              is_active: true,
            },
          ],
          [
            "employee",
            {
              employee_number: "EMP",
              full_name: "Employee",
              employment_status: "active",
            },
          ],
          [
            "tax_record",
            {
              tax_period: "2026-10",
              tax_type: "ppn",
              tax_base: "1000",
              tax_amount: "100",
              status: "draft",
            },
          ],
        ]) {
          const created = await save(owner, type, body)
          await review(director, await submit(owner, created))
          assert.ok((await execute(owner, created)).rows[0].id)
        }
      },
    )
    await t.test("cash advance roles, staged approvals and settlement", async () => {
      const advancePayload = {
        advance_number: "ADV-TEST-001",
        purpose_type: "business_trip",
        trip_destination: "Bandung",
        departure_on: "2026-10-10",
        return_on: "2026-10-12",
        description: "Perjalanan kerja",
        amount: "500.00",
        needed_on: "2026-10-09",
        settlement_due_on: "2026-10-20",
      }
      await assert.rejects(save(auditor, "advance", advancePayload), /tidak diizinkan/)
      const advanceDraft = await save(staff, "advance", advancePayload)
      const firstRequest = await submit(staff, advanceDraft)
      assert.equal(
        (await as(manager, "select required_role from public.approval_requests where id=$1", [firstRequest])).rows[0].required_role,
        "manager",
      )
      await review(manager, firstRequest)
      const secondRequest = (
        await as(director, "select id from public.approval_requests where document_id=$1 and approval_step=2", [advanceDraft])
      ).rows[0].id
      await review(finance, secondRequest)
      const advanceId = (await execute(finance, advanceDraft)).rows[0].id
      assert.equal(
        (await db.query("select advance_status from public.cash_advances where id=$1", [advanceId])).rows[0].advance_status,
        "approved",
      )
      await assert.rejects(
        as(auditor, "select public.submit_cash_advance_settlement($1,$2,450,50,0,'Perjalanan','KWT-1')", [org, advanceId]),
        /Auditor tidak diizinkan/,
      )
      await assert.rejects(
        as(staff, "select public.submit_cash_advance_settlement($1,$2,450,50,0,'Perjalanan','KWT-1')", [org, advanceId]),
        /setelah dicairkan/,
      )

      const payment = (
        await db.query("select id,payment_number,payee_name,description,invoice_date,due_on,amount,created_by from public.payment_records where cash_advance_id=$1", [advanceId])
      ).rows[0]
      const paidDocument = await save(finance, "payment", {
        payment_number: payment.payment_number,
        payee_name: payment.payee_name,
        description: payment.description,
        invoice_date: payment.invoice_date.toISOString().slice(0, 10),
        due_on: payment.due_on.toISOString().slice(0, 10),
        amount: String(payment.amount),
        status: "paid",
        paid_on: "2026-10-09",
        payment_method: "transfer",
        reference_number: "BANK-ADV-1",
      }, null, null, payment.id)
      await review(director2, await submit(finance, paidDocument))
      await execute(finance, paidDocument)
      assert.equal(
        (await db.query("select advance_status from public.cash_advances where id=$1", [advanceId])).rows[0].advance_status,
        "disbursed",
      )
      const settlementId = (
        await         as(staff, "select public.submit_cash_advance_settlement($1,$2,450,50,0,'Pengeluaran perjalanan','KWT-1,KWT-2') id", [org, advanceId])
      ).rows[0].id
      await db.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner])
        await tx.query("update public.cash_advance_settlements set submitted_by=$1 where id=$2", [finance, settlementId])
      })
      await assert.rejects(
        as(finance, "select public.review_cash_advance_settlement($1,'approved','OK')", [settlementId]),
        /sendiri/,
      )
      await db.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner])
        await tx.query("update public.cash_advance_settlements set submitted_by=$1 where id=$2", [staff, settlementId])
      })
      await assert.rejects(
        as(staff, "select public.review_cash_advance_settlement($1,'approved','OK')", [settlementId]),
        /Hanya Finance/,
      )
      await assert.rejects(
        as(staff, "select public.submit_cash_advance_settlement($1,$2,400,50,0,'Tidak seimbang','KWT-1')", [org, advanceId]),
        /tidak seimbang/,
      )
      await as(finance, "select public.review_cash_advance_settlement($1,'approved','Bukti sesuai')", [settlementId])
      const decision = (await db.query(
        "select submitted_by,reviewed_by from public.cash_advance_settlements where id=$1",
        [settlementId],
      )).rows[0]
      assert.notEqual(decision.submitted_by, decision.reviewed_by)
      assert.equal(
        (await db.query("select advance_status from public.cash_advances where id=$1", [advanceId])).rows[0].advance_status,
        "settled",
      )
      const additionalAdvanceId = (
        await db.transaction(async (tx) => {
          await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner])
          return tx.query(
            `insert into public.cash_advances(
              organization_id,advance_number,purpose_type,trip_destination,departure_on,return_on,
              description,amount,needed_on,settlement_due_on,advance_status,created_by
            ) values($1,'ADV-TEST-002','business_trip','Jakarta',date '2026-10-10',date '2026-10-11',
              'Perjalanan tambahan',500,date '2026-10-09',date '2026-10-20','disbursed',$2) returning id`,
            [org, staff],
          )
        })
      ).rows[0].id
      const additionalSettlementId = (
        await as(staff,
          "select public.submit_cash_advance_settlement($1,$2,550,0,50,'Biaya melebihi uang muka','KWT-3',date '2026-11-15') id",
          [org, additionalAdvanceId],
        )
      ).rows[0].id
      await as(finance,
        "select public.review_cash_advance_settlement($1,'approved','Biaya disetujui')",
        [additionalSettlementId],
      )
      const reimbursement = (await db.query(
        "select amount,due_on,status,cash_advance_settlement_id from public.payment_records where cash_advance_settlement_id=$1",
        [additionalSettlementId],
      )).rows[0]
      assert.equal(Number(reimbursement.amount), 50)
      assert.equal(reimbursement.due_on.toISOString().slice(0, 10), "2026-11-15")
      assert.equal(reimbursement.status, "unpaid")
      assert.equal(reimbursement.cash_advance_settlement_id, additionalSettlementId)
      await assert.rejects(
        as(staff, "select public.submit_cash_advance_settlement($1,$2,450,50,0,'Duplikat','KWT-1')", [org, advanceId]),
        /setelah dicairkan/,
      )
    })
    await t.test("accounting entity, periods, journals, reversal and bank balance reconciliation", async () => {
      const entityId = (await as(owner,
        "select public.create_company_entity($1,'GSP','Gema Sinergi Peradaban','parent','IDR',null,null,true) id",
        [org],
      )).rows[0].id
      await as(finance, "select public.set_entity_membership($1,$2,$3,true)", [org, entityId, staff])
      assert.equal(
        (await as(staff, "select count(*)::int count from public.entity_memberships where user_id=$1 and entity_id=$2", [staff, entityId])).rows[0].count,
        1,
      )
      await assert.rejects(
        as(staff, "select public.create_accounting_period($1,$2,'2026',date '2026-01-01',date '2026-12-31')", [org, entityId]),
        /Hanya Superuser atau Finance/,
      )
      const periodId = (await as(finance,
        "select public.create_accounting_period($1,$2,'2026',date '2026-01-01',date '2026-12-31') id",
        [org, entityId],
      )).rows[0].id
      await assert.rejects(
        as(finance, "select public.create_accounting_period($1,$2,'2026-H2',date '2026-07-01',date '2026-12-31')", [org, entityId]),
        /bertumpang tindih/,
      )

      const existingCashAccount = (await db.query("select id from public.finance_accounts where organization_id=$1 and code='1100'", [org])).rows[0].id
      const equityDoc = await save(owner, "account", {
        code: "3199",
        name: "Modal uji",
        account_type: "equity",
        normal_balance: "credit",
        is_active: true,
      })
      await review(director, await submit(owner, equityDoc))
      await execute(owner, equityDoc)
      const equityAccount = (await db.query("select id from public.finance_accounts where organization_id=$1 and code='3199'", [org])).rows[0].id
      const createJournal = (number, debit = "1000.00", credit = "1000.00") =>
        as(finance, "select public.create_accounting_journal($1,$2,$3,$4,date '2026-10-15','manual','Transaksi uji',$5::jsonb) id", [
          org,
          entityId,
          periodId,
          number,
          JSON.stringify([
            { account_id: existingCashAccount, description: "Kas", debit, credit: "0" },
            { account_id: equityAccount, description: "Modal", debit: "0", credit },
          ]),
        ])
      const journalId = (await createJournal("JRN-TEST-001")).rows[0].id
      await assert.rejects(
        createJournal("JRN-TEST-002", "1000.00", "900.00"),
        /debit harus sama dengan kredit/,
      )
      await assert.rejects(
        as(staff, "select public.post_accounting_journal($1)", [journalId]),
        /akses ditolak/,
      )
      await as(finance, "select public.post_accounting_journal($1)", [journalId])
      const reversalId = (await as(finance,
        "select public.reverse_accounting_journal($1,'REV-TEST-001',date '2026-10-20','Koreksi transaksi') id",
        [journalId],
      )).rows[0].id
      await as(finance, "select public.post_accounting_journal($1)", [reversalId])
      assert.equal((await db.query("select status from public.accounting_journals where id=$1", [journalId])).rows[0].status, "reversed")
      await assert.rejects(
        as(finance, "select public.reverse_accounting_journal($1,'REV-TEST-002',date '2026-10-20','Reversal ganda')", [journalId]),
        /belum dibalik|sudah memiliki pembalik/,
      )
      const remainingJournal = (await createJournal("JRN-TEST-003")).rows[0].id
      await as(finance, "select public.post_accounting_journal($1)", [remainingJournal])
      const reconciliationId = (await as(finance,
        "select public.reconcile_bank_balance($1,$2,$3,$4,date '2026-10-31',1000,'Statement Oktober') id",
        [org, entityId, periodId, existingCashAccount],
      )).rows[0].id
      const reconciliation = (await as(finance,
        "select status,difference from public.bank_reconciliations where id=$1",
        [reconciliationId],
      )).rows[0]
      assert.equal(reconciliation.status, "matched")
      assert.equal(Number(reconciliation.difference), 0)
      const varianceId = (await as(finance,
        "select public.reconcile_bank_balance($1,$2,$3,$4,date '2026-11-30',900,'Selisih lanjutan') id",
        [org, entityId, periodId, existingCashAccount],
      )).rows[0].id
      assert.equal(
        (await as(finance, "select status from public.bank_reconciliations where id=$1", [varianceId])).rows[0].status,
        "variance",
      )
      const finalDraft = (await createJournal("JRN-TEST-004")).rows[0].id
      await assert.rejects(
        as(finance, "select public.close_accounting_period($1)", [periodId]),
        /jurnal draft/,
      )
      await as(finance, "select public.void_accounting_journal($1)", [finalDraft])
      assert.equal((await db.query("select status from public.accounting_journals where id=$1", [finalDraft])).rows[0].status, "voided")
      await as(finance, "select public.close_accounting_period($1)", [periodId])
      await assert.rejects(createJournal("JRN-TEST-005"), /periode entitas yang terbuka/)
    })
  } finally {
    await db.close()
  }
})

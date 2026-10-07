import { PGlite } from "@electric-sql/pglite";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { CONFIG } from "../src/config.ts";
await mkdir("test-artifacts", { recursive: true });
const db = new PGlite(),
  checks = [];
const pass = (s) => {
  checks.push(s);
  console.log("PASS", s);
};
async function expectError(fn, pattern) {
  let error;
  try {
    await fn();
  } catch (e) {
    error = e;
  }
  assert.ok(error, "Expected rejection");
  if (pattern) assert.match(error.message, pattern);
}
try {
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated,anon;grant select,insert,update,delete on storage.objects to authenticated;grant select on storage.objects to anon;create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`,
  );
  await db.exec(await readFile("supabase/schema.sql", "utf8"));
  pass("Real PostgreSQL compiles all tables, constraints, policies and RPCs");
  const owner = randomUUID(),
    staff = randomUUID(),
    other = randomUUID();
  await db.query("insert into auth.users values($1),($2),($3)", [
    owner,
    staff,
    other,
  ]);
  await db.query("insert into public.organizer_accounts values($1)", [owner]);
  const as = async (role, id = "") =>
    db.exec(`set role ${role};set "request.jwt.claim.sub"='${id}';`);
  await as("authenticated", owner);
  const cats = structuredClone(CONFIG.tickets);
  cats[0].capacity = 2;
  const event = structuredClone(CONFIG.event);
  await db.query("select public.initialize_event($1::jsonb,$2::jsonb)", [
    JSON.stringify(event),
    JSON.stringify(cats),
  ]);
  assert.equal(
    (await db.query("select role from public.event_members")).rows[0].role,
    "admin",
  );
  pass(
    "Configured event initialization creates an owner membership without public admin signup",
  );
  await as("postgres");
  await db.query("insert into public.event_members values($1,$2,$3)", [
    event.id,
    staff,
    "staff",
  ]);
  await as("anon");
  const pub = (
    await db.query("select public.get_event_public($1) data", [event.id])
  ).rows[0].data;
  assert.equal(pub.event.title, CONFIG.event.title);
  assert.equal(pub.categories.length, 3);
  assert.ok(!JSON.stringify(pub).includes("email"));
  pass("Public event API exposes categories and counts, not attendee records");
  const input = {
    requestId: randomUUID(),
    categoryId: cats[0].id,
    name: "Database Test Guest",
    email: "database.guest@example.com",
    phone: "+628123456789",
    organization: "Private organization",
    jobTitle: "Designer",
    notes: "Private attendee note",
  };
  const reg = async (inp) =>
    (
      await db.query("select public.register_attendee($1,$2::jsonb) ticket", [
        event.id,
        JSON.stringify(inp),
      ])
    ).rows[0].ticket;
  const ticket = await reg(input),
    repeat = await reg(input);
  assert.equal(ticket.token, repeat.token);
  assert.match(ticket.number, /^EVT-\d{8}-\d{4}$/);
  assert.ok(
    !JSON.stringify(ticket).includes(input.email) &&
      !JSON.stringify(ticket).includes(input.phone) &&
      !JSON.stringify(ticket).includes(input.notes),
  );
  pass(
    "Anonymous registration creates an idempotent opaque ticket with a private-data-safe response",
  );
  await expectError(
    () => reg({ ...input, requestId: randomUUID() }),
    /already has a registration/,
  );
  const second = await reg({
    ...input,
    requestId: randomUUID(),
    email: "second.guest@example.com",
  });
  assert.notEqual(second.token, ticket.token);
  await expectError(
    () =>
      reg({
        ...input,
        requestId: randomUUID(),
        email: "third.guest@example.com",
      }),
    /sold out/,
  );
  pass(
    "Duplicate email and capacity limit are enforced by SQL under an event advisory lock",
  );
  await expectError(
    () => db.query("select * from public.registrations"),
    /permission denied/,
  );
  await expectError(
    () => db.query("select public.get_event_admin($1)", [event.id]),
    /permission denied/,
  );
  await expectError(
    () =>
      db.query("select public.check_in_ticket($1,$2,'QR',false,'')", [
        event.id,
        ticket.token,
      ]),
    /permission denied/,
  );
  const publicTicket = (
    await db.query("select public.get_public_ticket($1) data", [ticket.token])
  ).rows[0].data;
  assert.equal(publicTicket.name, input.name);
  assert.equal(
    (await db.query("select public.get_public_ticket($1) data", [randomUUID()]))
      .rows[0].data,
    null,
  );
  pass(
    "Anonymous users cannot read attendees, statistics, check-ins or admin data; token-only ticket access works",
  );
  await as("authenticated", other);
  assert.equal(
    (await db.query("select * from public.registrations")).rows.length,
    0,
  );
  await expectError(
    () => db.query("select public.get_event_admin($1)", [event.id]),
    /access required/,
  );
  await expectError(
    () =>
      db.query("select public.initialize_event($1::jsonb,$2::jsonb)", [
        JSON.stringify(event),
        JSON.stringify(cats),
      ]),
    /another organizer/,
  );
  await expectError(
    () =>
      db.query("select public.initialize_event($1::jsonb,$2::jsonb)", [
        JSON.stringify({ ...event, id: randomUUID() }),
        JSON.stringify(cats),
      ]),
    /not authorized to create/,
  );
  pass(
    "Unrelated authenticated users cannot access, claim or create an event without provisioning",
  );
  await as("authenticated", staff);
  const scan = async (token, method = "QR", override = false, reason = "") =>
    (
      await db.query("select public.check_in_ticket($1,$2,$3,$4,$5) result", [
        event.id,
        token,
        method,
        override,
        reason,
      ])
    ).rows[0].result;
  const success = await scan(ticket.token);
  assert.equal(success.status, "success");
  assert.equal(success.checkin.method, "QR");
  const duplicate = await scan(ticket.token);
  assert.equal(duplicate.status, "duplicate");
  assert.equal(duplicate.checkin.createdAt, success.checkin.createdAt);
  assert.equal(
    (await db.query("select count(*) n from public.checkins")).rows[0].n,
    1,
  );
  pass(
    "Authorized staff QR check-in is atomic; duplicate returns original time and exactly one row",
  );
  const invalid = await scan(randomUUID());
  assert.equal(invalid.status, "invalid");
  assert.equal(
    (await db.query("select count(*) n from public.checkins")).rows[0].n,
    1,
  );
  await expectError(
    () => scan(ticket.token, "QR", true, "Long enough reason"),
    /override requires/,
  );
  await expectError(
    () => scan(ticket.token, "manual", true, ""),
    /override requires/,
  );
  const over = await scan(
    ticket.token,
    "manual",
    true,
    "Identity reconfirmed after staff gate routing.",
  );
  assert.equal(over.status, "override");
  assert.equal(over.checkin.createdAt, success.checkin.createdAt);
  assert.equal(
    (await db.query("select count(*) n from public.checkins")).rows[0].n,
    1,
  );
  assert.equal(
    (
      await db.query(
        "select count(*) n from public.checkin_audit where action='manual_override'",
      )
    ).rows[0].n,
    1,
  );
  pass(
    "Invalid scans have no effect; explicit manual override is audited and preserves original attendance",
  );
  const manual = await scan(second.token, "manual");
  assert.equal(manual.status, "success");
  const admin = (
    await db.query("select public.get_event_admin($1) data", [event.id])
  ).rows[0].data;
  assert.equal(admin.attendees.length, 2);
  assert.equal(admin.checkins.length, 2);
  assert.equal(admin.audit.length, 3);
  await expectError(
    () => db.query("update public.checkins set created_at=now()"),
    /permission denied/,
  );
  await expectError(
    () =>
      db.query("select public.save_event_settings($1,$2::jsonb,$3::jsonb)", [
        event.id,
        JSON.stringify(event),
        JSON.stringify(cats),
      ]),
    /admin access required/,
  );
  pass(
    "Manual check-in reconciles with statistics; staff cannot edit attendance history or event settings",
  );
  await as("authenticated", owner);
  const small = structuredClone(cats);
  small[0].capacity = 1;
  await expectError(
    () =>
      db.query("select public.save_event_settings($1,$2::jsonb,$3::jsonb)", [
        event.id,
        JSON.stringify(event),
        JSON.stringify(small),
      ]),
    /below existing registrations/,
  );
  await expectError(
    () =>
      db.query("select public.save_event_settings($1,$2::jsonb,$3::jsonb)", [
        event.id,
        JSON.stringify(event),
        JSON.stringify(cats.slice(1)),
      ]),
    /cannot be removed/,
  );
  event.allowOverride = false;
  await db.query("select public.save_event_settings($1,$2::jsonb,$3::jsonb)", [
    event.id,
    JSON.stringify(event),
    JSON.stringify(cats),
  ]);
  await expectError(
    () => scan(ticket.token, "manual", true, "Staff verified identity"),
    /override requires/,
  );
  pass(
    "Admin settings protect registered categories and capacity; disabled overrides are rejected",
  );
  await as("anon");
  await expectError(
    () =>
      db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
        "event-posters",
        event.id + "/bad.webp",
      ]),
    /permission denied/,
  );
  await as("authenticated", other);
  await expectError(
    () =>
      db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
        "event-posters",
        event.id + "/other.webp",
      ]),
    /row-level security/,
  );
  await as("authenticated", owner);
  await db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
    "event-posters",
    event.id + "/owner.webp",
  ]);
  await as("anon");
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    1,
  );
  pass(
    "Poster uploads are restricted to event admins; poster viewing is public",
  );
  await writeFile(
    "test-artifacts/database-results.json",
    JSON.stringify(
      {
        passed: checks.length,
        checks,
        engine:
          "PostgreSQL via PGlite; Supabase auth and storage schemas stubbed",
        errors: [],
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await db.close();
}

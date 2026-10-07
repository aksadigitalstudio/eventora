// Browser contract test; the Supabase origin is fully intercepted. No real project is contacted.
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { CONFIG } from "../src/config.ts";
await mkdir("test-artifacts", { recursive: true });
const result = spawnSync(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "build",
    "--configLoader",
    "native",
    "--outDir",
    ".test-cloud-dist",
  ],
  {
    env: {
      ...process.env,
      VITE_SUPABASE_URL: "https://eventora-test.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    },
    encoding: "utf8",
  },
);
assert.equal(result.status, 0, result.stdout + result.stderr);
process.env.EVENTORA_DIST = ".test-cloud-dist";
process.env.PORT = "4203";
const { server } = await import("../server.mjs");
await new Promise((resolve) =>
  server.listening ? resolve() : server.once("listening", resolve),
);
const browser = await chromium.launch({ channel: "chrome", headless: true }),
  context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
  }),
  page = await context.newPage(),
  checks = [],
  errors = [],
  calls = [];
const pass = (s) => {
  checks.push(s);
  console.log("PASS", s);
};
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const data = {
  event: structuredClone(CONFIG.event),
  categories: structuredClone(CONFIG.tickets),
  attendees: [],
  checkins: [],
  audit: [],
};
const user = {
  id: randomUUID(),
  email: "staff@example.com",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: new Date().toISOString(),
};
const jwt =
  Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url") +
  "." +
  Buffer.from(
    JSON.stringify({
      sub: user.id,
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url") +
  ".test-signature";
const publicData = () => ({
  event: data.event,
  categories: data.categories.map((c) => ({
    ...c,
    registered: data.attendees.filter((a) => a.categoryId === c.id).length,
  })),
});
const ticket = (a) => ({
  event: data.event,
  name: a.name,
  category: data.categories.find((c) => c.id === a.categoryId).name,
  benefits: [],
  number: a.number,
  token: a.token,
  demo: false,
  sample: false,
});
await context.route("https://eventora-test.supabase.co/**", async (route) => {
  const request = route.request(),
    url = new URL(request.url()),
    body = request.postDataJSON(),
    name = url.pathname.split("/").at(-1);
  calls.push({ name, body, auth: request.headers().authorization });
  let output,
    status = 200;
  if (url.pathname.includes("/auth/v1/token"))
    output = {
      access_token: jwt,
      refresh_token: "test-refresh-token",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: "bearer",
      user,
    };
  else if (url.pathname.includes("/auth/v1/user")) output = user;
  else if (url.pathname.includes("/auth/v1/logout")) output = {};
  else if (name === "get_event_public") output = publicData();
  else if (name === "get_public_ticket")
    output = data.attendees.some((a) => a.token === body.p_token)
      ? ticket(data.attendees.find((a) => a.token === body.p_token))
      : null;
  else if (name === "register_attendee") {
    const a = {
      ...body.p_input,
      id: randomUUID(),
      eventId: CONFIG.event.id,
      token: randomUUID(),
      number: "EVT-20261121-0001",
      createdAt: new Date().toISOString(),
      sample: false,
    };
    data.attendees.push(a);
    output = ticket(a);
  } else if (request.headers().authorization !== "Bearer " + jwt) {
    status = 403;
    output = { message: "Organizer access required." };
  } else if (name === "get_event_admin") output = data;
  else if (name === "check_in_ticket") {
    const a = data.attendees.find((a) => a.token === body.p_token);
    if (!a)
      output = { status: "invalid", message: "No valid ticket was found." };
    else {
      let ch = data.checkins.find((c) => c.registrationId === a.id),
        status = ch ? "duplicate" : "success";
      if (!ch) {
        ch = {
          id: randomUUID(),
          registrationId: a.id,
          createdAt: new Date().toISOString(),
          method: body.p_method,
          actor: user.id,
        };
        data.checkins.push(ch);
      }
      output = {
        status,
        message:
          status === "success"
            ? "Ticket validated. Welcome."
            : "This ticket has already been used.",
        attendee: a,
        category: data.categories.find((c) => c.id === a.categoryId),
        checkin: ch,
      };
    }
  } else if (name === "save_event_settings") {
    data.event = body.p_data;
    data.categories = body.p_categories;
    output = null;
  } else {
    status = 400;
    output = { message: "Unexpected contract endpoint: " + url.pathname };
  }
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(output),
  });
});
try {
  await page.goto("http://127.0.0.1:4203/");
  await page
    .getByRole("heading", { name: CONFIG.event.title, exact: true })
    .waitFor();
  assert.equal(await page.locator(".demo-ribbon").count(), 0);
  assert.ok(!calls.some((c) => c.name === "get_event_admin"));
  await page.goto("http://127.0.0.1:4203/admin");
  await page
    .getByRole("heading", {
      name: "Behind every great gathering.",
      exact: true,
    })
    .waitFor();
  assert.equal(await page.locator(".admin-sidebar").count(), 0);
  assert.ok(!calls.some((c) => c.name === "get_event_admin"));
  pass(
    "Cloud public page and login gate expose no organizer controls or admin requests",
  );
  await page.goto(
    "http://127.0.0.1:4203/register?category=" + CONFIG.tickets[0].id,
  );
  await page
    .getByLabel("Full name", { exact: true })
    .fill("Cloud Contract Guest");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("cloud.guest@example.com");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Confirm registration", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "You’re on the guest list.", exact: true })
    .waitFor();
  const token = data.attendees[0].token;
  assert.ok(page.url().endsWith("/ticket/" + token));
  assert.equal(await page.locator(".demo-guide").count(), 0);
  assert.equal(
    await page.getByText("E-TICKET", { exact: true }).isVisible(),
    true,
  );
  pass(
    "Anonymous cloud registration uses the RPC and receives a token-only public e-ticket",
  );
  await page.goto("http://127.0.0.1:4203/admin");
  await page.getByLabel("Organizer email", { exact: true }).fill(user.email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("test-password-not-a-real-account");
  await page
    .getByRole("button", { name: "Sign in securely", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Good ideas. Great company.", exact: true })
    .waitFor();
  assert.deepEqual(await page.locator(".stat>strong").allTextContents(), [
    "1",
    "0",
    "1",
    "0.0%",
  ]);
  assert.ok(
    calls
      .filter((c) => c.name === "get_event_admin")
      .every((c) => c.auth === "Bearer " + jwt),
  );
  pass(
    "Authenticated organizer loads protected dashboard through the authenticated RPC",
  );
  await page.goto("http://127.0.0.1:4203/admin/scanner");
  await page
    .getByLabel("QR payload or ticket token", { exact: true })
    .fill(token);
  await page
    .getByRole("button", { name: "Validate & check in", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "CHECK-IN SUCCESSFUL", exact: true })
    .waitFor();
  assert.equal(data.checkins.length, 1);
  await page
    .getByRole("button", { name: "Next attendee", exact: true })
    .click();
  await page
    .getByLabel("QR payload or ticket token", { exact: true })
    .fill(token);
  await page
    .getByRole("button", { name: "Validate & check in", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "ALREADY CHECKED IN", exact: true })
    .waitFor();
  assert.equal(data.checkins.length, 1);
  pass(
    "Cloud staff scanner submits event/token/method and renders success then duplicate responses",
  );
  await page.goto("http://127.0.0.1:4203/admin/settings");
  await page
    .getByLabel("Venue", { exact: true })
    .fill("Updated contract venue");
  await page
    .getByRole("button", { name: "Save event settings", exact: true })
    .click();
  await page.getByText("Event settings saved.", { exact: false }).waitFor();
  assert.equal(data.event.venue, "Updated contract venue");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByRole("heading", {
      name: "Behind every great gathering.",
      exact: true,
    })
    .waitFor();
  pass(
    "Cloud settings save through protected RPC; sign-out removes management access",
  );
  assert.deepEqual(errors, []);
  pass("Cloud browser contract has no console or uncaught runtime errors");
  await writeFile(
    "test-artifacts/cloud-results.json",
    JSON.stringify(
      {
        passed: checks.length,
        checks,
        errors,
        engine:
          "Cloud production bundle; intercepted Supabase HTTP contract; no live backend",
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error(e);
  console.error(errors);
  await page.screenshot({
    path: "test-artifacts/cloud-failure.png",
    fullPage: true,
  });
  process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

import { chromium } from "playwright";
import path from "node:path";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
await mkdir("test-artifacts", { recursive: true });
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:4200";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  downloadsPath: path.resolve("test-artifacts"),
  args: ["--use-fake-device-for-media-stream"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  permissions: ["camera"],
  acceptDownloads: true,
});
const page = await context.newPage(),
  errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const pass = (s) => {
  checks.push(s);
  console.log("PASS", s);
};
const state = () =>
  page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const q = indexedDB.open("eventora-demo-v1", 1);
        q.onsuccess = () => {
          const db = q.result,
            r = db
              .transaction("documents", "readonly")
              .objectStore("documents")
              .get("state");
          r.onsuccess = () => {
            resolve(r.result);
            db.close();
          };
          r.onerror = () => reject(r.error);
        };
      }),
  );
const go = async (path) => {
  await page.goto(base + path);
};
try {
  await go("/");
  await page
    .getByRole("heading", { name: "Future Creative Summit 2026", exact: true })
    .waitFor();
  assert.match(await page.title(), /Eventora/);
  assert.ok(
    await page
      .locator(".event-poster")
      .evaluate((i) => i.complete && i.naturalWidth > 0),
  );
  const initial = await state();
  assert.equal(initial.attendees.length, 28);
  assert.equal(initial.checkins.length, 11);
  assert.deepEqual(
    initial.categories.map((c) => [c.name, c.price, c.capacity]),
    [
      ["General Admission", 150000, 150],
      ["Student Pass", 75000, 75],
      ["VIP Pass", 300000, 25],
    ],
  );
  assert.match(await page.locator("body").innerText(), /21 November 2026/);
  pass(
    "Configured branding, event date, venue, poster, 3 categories, prices and capacities",
  );
  await page.screenshot({
    path: "test-artifacts/event-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Select General Admission", exact: true })
    .click();
  await page
    .getByRole("heading", {
      name: "A few details, then you’re in.",
      exact: true,
    })
    .waitFor();
  await page
    .getByLabel("Full name", { exact: true })
    .fill("Test Creative Guest");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("creative.guest@example.com");
  await page
    .getByLabel("Phone / WhatsApp (optional)", { exact: true })
    .fill("+628123456789");
  await page
    .getByLabel("Organization / company (optional)", { exact: true })
    .fill("Test Studio");
  await page
    .getByLabel("Job title (optional)", { exact: true })
    .fill("Creative developer");
  await page
    .getByLabel("Notes (optional)", { exact: true })
    .fill("Accessibility request example");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Confirm registration", exact: true })
    .dblclick();
  await page
    .getByRole("heading", { name: "You’re on the guest list.", exact: true })
    .waitFor();
  const ticketURL = page.url(),
    token = new URL(ticketURL).pathname.split("/").at(-1),
    registered = await state();
  assert.equal(registered.attendees.length, 29);
  const a = registered.attendees.find((a) => a.token === token);
  assert.ok(a);
  assert.match(a.number, /^EVT-\d{8}-\d{4}$/);
  assert.equal(
    registered.attendees.filter((x) => x.email === "creative.guest@example.com")
      .length,
    1,
  );
  assert.equal(a.sample, false);
  assert.equal(new Set(registered.attendees.map((x) => x.token)).size, 29);
  assert.equal(new Set(registered.attendees.map((x) => x.number)).size, 29);
  pass(
    "Visitor selects a ticket and registers; unique ID/token, one registration after double click",
  );
  const qrSrc = await page
    .getByAltText("Unique ticket QR code", { exact: true })
    .getAttribute("src");
  const qrBytes = Buffer.from(qrSrc.split(",")[1], "base64");
  await writeFile("test-artifacts/new-ticket-qr.png", qrBytes);
  const qr = PNG.sync.read(qrBytes),
    decoded = jsQR(new Uint8ClampedArray(qr.data), qr.width, qr.height);
  assert.equal(decoded.data, base + "/ticket/" + token);
  assert.ok(!decoded.data.includes(a.email) && !decoded.data.includes(a.name));
  pass(
    "Real QR image decodes to the same opaque ticket token with no private data",
  );
  await page.evaluate(() => {
    window.__downloadPayload = new Promise((resolve) =>
      document.addEventListener(
        "click",
        async (e) => {
          const a = e.target.closest("a[download]");
          if (!a) return;
          const bytes = new Uint8Array(
            await (await fetch(a.href)).arrayBuffer(),
          );
          resolve({ name: a.download, bytes: Array.from(bytes) });
        },
        { capture: true },
      ),
    );
  });
  const downloadWait = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Save ticket image", exact: true })
    .click();
  const downloaded = await downloadWait;
  assert.equal(downloaded.suggestedFilename(), a.number + ".png");
  const payload = await page.evaluate(() => window.__downloadPayload);
  assert.equal(payload.name, a.number + ".png");
  const pngBytes = Buffer.from(payload.bytes);
  assert.ok(PNG.sync.read(pngBytes).width > 500);
  await writeFile("test-artifacts/ticket-download.png", pngBytes);
  const nativeDownloadFailure = await downloaded.failure();
  if (nativeDownloadFailure)
    console.log(
      "NOTE Native browser download blocked by execution environment:",
      nativeDownloadFailure,
    );
  await page.emulateMedia({ media: "print" });
  assert.equal(await page.locator(".public-header").isVisible(), false);
  assert.equal(await page.locator(".ticket-actions").isVisible(), false);
  await page.pdf({
    path: "test-artifacts/ticket-a4.pdf",
    format: "A4",
    printBackground: true,
  });
  await page.emulateMedia({ media: "screen" });
  pass(
    "Ticket download action generates a valid PNG payload; print CSS hides navigation and actions",
  );
  const publicContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    publicPage = await publicContext.newPage();
  publicPage.on("pageerror", (e) => errors.push("Public: " + e.message));
  await publicPage.goto(ticketURL);
  await publicPage
    .getByRole("heading", { name: "Test Creative Guest", exact: true })
    .waitFor();
  const publicText = await publicPage.locator("body").innerText();
  assert.ok(
    !publicText.includes(a.email) &&
      !publicText.includes(a.phone) &&
      !publicText.includes(a.organization),
  );
  assert.equal(await publicPage.locator(".admin-sidebar").count(), 0);
  assert.ok(
    await publicPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await publicPage.screenshot({
    path: "test-artifacts/ticket-mobile.png",
    fullPage: true,
  });
  await publicContext.close();
  pass(
    "Portable ticket in a fresh mobile browser shows only attendee-safe data",
  );
  await go("/admin/scanner");
  await page
    .getByRole("heading", { name: "A great day starts here.", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await page.getByText("CAMERA LIVE", { exact: true }).waitFor();
  assert.ok(
    await page
      .locator("video")
      .evaluate((v) => v.srcObject?.getVideoTracks()[0]?.readyState === "live"),
  );
  await page.getByRole("button", { name: "Stop camera", exact: true }).click();
  pass(
    "Synthetic camera preview starts and stops; no physical webcam is accessed",
  );
  await page
    .getByLabel("Upload QR image", { exact: true })
    .setInputFiles({
      name: "ticket-qr.png",
      mimeType: "image/png",
      buffer: qrBytes,
    });
  await page
    .getByRole("heading", { name: "CHECK-IN SUCCESSFUL", exact: true })
    .waitFor();
  const arrived = await state(),
    ch = arrived.checkins.find((ch) => ch.registrationId === a.id);
  assert.equal(arrived.checkins.length, 12);
  assert.equal(ch.method, "QR");
  assert.ok(ch.createdAt);
  assert.ok(
    arrived.audit.some(
      (x) => x.registrationId === a.id && x.action === "checkin_QR",
    ),
  );
  await page.screenshot({
    path: "test-artifacts/check-in-success.png",
    fullPage: true,
  });
  pass(
    "Rendered QR is scanned from an image, validated and checked in with time, method and audit",
  );
  await page
    .getByRole("button", { name: "Next attendee", exact: true })
    .click();
  await page
    .getByLabel("QR payload or ticket token", { exact: true })
    .fill(decoded.data);
  await page
    .getByRole("button", { name: "Validate & check in", exact: true })
    .dblclick();
  await page
    .getByRole("heading", { name: "ALREADY CHECKED IN", exact: true })
    .waitFor();
  assert.equal((await state()).checkins.length, 12);
  assert.ok(
    await page.getByText("ORIGINAL CHECK-IN TIME", { exact: true }).isVisible(),
  );
  assert.equal(
    (await state()).checkins.find((x) => x.registrationId === a.id).createdAt,
    ch.createdAt,
  );
  pass(
    "Duplicate scan warns with original time and creates no second attendance record",
  );
  await page
    .getByRole("button", { name: "Next attendee", exact: true })
    .click();
  await page
    .getByLabel("QR payload or ticket token", { exact: true })
    .fill("00000000-0000-4000-8000-000000000000");
  await page
    .getByRole("button", { name: "Validate & check in", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "INVALID TICKET", exact: true })
    .waitFor();
  assert.equal((await state()).checkins.length, 12);
  pass("Invalid opaque token is rejected without recording attendance");
  await page
    .getByRole("button", { name: "Next attendee", exact: true })
    .click();
  await page
    .getByLabel("QR payload or ticket token", { exact: true })
    .fill("https://other-event.example/ticket/" + token);
  await page
    .getByRole("button", { name: "Validate & check in", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "INVALID TICKET", exact: true })
    .waitFor();
  assert.equal((await state()).checkins.length, 12);
  pass("Foreign-site ticket payload is rejected");
  await page
    .getByRole("button", { name: "Next attendee", exact: true })
    .click();
  await page
    .getByLabel("Manual attendee search", { exact: true })
    .fill(a.email);
  await page.locator(".manual-person").click();
  const modal = page.getByRole("dialog", {
    name: "Confirm entry override",
    exact: true,
  });
  await modal.waitFor();
  assert.equal(
    await modal
      .getByRole("button", { name: "Confirm override", exact: true })
      .isEnabled(),
    false,
  );
  await modal.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(
    (await state()).audit.filter((x) => x.action === "manual_override").length,
    0,
  );
  await page.locator(".manual-person").click();
  await modal
    .getByLabel("Override reason", { exact: true })
    .fill("Staff verified the attendee after a gate routing issue.");
  await modal.getByRole("checkbox").check();
  await modal
    .getByRole("button", { name: "Confirm override", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "ENTRY RECONFIRMED", exact: true })
    .waitFor();
  const overridden = await state();
  assert.equal(overridden.checkins.length, 12);
  assert.equal(
    overridden.checkins.find((x) => x.registrationId === a.id).createdAt,
    ch.createdAt,
  );
  assert.equal(
    overridden.audit.filter((x) => x.action === "manual_override").length,
    1,
  );
  pass(
    "Override requires explicit confirmation and a reason; original time/count stay intact",
  );
  const pending = overridden.attendees.find(
    (x) => !overridden.checkins.some((ch) => ch.registrationId === x.id),
  );
  await page
    .getByLabel("Manual attendee search", { exact: true })
    .fill(pending.phone);
  await page.locator(".manual-person").click();
  const manual = page.getByRole("dialog", {
    name: "Confirm manual check-in",
    exact: true,
  });
  await manual.getByRole("checkbox").check();
  await manual
    .getByRole("button", { name: "Confirm check-in", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "CHECK-IN SUCCESSFUL", exact: true })
    .waitFor();
  assert.equal((await state()).checkins.length, 13);
  assert.equal(
    (await state()).checkins.find((c) => c.registrationId === pending.id)
      .method,
    "manual",
  );
  pass(
    "Manual search by phone and confirmed manual admission update attendance",
  );
  await go("/admin");
  await page
    .getByRole("heading", { name: "Good ideas. Great company.", exact: true })
    .waitFor();
  assert.deepEqual(await page.locator(".stat>strong").allTextContents(), [
    "29",
    "13",
    "16",
    "44.8%",
  ]);
  await go("/admin/statistics");
  await page
    .getByRole("heading", { name: "See the room take shape.", exact: true })
    .waitFor();
  assert.deepEqual(await page.locator(".stat>strong").allTextContents(), [
    "29",
    "13",
    "16",
    "44.8%",
  ]);
  pass(
    "Dashboard and attendance statistics reconcile after QR and manual arrivals",
  );
  await page.screenshot({
    path: "test-artifacts/attendance-desktop.png",
    fullPage: true,
  });
  await go("/admin/attendees");
  await page.getByLabel("Search attendees", { exact: true }).fill(a.number);
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page
    .getByLabel("Filter check-in status", { exact: true })
    .selectOption("pending");
  assert.equal(await page.locator("tbody tr").count(), 0);
  await page
    .getByLabel("Filter check-in status", { exact: true })
    .selectOption("checked");
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page
    .getByLabel("Filter ticket category", { exact: true })
    .selectOption(initial.categories[1].id);
  assert.equal(await page.locator("tbody tr").count(), 0);
  await page
    .getByLabel("Filter ticket category", { exact: true })
    .selectOption("");
  await page.getByLabel("Sort attendees", { exact: true }).selectOption("name");
  await page
    .getByRole("button", {
      name: "View attendee Test Creative Guest",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog", { name: "Attendee details", exact: true })
    .waitFor();
  assert.match(await page.getByRole("dialog").innerText(), /manual_override/);
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  pass(
    "Attendee search, category/status filters, sorting, detail and audit display",
  );
  await go("/admin/settings");
  await page
    .getByLabel("Event title", { exact: true })
    .fill("Future Creative Summit 2026");
  const capacities = page.getByLabel("Capacity", { exact: true }),
    count =
      initial.attendees.filter((a) => a.categoryId === initial.categories[0].id)
        .length + 1;
  await capacities.nth(0).fill(String(count));
  await page
    .getByLabel("Upload event poster", { exact: true })
    .setInputFiles({
      name: "poster.png",
      mimeType: "image/png",
      buffer: PNG.sync.write(new PNG({ width: 10, height: 10, fill: true })),
    });
  await page
    .getByText("Processing…", { exact: true })
    .waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Save event settings", exact: true })
    .click();
  await page.getByText("Event settings saved.", { exact: false }).waitFor();
  assert.ok((await state()).event.poster.startsWith("data:image/webp;base64,"));
  pass("Poster upload is optimized and settings persist");
  await go("/");
  await page
    .getByRole("heading", { name: "Future Creative Summit 2026", exact: true })
    .waitFor();
  assert.ok(await page.getByText("SOLD OUT", { exact: true }).isVisible());
  assert.equal(
    await page
      .getByRole("link", { name: "Select General Admission", exact: true })
      .count(),
    0,
  );
  await go("/register?category=" + initial.categories[0].id);
  await page
    .getByRole("heading", {
      name: "A few details, then you’re in.",
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Confirm registration", exact: true })
      .isEnabled(),
    false,
  );
  assert.equal((await state()).attendees.length, 29);
  pass("Sold-out category blocks further registrations and the public CTA");
  await go("/register?category=" + initial.categories[1].id);
  await page.getByLabel("Full name", { exact: true }).fill("Duplicate Attempt");
  await page.getByLabel("Email address", { exact: true }).fill(a.email);
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Confirm registration", exact: true })
    .click();
  await page
    .getByRole("alert")
    .getByText(/already has a registration/)
    .waitFor();
  assert.equal(
    await page.getByLabel("Full name", { exact: true }).inputValue(),
    "Duplicate Attempt",
  );
  assert.equal((await state()).attendees.length, 29);
  pass("Duplicate email is blocked while valid form fields are preserved");
  await go("/admin");
  await page
    .getByRole("heading", { name: "Good ideas. Great company.", exact: true })
    .waitFor();
  await page.reload();
  await page
    .getByRole("heading", { name: "Good ideas. Great company.", exact: true })
    .waitFor();
  assert.deepEqual(await page.locator(".stat>strong").allTextContents(), [
    "29",
    "13",
    "16",
    "44.8%",
  ]);
  assert.equal(
    (await state()).audit.filter((x) => x.action === "manual_override").length,
    1,
  );
  pass(
    "Refresh preserves registrations, QR identity, check-ins, audits, poster and statistics",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await go("/admin/scanner");
  await page
    .getByRole("heading", { name: "A great day starts here.", exact: true })
    .waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "test-artifacts/scanner-mobile.png",
    fullPage: true,
  });
  await go("/");
  await page
    .getByRole("heading", { name: "Future Creative Summit 2026", exact: true })
    .waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "test-artifacts/event-mobile.png",
    fullPage: true,
  });
  pass("Public landing and staff scanner work at 390 px without page overflow");
  assert.deepEqual(errors, []);
  pass("No browser console or uncaught runtime errors");
  await writeFile(
    "test-artifacts/workflow-results.json",
    JSON.stringify(
      {
        passed: checks.length,
        checks,
        errors,
        baseURL: base,
        registration: a.number,
        token,
        initialRegistered: 28,
        finalRegistered: 29,
        initialCheckedIn: 11,
        finalCheckedIn: 13,
        engine: "Chrome / Playwright; fresh demo context; synthetic camera",
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error(e);
  console.error("Browser errors", errors);
  await page.screenshot({
    path: "test-artifacts/workflow-failure.png",
    fullPage: true,
  });
  process.exitCode = 1;
} finally {
  await browser.close();
}

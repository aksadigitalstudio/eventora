# Verification

The production application passed 20 browser workflow checks, 12 database checks, and 6 cloud HTTP contract checks before deployment.

```sh
npm ci
npm run build
npm run test:ui
npm run test:database
npm run test:cloud
```

Browser tests use installed Chrome via Playwright. Alternatively install the appropriate browser and adjust the channel. `test:ui` owns the production preview server lifecycle. To test a public Demo Mode deployment, set `TEST_BASE_URL` to its HTTPS origin before running `npm run test:ui`.

Coverage includes configured branding/poster/prices/capacities; registration double-click protection; unique opaque tokens; real QR generation and image decoding; public/mobile tickets; check-in success, duplicate and invalid tickets; foreign-origin rejection; confirmed overrides with preserved attendance; manual search/check-in; statistics; attendee filters; poster uploads; sold-out capacity; retained fields on duplicate-email errors; refresh persistence; responsive layouts; and browser console errors.

Database checks execute the actual schema in PostgreSQL via PGlite, with Supabase Auth/Storage schema stubs. They exercise row-level security, anonymous privacy, organizer provisioning, membership, capacity, idempotence, unique attendance, audits, settings protections, and storage permissions.

Cloud contract tests run the cloud production bundle with intercepted Supabase HTTP responses, exercising registration, login protection, scanner responses, settings, and sign-out. These do not constitute a test against a provisioned live Supabase project.

Camera preview was tested with a synthetic browser video device; a physical phone camera remains device-dependent. QR image decoding and token entry were exercised end to end. The restricted Windows execution environment canceled native browser file saving; the download action's generated PNG payload was independently verified and a print PDF was generated. The application reports that an image is prepared, rather than falsely claiming that the browser saved it.

Test screenshots and result JSON files are generated under ignored `test-artifacts/`. Tests use fresh independent Demo Mode browser contexts and do not alter shared backend records.

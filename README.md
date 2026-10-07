# Eventora

An event registration, e-ticket and QR check-in application for Future Creative Summit 2026, organized by AKSA Studio. React, TypeScript and Vite; deployable as a static website. Event and ticket configuration lives in `src/config.ts`.

## Run locally

Use Node.js 22.18 or newer (Node.js 24 recommended).

```sh
npm ci
npm start
```

Open http://127.0.0.1:4200. For development use `npm run dev`. Production output is `dist`; `vercel.json` includes SPA routing.

## Demo Mode

Without backend environment variables, the application uses persistent IndexedDB storage. It starts with 28 clearly labeled sample registrations, including 11 checked-in attendees. Each browser has its own independent data; this mode is for testing, not operating a shared real event.

Visit the public event page, choose a ticket, register, and open the e-ticket. Open `/admin/scanner` to scan the ticket image, use the camera, or paste its URL/token. The organizer dashboard is openly accessible **only in Demo Mode**. Duplicate scans display the original check-in time and do not increase attendance. Manual overrides require identity confirmation and a reason, preserve the original timestamp, and add an audit entry.

The e-ticket's Copy ticket link action includes a portable, attendee-safe demo snapshot for viewing in another browser. A portable snapshot is explicitly unverified and cannot create attendance in a different browser's dataset. Real backend tickets instead resolve their opaque token against shared server records.

Camera scanning needs HTTPS or localhost and browser permission. QR image upload and token entry provide fallbacks. Printing supports Save as PDF; Save ticket view generates a PNG. Registration does not collect payment or claim that payment/email delivery occurred.

## Enable Supabase

1. Create a Supabase project and run `supabase/schema.sql` in its SQL editor. The schema creates constrained tables, row-level security, RPCs, and the poster storage bucket.
2. Create an organizer user in Supabase Authentication. Public admin signup is not offered; disable public signup for an organizer-only deployment.
3. Provision that user's Auth UUID using the SQL editor:

```sql
insert into public.organizer_accounts(user_id) values ('YOUR-AUTH-USER-UUID');
```

4. Set both client-safe build environment variables, using `.env.example` locally or Vercel environment settings:

```text
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-OR-ANON-KEY
```

Never supply a service-role key, database password, or privileged credential to the browser. Rebuild after configuring environment variables. A partial configuration produces an error instead of silently falling back to Demo Mode.

5. Sign in at `/admin` and initialize the configured event. Backend mode starts without demo registrations. Only pre-provisioned organizers may initialize events.
6. To add staff, first create their Auth user, then insert their UUID into `public.event_members` with the configured event ID and `role = 'staff'`. Staff may manage check-in; event settings require the admin role. The configured event ID is in `src/config.ts`.

Anonymous visitors can register and view an individual token-addressed ticket; private attendee lists and management operations require event membership. Registration capacity is checked under a database lock; check-in is atomic with a unique attendance row per registration. Uploaded posters are limited by type/size and writable only by event administrators.

## Deploy

Import this repository into Vercel, select Vite, use `npm run build`, and publish `dist`. Leave the Supabase variables unset for a public Demo Mode deployment. Configure them and provision the organizer before using the application for a real shared event. See `TESTING.md` for verification and limitations.

# Syllabus AI

A React 19 / Vite 8 study workspace with a dark dashboard, subject and topic management, an editable planner, calendar, real progress analytics, and optional Gemini syllabus extraction and coaching.

The interface uses a dark neobrutalist theme with pitch-black (`#0f1108`) backgrounds, spring-green (`#27fb6b`) actions, square solid panels, bold borders and hard offset shadows. Text-led navigation, an interactive sample preview, and the custom animated Three.js syllabus weave retain pause, reduced-motion and static fallback support. Older light/system preferences load as dark while preserving study data. The latest visual changes are recorded in `output/audit/NEOBRUTAL-THEME.md`; the sculpture is documented in `output/audit/GLASS-WEAVE.md` and backend verification in `output/audit/PREMIUM-FRONTEND.md`.

## Run locally

Requires Node.js 22.12+ (Node 24 recommended).

```powershell
npm ci
npm run setup:services
npm run dev
```

Open http://127.0.0.1:3000. The web app runs on port 3000 and the API on 3001. You can explore a local sample workspace without credentials. Manual onboarding, topic editing, planning, analytics, and JSON export work without AI or Firebase.

## Enable cloud accounts

Fill all six public `VITE_FIREBASE_*` settings in `.env`. Enable Google authentication in Firebase and allow your app's domain. Create Firestore, then deploy the repository's rules and indexes to your own project. Set `FIREBASE_PROJECT_ID` and provide server credentials through Application Default Credentials, workload identity, or `GOOGLE_APPLICATION_CREDENTIALS` pointing to a file outside this repository. Restart development after changing environment settings.

Account workspaces use an atomic versioned manifest plus chunks under `users/{uid}/workspaces/main`. The app validates records on load and before edits, keeps an account-specific browser recovery copy, and refuses stale cloud writes. A load failure blocks editing and saving. Export your local edits before choosing **Reload cloud data**, which discards unsent local recovery data.

Older syllabus/topic/progress records are read into the current model when no workspace exists. Original documents are retained. Completed legacy topics migrate; old daily plan/progress records do not provide trustworthy completed study durations, so no study-hour history is invented.

## Enable AI

Set `GEMINI_API_KEY` on the server only. Set `ALLOW_LOCAL_AI=true` to permit requests through localhost development without signing in. Production always verifies Firebase ID tokens. `GEMINI_MODEL` is configurable; the default is `gemini-2.5-flash`. Provider access, billing, and model availability depend on your account.

Onboarding imports topics separately for each subject. Manual input maps one line to one topic with a 45-minute editable estimate. AI accepts TXT, PDF, DOCX, PNG, JPEG, and WebP up to 10 MB, validates extracted topics, and presents editable estimates. Coach messages and selected workspace context are sent to Gemini. Chat history is stored per account in this browser. Requests have limits, cancellation, and timeout handling.

No API keys belong in client code, logs, commits, or exported examples. The reminder panel displays actual upcoming sessions while the app is open; optional server delivery is configured separately in Settings.

## Stripe subscriptions

Start with Stripe test mode. Set `STRIPE_SECRET_KEY`, an active fixed-amount recurring `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, and `APP_URL`. Configure the customer portal in Stripe. Checkout uses the server-selected price and the signed-in account's customer; payment entitlements update only from signed Stripe events, not the return URL. The Settings page shows the actual configured price and offers Checkout, the customer portal, and status refresh.

Register `https://YOUR_DOMAIN/api/billing/webhook` for `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, and `invoice.payment_failed`. For localhost, use Stripe CLI forwarding to `http://127.0.0.1:3001/api/billing/webhook` and put its signing secret in your local `.env`. Do not mix test and live prices, keys, or webhook secrets. Complete a test Checkout, confirm the webhook updates the account, then test renewal failure and cancellation before enabling live billing.

`BILLING_REQUIRED=false` is the default. Set it to `true` to require an active/trialing subscription for AI, email, and push; manual planning remains available. Private billing records are written only by the server. Event IDs and creation times prevent replay/stale changes, and older subscriptions cannot replace a newer subscription. Firestore rules must be deployed before use.

## SMTP email and Web Push

Set `SMTP_HOST`, `SMTP_PORT` (587 STARTTLS or 465 TLS), `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`. Use a sender authorized by your mail provider and configure its SPF/DKIM/DMARC records. Delivery targets only the signed-in Firebase user's verified email. In Settings, choose session email reminders and/or the Monday weekly digest, save preferences, and use **Send test email to me** to check inbox delivery. SMTP acceptance does not prove inbox delivery.

`npm run setup:services` prepares the ignored `.env`, preserves existing settings, and generates a matching VAPID key pair without printing it. Set `VAPID_SUBJECT` to your public `mailto:` contact or HTTPS site URL. Keep the private key server-only and retain the pair across deployments. Use **Enable this browser** after signing in, grant browser permission, and save push delivery preferences. Use **Send test push to my browsers** to confirm receipt. Expired subscriptions are removed; browser subscriptions are scoped to accounts and removed on sign-out. HTTPS is required except on localhost. On iOS/iPadOS, install to the Home Screen first. Browser/OS settings can delay or suppress notifications.

Set your IANA time zone (for example `Asia/Kolkata`) and a lead time of 5–60 minutes. Planned sessions become due from that lead time until five minutes after the start; completed sessions are skipped. Weekly digests use recorded study hours from the previous Monday–Sunday, sent on Monday between 09:00 and 18:00 local time.

Enable `NOTIFICATION_WORKER_ENABLED=true` on an always-running Node server to scan every minute. On platforms that suspend processes, schedule `npm run notifications:once` every minute using the same environment and Firebase credentials. Keep the built-in worker disabled if using an external scheduler. Cloud workspaces and private delivery jobs are stored in Firestore. Durable leases, per-channel delivery state, and retry backoff prevent routine duplicate delivery; SMTP cannot guarantee exactly-once delivery if the process crashes after acceptance but before recording success. Retain stable message IDs and monitor worker failures. A paused scheduler can miss a session's delivery window.

## Check provider readiness

Run `npm run services:check` after filling `.env`. It checks Admin Auth/Firestore access, the configured Gemini model, Stripe's recurring price, SMTP authentication/TLS, and VAPID pairing. It prints status only, never credentials. It makes one small Gemini request when configured; it does not create charges or send email/push. Missing or failed settings return exit code 1. Interactive Google sign-in, cross-device cloud sync, real document interpretation/coaching, webhook delivery, inbox delivery, and actual browser push receipt still require live verification.

## Validate

```powershell
npm run typecheck
npm run lint
npm test
npm run test:rules
npm run test:e2e
npm run test:production
npm run build
npm audit
```

Rules tests need Java 21+ and use only the local Firebase emulator with `demo-syllabus-ai`. Browser tests use installed Chrome locally (needed on this Windows host); CI installs Playwright Chromium. If Chrome is missing, install it or change the Playwright channel to an available browser. `npm run clean` safely removes only this checkout's build output.

## Production

For Firebase Hosting with the existing API and scheduled notifications, follow [docs/FIREBASE-PRODUCTION.md](docs/FIREBASE-PRODUCTION.md). It uses the separate `firebase.production.json`, a non-root Node API image, Cloud Run, Secret Manager and a Cloud Scheduler-triggered job. The default `firebase.json` remains a static-site configuration. No cloud deployment has been performed.

```powershell
npm run build
$env:NODE_ENV='production'
$env:PORT='3001'
npm start
```

The Express server serves the built app and `/api` from one origin. Place it behind HTTPS and configure Firebase's authorized domains and server credentials. `vite preview` and Firebase Hosting alone serve only static assets: they do not provide the API. If using Firebase Hosting, configure an `/api` rewrite to your deployed backend before the catch-all HTML rewrite. Do not expose development's unauthenticated local AI setting publicly.

Review and supply deployment-specific privacy/contact information before public launch. The included privacy and terms sections describe storage and feature behavior; they are not a substitute for the operator's policy.

## Architecture and repair evidence

- `src/components/ProductViews.tsx`: active workspace screens, dialogs, validation, imports, coaching.
- `src/components/SyllabusWeave.tsx`, `src/visuals`: custom Three.js hero with five pleated course ribbons, moving edge lights and pointer response. It loads near the viewport, caps rendering at 30 fps and pixel ratio at 1.5, pauses offscreen/in hidden tabs, releases GPU resources on navigation, and uses static SVG when WebGL2 is unavailable. A text pause button and live reduced-motion preference control animation. The sculpture and fallback use the black/green palette within a solid bordered frame.
- `src/domain`: record validation, planning, completion/history updates.
- `src/hooks/useDemoState.ts`: local and account-scoped persistence lifecycle.
- `src/services/workspaceService.ts`: transactional cloud chunks and legacy migration.
- `server/api.mjs`: authenticated AI and account API, raw signed Stripe webhook.
- `server/integrations.mjs`, `server/store.mjs`: server-owned billing, email preferences, browser subscriptions, and private Firestore storage.
- `server/notifications.mjs`, `server/worker.mjs`, `public/sw.js`: scheduled email/push delivery, durable retry state, and browser notification handling.
- `components/ui`: reusable Base UI primitives; active dialogs reuse the same Base UI library.
- Older `Dashboard`, `StudyPlanner`, `SyllabusUpload`, `Layout`, and `SyllabiList` components remain for source/history compatibility and are not routes of the active app. Their planner and batch data operations were also repaired.

The initial audit is in `output/audit/AUDIT.md`; repairs and verification are tracked in `output/audit/REPAIRS.md`. Existing local edits were retained. No cloud deployment or live provider request is implied by local test results.

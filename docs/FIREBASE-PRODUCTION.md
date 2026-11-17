# Firebase production setup for Syllabus AI

This app has a Vite frontend and an Express backend. Use Firebase Hosting for the frontend, Firebase Auth and Firestore for accounts/data, Cloud Run for the existing API, and a Cloud Run Job triggered by Cloud Scheduler for background notifications. All resources belong to the same Firebase/Google Cloud project. Hosting alone cannot execute the API or notification worker.

The repository currently selects `syllabus-ai-c35aa` in `.firebaserc`. Confirm that this is your intended production project before running deployment commands. Commands below use an explicit project. No cloud deployment has been performed by this guide.

## 1. Project, tools and billing

- Install Node.js 24 and Google Cloud CLI (`gcloud`). Firebase CLI is already a project dependency; invoke it with `npx firebase`.
- Enable the Firebase **Blaze** plan by attaching a Google Cloud billing account. Cloud Run, builds/images, secrets, Scheduler, Firestore usage, Gemini and other providers may incur charges. Set billing alerts and provider spending limits; budget alerts do not stop charges.
- Use a separate staging Firebase project with Stripe test-mode settings to verify the full release before live payments. Do not run delivery tests against real users.
- The example backend region is `asia-south1` (Mumbai), supported by Firebase Hosting rewrites. Choose a region near your users and Firestore, then keep it identical in all commands and `firebase.production.json`. Choose the Firestore location carefully at creation; it cannot be changed in place.

Run from the repository root in PowerShell:

```powershell
$projectId = 'syllabus-ai-c35aa'
$region = 'asia-south1'
$appOrigin = "https://$projectId.web.app"
npx firebase login
gcloud auth login
gcloud config set project $projectId
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com cloudscheduler.googleapis.com firestore.googleapis.com identitytoolkit.googleapis.com
```

The deployer needs permission to enable APIs, manage secrets/IAM and deploy Hosting/Firestore/Cloud Run. Cloud Run source deployment specifically needs Cloud Run Source Developer, Service Usage Consumer and Service Account User on the runtime identity. The source build service account needs Cloud Run Builder. Project administration may be needed for the initial IAM setup; do not assign Owner to the application runtime.

## 2. Firebase Auth and Firestore

In Firebase Console:

1. **Project settings → General → Your apps**: register a Web app and copy its Firebase config values into the six `VITE_FIREBASE_*` settings below.
2. **Authentication → Sign-in method**: enable Google and set the support email.
3. **Authentication → Settings → Authorized domains**: include your production Hosting domain and any custom app domain. Add `localhost` only if you need local login. Verify both sign-in and sign-out on the final HTTPS domain.
4. Create **Cloud Firestore** in Native mode. The simplest setup uses the `(default)` database; leave `VITE_FIREBASE_DATABASE_ID` blank. If using a named database, use the same ID in frontend and backend and adjust Firebase CLI's database-specific rules/indexes configuration before deployment; the provided configuration targets the default database.
5. Deploy the repository's rules, which isolate user workspaces and keep billing/delivery collections server-only. Do not switch to permissive test rules.

Firebase Storage, Analytics and Firebase Cloud Messaging are not required by the current implementation. Uploaded syllabus files go through the authenticated API; browser notifications use standard Web Push/VAPID. Still copy all six Web app config fields because the app requires them to enable sign-in.

Prepare the ignored local settings:

```powershell
npm ci
npm run setup:services
```

Edit `.env` locally. Do not print or commit its contents:

| Frontend build setting | Value |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Firebase Web app config `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Config `authDomain`, typically PROJECT_ID.firebaseapp.com |
| `VITE_FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Config `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Config `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | Config `appId` |
| `VITE_FIREBASE_DATABASE_ID` | Blank for `(default)` |
| `VITE_AI_API_URL` | `/api` |

These public settings are embedded during `npm run build`; changing Cloud Run runtime variables does not change the frontend bundle. Rebuild and redeploy Hosting after changing them. Never give a private provider key a `VITE_` prefix.

## 3. Gemini, Stripe, SMTP and Web Push

| Service | Configure |
| --- | --- |
| Gemini | Obtain a server API key in Google AI Studio, enable the required billing/quota for that account, and confirm access to `GEMINI_MODEL` (default `gemini-2.5-flash`). Use a dedicated server key with an API restriction appropriate to the Generative Language API. Browser-referrer restrictions are unsuitable for this server-side key. |
| Stripe | Complete Stripe account activation and payout details for live payments. Create a fixed-amount recurring Product/Price in the intended currency. Set `STRIPE_PRICE_ID`; enable the customer portal. Use Stripe sandbox/test keys for staging. Live mode requires a live recurring Price and live secrets. |
| Stripe webhook | Create `APP_ORIGIN/api/billing/webhook`, selecting the six events below. Save the endpoint signing secret separately from the Stripe API secret. Do not reuse Stripe CLI's localhost signing secret for the deployed endpoint. |
| SMTP | Obtain `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`. Use 587 STARTTLS or 465 TLS, an authorized sender/domain, and provider SPF/DKIM/DMARC records. Cloud Run outbound port 25 is unsuitable. |
| Web Push | `npm run setup:services` generates a stable matching `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` pair without printing it. Set `VAPID_SUBJECT` to a real `mailto:` support contact or HTTPS URL. Retain the same pair across releases; changing it requires browsers to subscribe again. |

Stripe events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

In **Google Cloud Console → Secret Manager**, create these five secrets, entering values privately. The command examples use version `1`; when rotating credentials, deploy the new version explicitly.

| Secret name | Runtime variable |
| --- | --- |
| `syllabus-gemini-api-key` | `GEMINI_API_KEY` |
| `syllabus-stripe-secret-key` | `STRIPE_SECRET_KEY` |
| `syllabus-stripe-webhook-secret` | `STRIPE_WEBHOOK_SECRET` |
| `syllabus-smtp-password` | `SMTP_PASSWORD` |
| `syllabus-vapid-private-key` | `VAPID_PRIVATE_KEY` |

Copy `deploy/runtime.env.example.yaml` to `deploy/runtime.env.yaml` and replace every placeholder. This local file is ignored by Git and excluded from source/image uploads. It contains the remaining non-secret runtime settings: `FIREBASE_PROJECT_ID`, `VITE_FIREBASE_DATABASE_ID`, `APP_URL`, `NODE_ENV=production`, `ALLOW_LOCAL_AI=false`, `GEMINI_MODEL`, `STRIPE_PRICE_ID`, `BILLING_REQUIRED`, SMTP host/port/user/from, public VAPID key/contact and `NOTIFICATION_WORKER_ENABLED=false`.

```powershell
Copy-Item -LiteralPath deploy/runtime.env.example.yaml -Destination deploy/runtime.env.yaml
```

`APP_URL` must be the final app HTTPS origin with no path. Use the same origin for Stripe webhooks and links. Keep `BILLING_REQUIRED=false` while validating basic service access; enable it once subscription/webhook tests pass if AI/email/push should require payment. Manual planning remains available either way.

On Cloud Run, use its attached service account's Application Default Credentials. Do not upload a service-account JSON and do not set `GOOGLE_APPLICATION_CREDENTIALS` in the container. For local `services:check`, use `gcloud auth application-default login` with an authorized account, or a service-account file outside this repository.

## 4. Runtime permissions and source build permissions

Create a dedicated application identity and grant only the Firestore/Auth access the current backend uses:

```powershell
gcloud iam service-accounts create syllabus-runtime --display-name='Syllabus application runtime'
$runtimeIdentity = "syllabus-runtime@$projectId.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding $projectId --member="serviceAccount:$runtimeIdentity" --role=roles/datastore.user
gcloud projects add-iam-policy-binding $projectId --member="serviceAccount:$runtimeIdentity" --role=roles/firebaseauth.viewer

$secretNames = @('syllabus-gemini-api-key','syllabus-stripe-secret-key','syllabus-stripe-webhook-secret','syllabus-smtp-password','syllabus-vapid-private-key')
foreach ($secretName in $secretNames) {
  gcloud secrets add-iam-policy-binding $secretName --member="serviceAccount:$runtimeIdentity" --role=roles/secretmanager.secretAccessor
}

$projectNumber = gcloud projects describe $projectId --format='value(projectNumber)'
$buildIdentity = "$projectNumber-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding $projectId --member="serviceAccount:$buildIdentity" --role=roles/run.builder
```

This is the documented default source-build identity. If your organization's Cloud Build uses a custom identity or policy, select that identity and grant the documented build permissions instead. The deployer also needs Service Account User on the selected identities.

## 5. Deploy the API, then Hosting and rules

The provided Dockerfile installs locked production dependencies and copies only server code, AI validation and the one-shot notification script into a non-root Node 24 container. The frontend is deployed independently to Hosting. `.gcloudignore` and `.dockerignore` exclude local settings, credentials and audit screenshots from uploads.

From the root, deploy using the provided Dockerfile; local Docker is not required for this Cloud Build deployment:

```powershell
$apiSecrets = 'GEMINI_API_KEY=syllabus-gemini-api-key:1,STRIPE_SECRET_KEY=syllabus-stripe-secret-key:1,STRIPE_WEBHOOK_SECRET=syllabus-stripe-webhook-secret:1,SMTP_PASSWORD=syllabus-smtp-password:1,VAPID_PRIVATE_KEY=syllabus-vapid-private-key:1'
gcloud run deploy syllabus-api --source . --project $projectId --region $region --service-account $runtimeIdentity --allow-unauthenticated --env-vars-file deploy/runtime.env.yaml --set-secrets $apiSecrets --port 8080 --memory 1Gi --cpu 1 --concurrency 8 --min-instances 0 --max-instances 3 --timeout 60
```

The service is network-public so Hosting and Stripe can reach it. Protected API routes still require Firebase bearer tokens; Stripe requires its signed webhook. Public `/api/health` reports configuration presence only. `--min-instances 0` permits cold starts; consider 1 for latency if your budget supports it. The 3-instance limit is an initial cost/concurrency choice, not a universal capacity guarantee. Existing request limits are per process, not a global billing cap.

Keep the backend service name/region aligned with `firebase.production.json`, which routes `/api` and `/api/**` before the SPA catch-all. Firebase Hosting has a 60-second request limit; the current AI provider timeout is 45 seconds, but cold starts and real provider behavior still need testing. Use the Hosting domain for the website; the API-only container does not contain the frontend.

Before deploying production, run the repository checks, including the Firestore emulator tests (Java 21+ required):

```powershell
npm run typecheck
npm run lint
npm test
npm run test:rules
npm run test:e2e
npm run test:production
npm audit --audit-level=moderate
```

Deploy rules/indexes before enabling user traffic, then build with the intended production Web app settings and deploy Hosting:

```powershell
npx firebase deploy --project $projectId --config firebase.production.json --only firestore
npm run build
npx firebase deploy --project $projectId --config firebase.production.json --only hosting
Invoke-RestMethod "$appOrigin/api/health"
```

Do not use the original static-only `firebase.json` for this full deployment. The production config also sets caching for hashed assets and prevents stale service-worker caching. `pinTag` couples a Hosting release to the selected API revision; deploy the backend first, then Hosting for subsequent releases. Update the notification job image separately.

## 6. Background notifications: Cloud Run Job + Scheduler

Keep `NOTIFICATION_WORKER_ENABLED=false` on API instances. Cloud Run can scale to zero or throttle idle CPU, so an in-process interval is not a reliable serverless schedule.

Get the immutable image from the ready API revision and create a job using the same non-secret settings plus email/push secrets:

```powershell
$revisionName = gcloud run services describe syllabus-api --region $region --format='value(status.latestReadyRevisionName)'
$imageDigest = gcloud run revisions describe $revisionName --region $region --format='value(status.imageDigest)'
if (-not $imageDigest) { throw 'Copy the immutable image URI from the ready Cloud Run revision before continuing.' }
$deliverySecrets = 'SMTP_PASSWORD=syllabus-smtp-password:1,VAPID_PRIVATE_KEY=syllabus-vapid-private-key:1'
gcloud run jobs create syllabus-notifications --image $imageDigest --project $projectId --region $region --service-account $runtimeIdentity --command node --args scripts/notifications-once.mjs --env-vars-file deploy/runtime.env.yaml --set-secrets $deliverySecrets --tasks 1 --parallelism 1 --max-retries 0 --task-timeout 300s --memory 512Mi --cpu 1

gcloud iam service-accounts create syllabus-scheduler --display-name='Syllabus notification scheduler'
$schedulerIdentity = "syllabus-scheduler@$projectId.iam.gserviceaccount.com"
gcloud run jobs add-iam-policy-binding syllabus-notifications --region $region --member="serviceAccount:$schedulerIdentity" --role=roles/run.invoker
gcloud scheduler jobs create http syllabus-notifications-every-minute --location $region --schedule='* * * * *' --time-zone='Etc/UTC' --uri="https://run.googleapis.com/v2/projects/$projectId/locations/$region/jobs/syllabus-notifications:run" --http-method=POST --oauth-service-account-email=$schedulerIdentity
```

The deployer needs Service Account User on the scheduler identity. Enabling Scheduler normally creates its service agent and required service-agent role; retain that role. Use OAuth for this Google API endpoint.

Execute the job only against your own staging/test account first:

```powershell
gcloud run jobs execute syllabus-notifications --region $region --wait
```

The one-shot runner closes Firebase resources after success or failure, so it can exit as a finite job. Application delivery leases/backoff handle routine retries; infrastructure retries are disabled here. Monitor actual successful job completion and failed delivery counts. The Settings status reflects the in-process worker flag and does not discover external Scheduler jobs; do not enable a second worker just to change that status.

On later releases, use `gcloud run jobs update syllabus-notifications --image NEW_IMAGE_DIGEST --region REGION` and update changed environment/secret versions too. Preserve VAPID keys. Test job timing at your expected account volume; the existing scanner must complete often enough to cover reminder windows.

## 7. Test the deployed product before live launch

- Open the final HTTPS Hosting/custom domain. `/api/health` must return JSON, not the SPA HTML. Its booleans indicate settings presence, not provider delivery success.
- Sign in with Google; create subjects and sessions; reopen on another browser/device with the same account and verify cloud sync. Check that a second account cannot read the first account's workspace.
- Import a real TXT/PDF/DOCX/image syllabus and request coaching. Confirm extracted topics are editable, real provider responses arrive, and errors remain useful.
- In Stripe test mode, complete Checkout; verify a signed webhook updates the Firestore billing account. Test portal access, cancellation and failed-payment events. A Checkout return page alone does not prove payment entitlement.
- With a verified account email, save reminder/digest preferences and send a test email to yourself. Confirm inbox delivery and sender authentication.
- Enable browser push from Settings, accept permission, save preferences and send a test push. Confirm real receipt while the app is closed. Test supported desktop/mobile browsers; iOS/iPadOS requires an installed Home Screen web app.
- Set the account's IANA time zone (for India, `Asia/Kolkata`) and a reminder lead time. Schedule an upcoming session, close the app and confirm scheduled email/push delivery. Confirm a completed session does not trigger a reminder. Verify Monday digests using recorded history.
- Switch the intended production project to live Stripe Price/API/webhook secrets only after staging passes. Update Secret Manager version bindings, deploy the API and job, and deploy Hosting with the production Firebase settings. Do not mix test/live resources.
- Add the real operator's privacy/terms/contact information, support mailbox, custom-domain DNS if desired, billing alerts and log/error monitoring. Set appropriate Gemini/Stripe/provider spending controls and Firestore backup/recovery policy.

Run `npm run services:check` locally after completing `.env` and local ADC. It checks provider connections without printing secrets. It makes one small Gemini request; it does not charge a Stripe payment or send email/push. Follow it with the live workflow checks above.

## Optional local API image check

With Docker Desktop running and `.env` prepared, `docker compose up --build -d` starts only the production-like API on `127.0.0.1:3001`. Run `npm run dev:web` separately for the frontend proxy. Local ADC files are not automatically available in the container; cloud auth/provider testing needs a deliberately configured credential mount or deployed service identity. A missing-credentials health response is expected before configuration.

## Local preparation verification — 2026-11-15

All 45 unit/API/domain tests, TypeScript, ESLint, formatting and Compose configuration checks passed. The production Firebase JSON was parsed and checked for API rewrite ordering. The Node API image built successfully and ran as UID 1000; its health endpoint returned JSON, unconfigured providers were reported accurately, and unauthenticated AI access returned 401. The runtime root contained no local `.env` files. The temporary verification container was stopped and removed.

These checks do not establish Google Cloud IAM access, successful deployment, actual Firebase sign-in/sync, provider credentials or delivery. Those require your project/provider setup and the live checks in section 7. Google Cloud CLI is not installed on this workstation yet; install it before using the `gcloud` commands.

## Official references

- [Firebase Hosting with Cloud Run](https://firebase.google.com/docs/hosting/cloud-run)
- [Hosting configuration](https://firebase.google.com/docs/hosting/full-config)
- [Cloud Run source deployment](https://docs.cloud.google.com/run/docs/deploying-source-code)
- [Cloud Run secrets](https://docs.cloud.google.com/run/docs/configuring/services/secrets)
- [Schedule Cloud Run jobs](https://docs.cloud.google.com/run/docs/execute/jobs-on-schedule)

# Setup and operations guide

Use [README.md](README.md) for the current setup, environment variables, validation commands, architecture, and deployment requirements.

The application runs without cloud credentials for manual study planning. AI extraction and coaching require a configured backend provider. Cloud accounts require Firebase Google authentication, Firestore rules, and server credentials. Secrets stay on the server.

Stripe subscriptions, SMTP session emails and weekly digests, and Web Push reminders are implemented. Run `npm run setup:services`, complete `.env`, then run `npm run services:check`. Follow the README's test-mode Stripe webhook setup and verify delivery using the signed-in Settings controls. Enable the server worker or schedule `notifications:once` externally for background reminders.

Before production use, run all checks, supply real credentials, verify Google sign-in and a provider request, deploy the Firestore rules, configure HTTPS and authorized domains, and publish deployment-specific privacy and contact information. No deployment has been performed by the repair work.

The original audit and the repair status are preserved under `output/audit/`.

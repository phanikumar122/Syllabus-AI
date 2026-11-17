import { useEffect, useState } from "react";
import { stripeMajorAmount } from "../domain/billing";
import {
  accountRequest,
  enableBrowserPush,
  disableBrowserPush,
  checkoutRedirect,
  type Services,
  type BillingStatus,
  type NotificationPreferences,
} from "../services/accountService";
const defaults: NotificationPreferences = {
  emailEnabled: false,
  pushEnabled: false,
  digestEnabled: false,
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  leadMinutes: 15,
};
export default function AccountServices({
  isCloud,
  onSignIn,
}: {
  isCloud: boolean;
  onSignIn?: () => void;
}) {
  const [services, setServices] = useState<Services | null>(null),
    [billing, setBilling] = useState<BillingStatus | null>(null),
    [form, setForm] = useState<NotificationPreferences>(defaults),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const load = async () => {
    if (!isCloud) return;
    const [config, status, prefs] = await Promise.all([
      accountRequest<Services>("account/services"),
      accountRequest<BillingStatus>("billing/status"),
      accountRequest<NotificationPreferences>("notifications/preferences"),
    ]);
    setServices(config);
    setBilling(status);
    setForm(prefs);
  };
  useEffect(() => {
    let active = true;
    if (!isCloud) return;
    void (async () => {
      try {
        const [config, status, prefs] = await Promise.all([
          accountRequest<Services>("account/services"),
          accountRequest<BillingStatus>("billing/status"),
          accountRequest<NotificationPreferences>("notifications/preferences"),
        ]);
        if (active) {
          setServices(config);
          setBilling(status);
          setForm(prefs);
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    })();
    return () => {
      active = false;
    };
  }, [isCloud]);
  const act = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const checkout = () =>
    act(async () => {
      const result = await accountRequest<{ url: string }>("billing/checkout", {
        requestId: crypto.randomUUID(),
      });
      checkoutRedirect(result.url, "checkout");
    });
  const portal = () =>
    act(async () => {
      const result = await accountRequest<{ url: string }>(
        "billing/portal",
        {},
      );
      checkoutRedirect(result.url, "portal");
    });
  const save = () =>
    act(async () => {
      await accountRequest("notifications/preferences", {
        emailEnabled: form.emailEnabled,
        pushEnabled: form.pushEnabled,
        digestEnabled: form.digestEnabled,
        timeZone: form.timeZone,
        leadMinutes: Number(form.leadMinutes),
      });
      setMessage(
        "Delivery preferences saved. Background reminders use your cloud plan.",
      );
    });
  const price = billing?.price;
  const amount =
    price?.amount == null
      ? "Configured subscription"
      : new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: price.currency,
        }).format(stripeMajorAmount(price.amount, price.currency));
  if (!isCloud)
    return (
      <section className="surface-card account-services">
        <h2>Connected account services</h2>
        <p className="muted-copy">
          Email delivery, subscriptions, and background push notifications
          require a signed-in cloud account. Your manual study workspace remains
          available locally.
        </p>
        {onSignIn && (
          <button className="button button-primary" onClick={onSignIn}>
            Sign in with Google
          </button>
        )}
        <p className="muted-copy">
          The server must have Stripe, SMTP, Firebase, and Web Push
          configuration before these services can be activated.
        </p>
      </section>
    );
  return (
    <section className="surface-card account-services">
      <h2>Billing and notification delivery</h2>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <button
        className="text-button"
        disabled={busy}
        onClick={() => void act(load)}
      >
        Refresh account services
      </button>
      <div className="account-services-grid">
        <section>
          <h3>Subscription</h3>
          <p className="muted-copy">
            {billing
              ? `Status: ${billing.status}${billing.cancelAtPeriodEnd ? " · ends after the current period" : ""}`
              : "Loading billing status…"}
          </p>
          {billing?.configured ? (
            <>
              <p>
                {amount}
                {price?.interval
                  ? ` / ${price.intervalCount && price.intervalCount > 1 ? price.intervalCount + " " : ""}${price.interval}`
                  : ""}
              </p>
              <p className="muted-copy">
                {services?.billingRequired
                  ? "An active subscription enables AI, email, and background reminders."
                  : "Subscriptions are available; services are currently included without a paid gate."}
              </p>
              {!billing.premium && (
                <button
                  disabled={busy}
                  className="button button-primary"
                  onClick={() => void checkout()}
                >
                  Subscribe securely with Stripe
                </button>
              )}
              {billing.hasCustomer && (
                <button
                  disabled={busy}
                  className="button button-secondary"
                  onClick={() => void portal()}
                >
                  Manage subscription
                </button>
              )}
              <p className="muted-copy">
                Payment confirmation can take a moment. Refresh your
                subscription status after returning from Checkout.
              </p>
            </>
          ) : (
            <p className="muted-copy">
              Billing is unavailable until Stripe is configured.
            </p>
          )}
        </section>
        <section>
          <h3>Email and background reminders</h3>
          <p className="muted-copy">
            Delivery address: {form.email || "No verified account email"}
          </p>
          {services && !services.workerEnabled && (
            <p className="plan-warning">
              The reminder scheduler is not enabled. Test delivery can be used
              once providers are configured.
            </p>
          )}
          <label className="checkbox-row">
            <input
              type="checkbox"
              disabled={busy || !services?.emailConfigured}
              checked={form.emailEnabled}
              onChange={(e) =>
                setForm({ ...form, emailEnabled: e.target.checked })
              }
            />{" "}
            Email before study sessions
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              disabled={busy || !services?.emailConfigured}
              checked={form.digestEnabled}
              onChange={(e) =>
                setForm({ ...form, digestEnabled: e.target.checked })
              }
            />{" "}
            Weekly email digest on Monday
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              disabled={busy || !services?.pushConfigured}
              checked={form.pushEnabled}
              onChange={(e) =>
                setForm({ ...form, pushEnabled: e.target.checked })
              }
            />{" "}
            Background push reminders
          </label>
          <div className="modal-form-grid">
            <label className="field-label">
              Time zone
              <input
                value={form.timeZone}
                onChange={(e) => setForm({ ...form, timeZone: e.target.value })}
                placeholder="Asia/Kolkata"
              />
            </label>
            <label className="field-label">
              Reminder lead time (minutes)
              <input
                type="number"
                min={5}
                max={60}
                value={form.leadMinutes}
                onChange={(e) =>
                  setForm({ ...form, leadMinutes: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <div className="toolbar-filters">
            <button
              disabled={busy}
              className="button button-primary"
              onClick={() => void save()}
            >
              Save delivery preferences
            </button>
            <button
              disabled={busy || !services?.pushConfigured}
              className="button button-secondary"
              onClick={() =>
                void act(async () => {
                  await enableBrowserPush();
                  setForm({ ...form, pushEnabled: true });
                  setMessage(
                    "Browser registered. Save delivery preferences to enable scheduled push reminders.",
                  );
                })
              }
            >
              Enable this browser
            </button>
            <button
              disabled={busy}
              className="button button-secondary"
              onClick={() =>
                void act(async () => {
                  await disableBrowserPush();
                  setMessage("This browser was unsubscribed.");
                })
              }
            >
              Disable this browser
            </button>
            <button
              disabled={busy || !services?.emailConfigured}
              className="button button-secondary"
              onClick={() =>
                void act(async () => {
                  await accountRequest("notifications/test-email", {});
                  setMessage(
                    "Test email accepted by the SMTP server. Check your inbox and spam folder.",
                  );
                })
              }
            >
              Send test email to me
            </button>
            <button
              disabled={busy || !services?.pushConfigured}
              className="button button-secondary"
              onClick={() =>
                void act(async () => {
                  const result = await accountRequest<{
                    delivered: number;
                    failed: number;
                  }>("notifications/test-push", {});
                  setMessage(
                    `Test push accepted for ${result.delivered} browser(s).${result.failed ? ` ${result.failed} browser(s) failed; retry or re-enable them.` : ""}`,
                  );
                })
              }
            >
              Send test push to my browsers
            </button>
          </div>
          <p className="muted-copy">
            Push requires browser permission and HTTPS. Delivery can be delayed
            or suppressed by the browser or operating system. On iPhone/iPad,
            install the app to the Home Screen before enabling notifications.
          </p>
        </section>
      </div>
    </section>
  );
}

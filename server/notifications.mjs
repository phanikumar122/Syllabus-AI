import { hash } from "./store.mjs";
function localParts(ms, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}
export function toUtcMillis(date, time, timeZone) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  )
    return null;
  const desired = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(desired)) return null;
  let candidate = desired;
  for (let i = 0; i < 4; i++) {
    const p = localParts(candidate, timeZone),
      represented = Date.parse(
        `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`,
      );
    const delta = desired - represented;
    if (!delta) return candidate;
    candidate += delta;
  }
  return null;
}
export function dueNotifications(profile, workspace, now = Date.now()) {
  if (
    !workspace ||
    !Array.isArray(workspace.sessions) ||
    !Array.isArray(workspace.subjects) ||
    workspace.sessions.length > 5000
  )
    return [];
  const due = [];
  for (const session of workspace.sessions) {
    if (session.status !== "planned") continue;
    const start = toUtcMillis(session.date, session.start, profile.timeZone);
    if (
      start === null ||
      now < start - profile.leadMinutes * 60000 ||
      now >= start + 300000
    )
      continue;
    const subject = workspace.subjects.find((s) => s.id === session.subjectId),
      topic = subject?.topics?.find((t) => t.id === session.topicId);
    if (!topic || typeof topic.title !== "string") continue;
    due.push({
      kind: "session",
      key: `session:${session.id}:${session.date}:${session.start}`,
      title: `Time to study: ${topic.title.slice(0, 150)}`,
      body: `${String(subject.name).slice(0, 150)} · ${session.start} · ${session.duration} minutes`,
      url: "/#planner",
    });
  }
  if (profile.digestEnabled) {
    const parts = localParts(now, profile.timeZone),
      date = `${parts.year}-${parts.month}-${parts.day}`,
      day = new Date(`${date}T12:00:00Z`);
    if (
      day.getUTCDay() === 1 &&
      Number(parts.hour) >= 9 &&
      Number(parts.hour) < 18
    ) {
      const end = new Date(day);
      end.setUTCDate(end.getUTCDate() - 1);
      const begin = new Date(day);
      begin.setUTCDate(begin.getUTCDate() - 7);
      const first = begin.toISOString().slice(0, 10),
        last = end.toISOString().slice(0, 10);
      const logs = Array.isArray(workspace.studyLog) ? workspace.studyLog : [];
      const hours = logs
        .filter(
          (l) =>
            l.date >= first &&
            l.date <= last &&
            typeof l.hours === "number" &&
            Number.isFinite(l.hours),
        )
        .reduce((sum, l) => sum + l.hours, 0);
      due.push({
        kind: "digest",
        key: `digest:${date}`,
        title: "Your weekly study digest",
        body: `You recorded ${hours.toFixed(1)} study hours from ${first} to ${last}. Open your analytics to review progress.`,
        hours,
        url: "/#analytics",
      });
    }
  }
  return due;
}
export async function runNotifications({
  store,
  sendEmail,
  sendPush,
  config,
  now = Date.now(),
}) {
  const summary = { sent: 0, failed: 0, skipped: 0 };
  for (const profile of await store.profiles()) {
    try {
      if (
        config.billingRequired &&
        !["active", "trialing"].includes(
          (await store.getAccount(profile.uid)).status,
        )
      ) {
        summary.skipped++;
        continue;
      }
      const workspace = await store.workspace(profile.uid),
        due = dueNotifications(profile, workspace, now);
      if (!due.length) continue;
      const user = await store.user(profile.uid);
      const subscriptions =
        profile.pushEnabled && config.pushReady
          ? await store.subscriptions(profile.uid)
          : [];
      async function deliver(key, send, expired) {
        if (!(await store.claim(key, now))) return;
        try {
          await send();
          await store.finish(key, "sent", now);
          summary.sent++;
        } catch (e) {
          if (expired && [404, 410].includes(e.statusCode)) {
            await expired();
            await store.finish(key, "sent", now);
            summary.skipped++;
          } else {
            await store.finish(
              key,
              "failed",
              now,
              e.code || e.statusCode || "provider_failure",
            );
            summary.failed++;
          }
        }
      }
      for (const item of due) {
        if (
          config.smtpReady &&
          user.emailVerified &&
          user.email &&
          (item.kind === "digest"
            ? profile.digestEnabled
            : profile.emailEnabled)
        )
          await deliver(`${profile.uid}:${item.key}:email`, () =>
            sendEmail({
              to: user.email,
              subject: item.title,
              text: `${item.body}\n\nOpen your workspace: ${config.appUrl || ""}${item.url}\nManage reminders: ${config.appUrl || ""}/#settings`,
              id: hash(`${profile.uid}:${item.key}:email`),
            }),
          );
        if (item.kind === "session")
          for (const entry of subscriptions) {
            if (
              store.ownsSubscription &&
              !(await store.ownsSubscription(profile.uid, entry.id))
            )
              continue;
            await deliver(
              `${profile.uid}:${item.key}:push:${entry.id}`,
              () =>
                sendPush(entry.subscription, {
                  title: item.title,
                  body: item.body,
                  url: item.url,
                  tag: hash(item.key).slice(0, 32),
                }),
              () => store.removeSubscription(profile.uid, entry.id),
            );
          }
      }
    } catch {
      summary.failed++;
    }
  }
  return summary;
}

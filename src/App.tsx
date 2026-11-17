import { lazy, Suspense, useEffect, useState } from "react";
import AppShell from "./components/AppShell";
import { useDemoState } from "./hooks/useDemoState";
import {
  disableBrowserPush,
  clearForeignBrowserPush,
} from "./services/accountService";
import {
  isFirebaseConfigured,
  observeAuth,
  signInWithGoogle,
  signOutUser,
  type User,
} from "./lib/firebase";
import type { PageId } from "./types";
const LandingPage = lazy(() => import("./components/LandingPage"));
const Onboarding = lazy(() => import("./components/Onboarding"));
const view = () => import("./components/ProductViews");
const DashboardPage = lazy(() =>
    view().then((m) => ({ default: m.DashboardPage })),
  ),
  SubjectsPage = lazy(() => view().then((m) => ({ default: m.SubjectsPage }))),
  SubjectDetailPage = lazy(() =>
    view().then((m) => ({ default: m.SubjectDetailPage })),
  ),
  PlannerPage = lazy(() => view().then((m) => ({ default: m.PlannerPage }))),
  CalendarPage = lazy(() => view().then((m) => ({ default: m.CalendarPage }))),
  AnalyticsPage = lazy(() =>
    view().then((m) => ({ default: m.AnalyticsPage })),
  ),
  CoachPage = lazy(() => view().then((m) => ({ default: m.CoachPage }))),
  SettingsPage = lazy(() => view().then((m) => ({ default: m.SettingsPage })));
const validPages = [
  "overview",
  "subjects",
  "subject",
  "planner",
  "calendar",
  "analytics",
  "coach",
  "settings",
];
const readRoute = () => {
  const [page, id] = location.hash.slice(1).split("/");
  let subjectId: string | null = null;
  try {
    subjectId = id ? decodeURIComponent(id) : null;
  } catch {
    /* Invalid routes fall back to the subject list. */
  }
  return {
    page: validPages.includes(page) ? (page as PageId) : ("overview" as PageId),
    id: subjectId,
  };
};
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [authReady, setAuthReady] = useState(!isFirebaseConfigured),
    [authBusy, setAuthBusy] = useState(false),
    [authError, setAuthError] = useState("");
  const actions = useDemoState({
    userId: user?.uid,
    cloudEnabled: isFirebaseConfigured && Boolean(user),
  });
  const [experience, setExperience] = useState<
      "landing" | "onboarding" | "app"
    >("landing"),
    [route, setRoute] = useState(readRoute),
    [searchQuery, setSearchQuery] = useState(""),
    [, tick] = useState(0);
  useEffect(
    () =>
      observeAuth((u) => {
        setUser(u);
        setAuthReady(true);
        if (u) void clearForeignBrowserPush(u.uid).catch(() => {});
      }),
    [],
  );
  useEffect(() => {
    if (user && actions.ready)
      setExperience(actions.state.onboardingComplete ? "app" : "onboarding");
  }, [user, actions.ready, actions.state.onboardingComplete]);
  useEffect(() => {
    document.documentElement.dataset.theme = "dark";
  }, []);
  useEffect(() => {
    const change = () => {
      setRoute(readRoute());
      setSearchQuery("");
    };
    window.addEventListener("hashchange", change);
    const timer = setInterval(() => tick((n) => n + 1), 60000);
    return () => {
      window.removeEventListener("hashchange", change);
      clearInterval(timer);
    };
  }, []);
  const navigate = (page: PageId) => {
    location.hash = page;
    setRoute({ page, id: null });
    setSearchQuery("");
  };
  const select = (id: string) => {
    location.hash = `subject/${encodeURIComponent(id)}`;
    setRoute({ page: "subject", id });
    setSearchQuery("");
  };
  const enter = () => {
    setExperience("app");
    navigate("overview");
  };
  const start = async () => {
    setAuthError("");
    if (!isFirebaseConfigured) {
      setExperience("onboarding");
      return;
    }
    if (user) {
      setExperience(actions.state.onboardingComplete ? "app" : "onboarding");
      return;
    }
    setAuthBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setAuthError((e as Error).message);
    } finally {
      setAuthBusy(false);
    }
  };
  const logout = async () => {
    setAuthError("");
    if (actions.dirty && !(await actions.flushSave())) {
      setAuthError(
        "Could not save your changes. Export or retry before signing out.",
      );
      return;
    }
    try {
      if (user) await disableBrowserPush();
      if (user) await signOutUser();
      setExperience("landing");
      navigate("overview");
    } catch (e) {
      setAuthError((e as Error).message);
    }
  };
  const loading = (
    <div className="app-loading">
      <strong>Preparing your workspace…</strong>
    </div>
  );
  if (!authReady) return loading;
  if (!actions.ready)
    return actions.error ? (
      <div className="recovery-page">
        <h1>Workspace needs attention</h1>
        <p role="alert">{actions.error}</p>
        <p>
          Loading failed; editing and saving are blocked to protect your data.
        </p>
        <button className="button button-primary" onClick={actions.retryLoad}>
          Retry loading
        </button>
        <button
          className="button button-secondary"
          onClick={() => {
            try {
              actions.exportData();
            } catch (e) {
              setAuthError((e as Error).message);
            }
          }}
        >
          Export local backup
        </button>
        <button
          className="button button-secondary"
          onClick={() => {
            if (
              confirm(
                "Export your backup first. Discard local recovery data and reload the workspace?",
              )
            )
              actions.reloadCloud();
          }}
        >
          Discard local recovery and reload
        </button>
        {authError && <p role="alert">{authError}</p>}
      </div>
    ) : (
      loading
    );
  const displayName = user?.displayName || "Local learner",
    props = {
      onSignIn: isFirebaseConfigured ? () => void start() : undefined,
      state: actions.state,
      actions,
      searchQuery,
      onNavigate: navigate,
      onSelectSubject: select,
      displayName,
    };
  const page =
    route.page === "overview" ? (
      <DashboardPage {...props} />
    ) : route.page === "subjects" ? (
      <SubjectsPage {...props} />
    ) : route.page === "subject" ? (
      <SubjectDetailPage key={route.id} {...props} subjectId={route.id} />
    ) : route.page === "planner" ? (
      <PlannerPage {...props} />
    ) : route.page === "calendar" ? (
      <CalendarPage {...props} />
    ) : route.page === "analytics" ? (
      <AnalyticsPage {...props} />
    ) : route.page === "coach" ? (
      <CoachPage key={actions.scope} {...props} />
    ) : (
      <SettingsPage key={actions.scope} {...props} />
    );
  return (
    <Suspense fallback={loading}>
      {experience === "landing" ? (
        <LandingPage onStart={start} onExplore={enter} startBusy={authBusy} />
      ) : experience === "onboarding" ? (
        <Onboarding
          key={actions.scope}
          actions={actions}
          onComplete={enter}
          onExit={() => setExperience("landing")}
        />
      ) : (
        <AppShell
          activePage={route.page}
          onNavigate={navigate}
          onSelectSubject={select}
          onLogout={() => void logout()}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          actions={actions}
          user={user}
        >
          {page}
        </AppShell>
      )}
      {authError && (
        <div className="auth-feedback is-visible" role="alert">
          {authError}
        </div>
      )}
    </Suspense>
  );
}

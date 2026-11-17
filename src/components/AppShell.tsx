import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import type { DemoActions } from "../hooks/useDemoState";
import type { PageId } from "../types";
import type { User } from "../lib/firebase";
import { todayKey } from "../domain/workspace";
const pages = [
  { id: "overview", label: "Overview" },
  { id: "subjects", label: "My Subjects" },
  { id: "planner", label: "Study Planner" },
  { id: "calendar", label: "Calendar" },
  { id: "analytics", label: "Analytics" },
  { id: "coach", label: "AI Coach" },
  { id: "settings", label: "Settings" },
] as const;
export default function AppShell({
  children,
  activePage,
  onNavigate,
  onSelectSubject,
  onLogout,
  searchQuery,
  setSearchQuery,
  actions,
  user,
}: {
  children: ReactNode;
  activePage: PageId;
  onNavigate: (p: PageId) => void;
  onSelectSubject: (id: string) => void;
  onLogout: () => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  actions: DemoActions;
  user: User | null;
}) {
  const [mobile, setMobile] = useState(false),
    [reminders, setReminders] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        search.current?.focus();
      }
      if (e.key === "Escape") {
        setSearchQuery("");
        setMobile(false);
        setReminders(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [setSearchQuery]);
  const go = (p: PageId) => {
    onNavigate(p);
    setMobile(false);
  };
  const name = user?.displayName || "Local learner";
  const nav = (
    <>
      <button className="brand-lockup" onClick={() => go("overview")}>
        <span>
          <strong>Syllabus AI</strong>
          <small>Study workspace</small>
        </span>
      </button>
      <span className="sidebar-section-label">Workspace</span>
      <nav aria-label="Main navigation">
        {pages.map(({ id, label }) => (
          <button
            key={id}
            className={`sidebar-link ${activePage === id || (id === "subjects" && activePage === "subject") ? "is-active" : ""}`}
            aria-current={
              activePage === id ||
              (id === "subjects" && activePage === "subject")
                ? "page"
                : undefined
            }
            onClick={() => go(id)}
          >
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-footer">
        <div>
          <strong>{name}</strong>
          <small>
            {actions.isCloud
              ? actions.syncStatus === "saving"
                ? "Saving changes…"
                : actions.dirty
                  ? "Unsent changes"
                  : "Cloud workspace"
              : "Saved in this browser"}
          </small>
        </div>
        <button
          className="utility-button"
          aria-label={user ? "Sign out" : "Exit demo"}
          onClick={onLogout}
        >
          {user ? "Sign out" : "Exit"}
        </button>
      </div>
    </>
  );
  const upcoming = actions.state.preferences.notifications
    ? actions.state.sessions
        .filter(
          (s) =>
            s.status === "planned" &&
            `${s.date}T${s.start}` >=
              `${todayKey()}T${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`,
        )
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
        .slice(0, 5)
    : [];
  const results = searchQuery.trim()
    ? actions.state.subjects
        .filter((s) =>
          `${s.name} ${s.topics.map((t) => t.title).join(" ")}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase()),
        )
        .slice(0, 8)
    : [];
  return (
    <div className="app-frame">
      <a className="skip-link" href="#workspace-content">
        Skip to content
      </a>
      <aside className="app-sidebar">{nav}</aside>
      <Dialog.Root open={mobile} onOpenChange={setMobile}>
        <Dialog.Portal>
          <Dialog.Backdrop className="modal-backdrop" />
          <Dialog.Popup className="mobile-navigation">
            <Dialog.Title className="sr-only">
              Workspace navigation
            </Dialog.Title>
            <Dialog.Close
              className="utility-button"
              aria-label="Close navigation"
            >
              Close
            </Dialog.Close>
            {nav}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <main className="app-main">
        <header className="app-topbar">
          <div className="topbar-leading">
            <button
              className="utility-button mobile-menu-button"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              Menu
            </button>
            <span className="breadcrumb">
              Workspace /{" "}
              <strong>
                {pages.find((p) => p.id === activePage)?.label || "Subject"}
              </strong>
            </span>
          </div>
          <div className="topbar-actions">
            <div className="search-container">
              <label className="topbar-search">
                <input
                  ref={search}
                  aria-label="Search subjects and topics"
                  placeholder="Search your workspace"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <kbd>Ctrl K</kbd>
              </label>
              {searchQuery && (
                <div className="search-results">
                  <strong>Matching subjects</strong>
                  {results.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        onSelectSubject(s.id);
                        setSearchQuery("");
                      }}
                    >
                      {s.name}
                      <small>
                        {
                          s.topics.filter((t) =>
                            t.title
                              .toLowerCase()
                              .includes(searchQuery.toLowerCase()),
                          ).length
                        }{" "}
                        matching topics
                      </small>
                    </button>
                  ))}
                  {!results.length && <p>No matches found.</p>}
                  <button
                    className="text-button"
                    onClick={() => setSearchQuery("")}
                  >
                    Clear search
                  </button>
                </div>
              )}
            </div>
            <button
              className="utility-button"
              aria-label="Open reminders"
              onClick={() => setReminders(true)}
            >
              Reminders
            </button>
            <span className="workspace-mode">
              {actions.isCloud ? "Cloud" : "Local"}
            </span>
          </div>
        </header>
        {actions.error && (
          <div className="sync-banner" role="alert">
            <p>{actions.error}</p>
            <button
              className="button button-secondary"
              onClick={actions.retrySave}
            >
              Retry save
            </button>
            <button
              className="button button-secondary"
              onClick={() => actions.exportData()}
            >
              Export local edits
            </button>
            <button className="text-button" onClick={() => go("settings")}>
              Manage recovery
            </button>
          </div>
        )}
        <div id="workspace-content" className="app-content" tabIndex={-1}>
          <div key={activePage} className="workspace-page-transition">
            {children}
          </div>
        </div>
      </main>
      <Dialog.Root open={reminders} onOpenChange={setReminders}>
        <Dialog.Portal>
          <Dialog.Backdrop className="modal-backdrop" />
          <Dialog.Popup className="modal-card">
            <div className="modal-heading">
              <div>
                <Dialog.Title>Upcoming study sessions</Dialog.Title>
                <Dialog.Description>
                  Reminders appear while the app is open.
                </Dialog.Description>
              </div>
              <Dialog.Close
                className="utility-button"
                aria-label="Close reminders"
              >
                Close
              </Dialog.Close>
            </div>
            {upcoming.length ? (
              upcoming.map((s) => (
                <button
                  className="reminder-row"
                  key={s.id}
                  onClick={() => {
                    go("planner");
                    setReminders(false);
                  }}
                >
                  <strong>
                    {actions.state.subjects
                      .flatMap((v) => v.topics)
                      .find((t) => t.id === s.topicId)?.title ||
                      "Study session"}
                  </strong>
                  <small>
                    {s.date} · {s.start} · {s.duration} min
                  </small>
                </button>
              ))
            ) : (
              <p>
                {actions.state.preferences.notifications
                  ? "No upcoming planned sessions."
                  : "Enable the reminder panel in Settings to show your next sessions."}
              </p>
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

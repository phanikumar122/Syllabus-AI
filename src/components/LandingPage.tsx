import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import SyllabusWeave from "./SyllabusWeave";
import "../styles/marketing.css";

const samples = [
  {
    name: "Operating Systems",
    exam: "24 Nov",
    topics: ["CPU scheduling", "Memory management", "Process synchronisation"],
    progress: [100, 60, 0],
    durations: [45, 50, 40],
  },
  {
    name: "Mathematics",
    exam: "28 Nov",
    topics: ["Differentiation", "Integration", "Differential equations"],
    progress: [100, 40, 0],
    durations: [40, 55, 45],
  },
  {
    name: "Databases",
    exam: "30 Nov",
    topics: ["Normalisation", "SQL queries", "Transactions"],
    progress: [100, 75, 0],
    durations: [35, 45, 50],
  },
];

function WorkspacePreview({ onExplore }: { onExplore: () => void }) {
  const [subject, setSubject] = useState(0),
    [view, setView] = useState("Weekly plan");
  const reduced = useReducedMotion();
  const course = samples[subject];
  return (
    <section className="saas-preview" aria-label="Interactive sample workspace">
      <header className="preview-header">
        <span>Syllabus AI / Sample workspace</span>
        <span>Illustrative data</span>
      </header>
      <div className="preview-body">
        <aside className="preview-library">
          <p>Subjects</p>
          {samples.map((item, index) => (
            <button
              key={item.name}
              aria-label={`Preview ${item.name}`}
              aria-pressed={subject === index}
              onClick={() => setSubject(index)}
            >
              <strong>{item.name}</strong>
              <small>Exam {item.exam}</small>
            </button>
          ))}
          <button className="preview-open" onClick={onExplore}>
            Open full workspace
          </button>
        </aside>
        <div className="preview-workspace">
          <div className="preview-heading">
            <div>
              <p>Your preparation, in order</p>
              <h2>{course.name}</h2>
            </div>
            <span>3 topics</span>
          </div>
          <div className="preview-switch" aria-label="Preview view">
            {["Weekly plan", "Topic progress"].map((label) => (
              <button
                key={label}
                aria-pressed={view === label}
                onClick={() => setView(label)}
              >
                {label}
              </button>
            ))}
          </div>
          <motion.div
            key={`${subject}-${view}`}
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.18 }}
            className="preview-detail"
          >
            {view === "Weekly plan" ? (
              <div className="preview-plan-list">
                {course.topics.map((topic, index) => (
                  <div className="preview-plan-row" key={topic}>
                    <span className="preview-day">
                      {["Mon", "Tue", "Wed"][index]}
                      <small>{["18:30", "19:00", "18:30"][index]}</small>
                    </span>
                    <div>
                      <strong>{topic}</strong>
                      <small>
                        {index === 0
                          ? "Review and practice"
                          : "Focused study block"}
                      </small>
                    </div>
                    <span>{course.durations[index]} min</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="preview-topic-list">
                {course.topics.map((topic, index) => (
                  <div className="preview-topic-row" key={topic}>
                    <div>
                      <strong>{topic}</strong>
                      <span>
                        {course.progress[index] === 100
                          ? "Complete"
                          : course.progress[index]
                            ? "In progress"
                            : "Not started"}
                      </span>
                    </div>
                    <div className="preview-progress-track">
                      <span
                        style={{
                          transform: `scaleX(${course.progress[index] / 100})`,
                        }}
                      />
                    </div>
                    <small>{course.progress[index]}%</small>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
          <footer className="preview-summary">
            <span>Built around your available time</span>
            <strong>
              {course.durations.reduce((sum, minutes) => sum + minutes, 0)} min
              planned
            </strong>
          </footer>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage({
  onStart,
  onExplore,
  startBusy = false,
}: {
  onStart: () => void;
  onExplore: () => void;
  startBusy?: boolean;
}) {
  const reduced = useReducedMotion();
  const [menu, setMenu] = useState(false);
  return (
    <div className="saas-site" id="top">
      <header className="saas-header">
        <a className="saas-wordmark" href="#top">
          Syllabus AI
        </a>
        <nav
          aria-label="Website navigation"
          className={menu ? "saas-nav is-open" : "saas-nav"}
        >
          <a href="#product" onClick={() => setMenu(false)}>
            Workspace
          </a>
          <a href="#workflow" onClick={() => setMenu(false)}>
            How it works
          </a>
          <a href="#faq" onClick={() => setMenu(false)}>
            Questions
          </a>
        </nav>
        <div className="saas-header-actions">
          <button
            className="saas-menu button button-quiet"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            Menu
          </button>
          <button
            className="button button-secondary"
            onClick={onStart}
            disabled={startBusy}
          >
            {startBusy ? "Connecting…" : "Start planning"}
          </button>
        </div>
      </header>
      <main>
        <motion.section
          className="saas-hero"
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.45 }}
        >
          <div className="saas-hero-copy">
            <p className="saas-intro">
              A study workspace built for follow-through
            </p>
            <h1>
              A clear plan.
              <br />A focused week.
            </h1>
            <p>
              Turn your syllabus into manageable topics, a realistic schedule,
              and progress you can see. Keep every subject in one place.
            </p>
            <div className="saas-hero-actions">
              <button
                className="button button-primary button-large"
                onClick={onStart}
                disabled={startBusy}
              >
                {startBusy ? "Connecting…" : "Start planning free"}
              </button>
              <button
                className="button button-secondary button-large"
                onClick={onExplore}
              >
                Explore the dashboard
              </button>
            </div>
            <span className="saas-hero-note">
              Start locally. Connect your account when you’re ready.
            </span>
          </div>
          <SyllabusWeave />
        </motion.section>
        <div id="product" className="saas-product-section">
          <WorkspacePreview onExplore={onExplore} />
        </div>
        <section className="saas-workflow" id="workflow">
          <div className="saas-section-heading">
            <h2>From a syllabus to a plan you can follow.</h2>
            <p>Structure the work once. Adjust it as your week changes.</p>
          </div>
          <div className="saas-feature-grid">
            {[
              [
                "Bring your subjects together",
                "Add topics yourself, or use configured AI to extract them from your syllabus. Review every estimate before planning.",
              ],
              [
                "Make room for the work",
                "Set study hours and exam dates. Generate a plan, then edit sessions when your availability changes.",
              ],
              [
                "See what you’ve completed",
                "Record study sessions and track actual topic progress. Keep unfinished work visible without inventing results.",
              ],
            ].map(([title, description], index) => (
              <article key={title}>
                <span>Step {index + 1}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="saas-start">
          <div>
            <h2>Your next session starts with a plan.</h2>
            <p>
              Manual planning works locally. Cloud syncing, AI, and delivery
              services become available when configured.
            </p>
          </div>
          <button
            className="button button-primary button-large"
            onClick={onStart}
            disabled={startBusy}
          >
            Create your workspace
          </button>
        </section>
        <section className="saas-faq" id="faq">
          <h2>A few things to know.</h2>
          <div>
            {[
              [
                "Can I plan without an account?",
                "Yes. Manual study management works in your browser. Sign in with Google when Firebase is configured to sync a private cloud workspace.",
              ],
              [
                "Can I change a generated plan?",
                "Yes. Edit subjects, topics, priorities, and study sessions. Plans show any effort that cannot fit before your exam.",
              ],
              [
                "How do AI and reminders work?",
                "Syllabus extraction and coaching use the configured Gemini service. Email and background push require a cloud account, provider configuration, and your explicit opt-in in Settings.",
              ],
              [
                "Are subscriptions required?",
                "Manual planning stays available. Subscription pricing and any paid feature requirements are shown in Settings when Stripe is configured.",
              ],
            ].map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className="saas-footer">
        <div>
          <a href="#top" className="saas-wordmark">
            Syllabus AI
          </a>
          <p>A clearer way to prepare.</p>
        </div>
        <div className="saas-legal">
          <details id="privacy">
            <summary>Privacy and storage</summary>
            <p>
              Local study data and conversations stay in this browser. Signed-in
              workspaces are stored in Firebase. Selected documents, messages,
              and study context are sent to Gemini when using AI. Optional
              billing uses Stripe; opted-in email and push use the configured
              delivery providers. Keep exports on a shared device and remove
              browser data when finished. The operator must supply its contact
              details and privacy policy before public launch.
            </p>
          </details>
          <details id="terms">
            <summary>Using your study plan</summary>
            <p>
              Review AI estimates and advice before relying on them. Keep
              backups, check your deadlines, and confirm your notification
              settings. Provider or browser behaviour can affect delivery. Study
              plans do not guarantee exam results.
            </p>
          </details>
          <span>© 2026 Syllabus AI</span>
        </div>
      </footer>
    </div>
  );
}

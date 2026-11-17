import { useEffect, useRef, useState } from "react";
import { useMotionPreference } from "../hooks/useMotionPreference";
import { weavePoint, WEAVE_PALETTE } from "../visuals/weaveGeometry";
import type { createWeaveScene } from "../visuals/weaveScene";

const fallbackPaths = Array.from({ length: 5 }, (_, strand) => {
  const points = Array.from({ length: 81 }, (_, step) => {
    const [x, y, z] = weavePoint(step / 80, 0, strand, 0);
    return `${200 + (x + z * 0.35 - y * 0.18) * 70},${210 - y * 82}`;
  });
  return `M${points.join(" L")}`;
});

export default function SyllabusWeave() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef<ReturnType<typeof createWeaveScene> | null>(null);
  const reduced = useMotionPreference();
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">(
    "loading",
  );
  const motionState = useRef({ paused, reduced });

  useEffect(() => {
    motionState.current = { paused, reduced };
    controller.current?.setMotion(paused, reduced);
  }, [paused, reduced]);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let cancelled = false,
      started = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started) return;
        started = true;
        observer.disconnect();
        void import("../visuals/weaveScene")
          .then(({ createWeaveScene }) => {
            if (cancelled) return;
            try {
              let failed = false;
              const scene = createWeaveScene(element, () => {
                failed = true;
                if (!cancelled) {
                  setStatus("fallback");
                  // Dispose outside Three's render/context callback.
                  queueMicrotask(() => {
                    if (!cancelled) {
                      controller.current?.dispose();
                      controller.current = null;
                    }
                  });
                }
              });
              controller.current = scene;
              scene.setMotion(
                motionState.current.paused,
                motionState.current.reduced,
              );
              if (!failed) setStatus("ready");
            } catch {
              setStatus("fallback");
            }
          })
          .catch(() => {
            if (!cancelled) setStatus("fallback");
          });
      },
      { rootMargin: "100px" },
    );
    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
      controller.current?.dispose();
      controller.current = null;
    };
  }, []);

  return (
    <figure
      className="syllabus-weave"
      data-status={status}
      data-motion={reduced ? "reduced" : paused ? "paused" : "playing"}
    >
      <div className="weave-stage">
        <svg
          className="weave-fallback"
          viewBox="0 0 400 420"
          aria-hidden="true"
        >
          {fallbackPaths.map((path, index) => (
            <path
              key={path}
              d={path}
              fill="none"
              stroke={`#${WEAVE_PALETTE[index].toString(16).padStart(6, "0")}`}
              strokeWidth="12"
            />
          ))}
        </svg>
        <canvas ref={canvas} aria-hidden="true" className="weave-canvas" />
        <span className="weave-label">THE SYLLABUS WEAVE</span>
      </div>
      <figcaption>
        <div>
          <strong>Separate subjects. One rhythm.</strong>
          <p>A living study sculpture.</p>
        </div>
        {status === "ready" && !reduced ? (
          <button
            className="weave-control"
            onClick={() => setPaused(!paused)}
            aria-label={
              paused
                ? "Resume sculpture animation"
                : "Pause sculpture animation"
            }
          >
            {paused ? "Resume" : "Pause"}
          </button>
        ) : (
          <span className="weave-status">
            {reduced
              ? "Motion reduced"
              : status === "fallback"
                ? "Static view"
                : "Loading scene"}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

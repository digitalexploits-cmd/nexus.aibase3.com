import { useCallback, useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/audio";

interface Props {
  onComplete: () => void;
}

// Busch Stadium flyby — cold-open intro.
const INTRO_SRC = "/__l5e/assets-v1/ac49459b-d2ac-4185-bfe0-201972bf168f/intro-stadium-flyby.mp4";

const HARD_TIMEOUT_MS = 20000;
const STALL_TIMEOUT_MS = 6000;

/**
 * Cold-open intro. Robust guards:
 *  - autoplay muted; if blocked/errored/stalled → skip
 *  - hard 8s timeout
 *  - ESC + SKIP always work
 * Never traps the visitor.
 */
export const IntroOverlay = ({ onComplete }: Props) => {
  const reducedRef = useRef(prefersReducedMotion());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [fading, setFading] = useState(false);
  const [done, setDone] = useState(false);
  const finishedRef = useRef(false);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    try { window.localStorage.setItem("nexus.introSeen", "1"); } catch { /* ignore */ }
    try { onComplete(); } catch { /* ignore */ }
    requestAnimationFrame(() => {
      setFading(true);
      window.setTimeout(() => { setDone(true); }, 400);
    });
  }, [onComplete]);


  // Reduced motion OR returning visitor → skip immediately
  useEffect(() => {
    if (reducedRef.current) { finish(); return; }
    try {
      if (window.localStorage.getItem("nexus.introSeen") === "1") finish();
    } catch { /* ignore */ }
  }, [finish]);

  // Escape to skip
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  // Hard safety timeout — never trap the visitor
  useEffect(() => {
    const t = window.setTimeout(finish, HARD_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [finish]);

  // If autoplay is blocked, skip. Try play() explicitly.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const attempt = v.play();
    if (attempt && typeof attempt.then === "function") {
      attempt.catch(() => finish());
    }
  }, [finish]);

  // Stall watchdog
  useEffect(() => {
    let stallTimer: number | null = null;
    const v = videoRef.current;
    if (!v) return;
    const armStall = () => {
      if (stallTimer !== null) window.clearTimeout(stallTimer);
      stallTimer = window.setTimeout(finish, STALL_TIMEOUT_MS);
    };
    const disarm = () => {
      if (stallTimer !== null) { window.clearTimeout(stallTimer); stallTimer = null; }
    };
    armStall();
    v.addEventListener("playing", disarm);
    v.addEventListener("timeupdate", armStall);
    v.addEventListener("stalled", finish);
    v.addEventListener("suspend", armStall);
    return () => {
      disarm();
      v.removeEventListener("playing", disarm);
      v.removeEventListener("timeupdate", armStall);
      v.removeEventListener("stalled", finish);
      v.removeEventListener("suspend", armStall);
    };
  }, [finish]);

  if (done) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-[#04060a] overflow-hidden"
      style={{ opacity: fading ? 0 : 1, transition: "opacity 400ms ease-out" }}
    >
      <video
        ref={videoRef}
        src={INTRO_SRC}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        muted
        playsInline
        loop={false}
        preload="auto"
        onEnded={finish}
        onError={finish}
        onAbort={finish}
      />

      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(2,4,8,0.85)_100%)]" />

      <button
        onClick={finish}
        className="absolute bottom-6 right-6 mono text-[0.6rem] tracking-[0.28em] text-muted-foreground hover:text-primary/80 border border-border/60 hover:border-primary/40 px-3 py-1.5 bg-background/40 backdrop-blur-sm transition-colors"
      >
        SKIP →
      </button>
    </div>
  );
};

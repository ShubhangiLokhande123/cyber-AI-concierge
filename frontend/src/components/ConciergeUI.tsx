"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import VideoPanel from "./VideoPanel";
import AudioVisualizer from "./AudioVisualizer";
import ChatPanel from "./ChatPanel";
import { useTavusRoom } from "@/hooks/useTavusRoom";
import { startConversation } from "@/lib/api";
import type { AgentStatus } from "@/lib/types";

export default function ConciergeUI() {
  const { state, join, leave, sendText, setVideoRef } = useTavusRoom();
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const handleStart = useCallback(async () => {
    setIsStarting(true);
    setStartError(null);
    try {
      const data = await startConversation("Visitor");
      await join(data.conversation_url, data.conversation_id ?? "");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start session.";
      setStartError(msg);
    } finally {
      setIsStarting(false);
    }
  }, [join]);

  const handleEnd = useCallback(async () => {
    await leave();
  }, [leave]);

  const isActive =
    state.status !== "idle" && state.status !== "ended" && state.status !== "error";
  const isIdle = state.status === "idle" || state.status === "ended";

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-cyber-bg select-none">
      {/* ── Top bar ── */}
      <header className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-cyber-border bg-cyber-panel">
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div className="relative w-7 h-7">
            <svg viewBox="0 0 28 28" fill="none" className="w-7 h-7">
              <polygon
                points="14,2 26,8 26,20 14,26 2,20 2,8"
                stroke="#00d4ff"
                strokeWidth="1.5"
                fill="rgba(0,212,255,0.08)"
              />
              <polygon
                points="14,7 21,11 21,17 14,21 7,17 7,11"
                stroke="#00d4ff"
                strokeWidth="1"
                fill="rgba(0,212,255,0.04)"
              />
              <circle cx="14" cy="14" r="2.5" fill="#00d4ff" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-[0.12em] text-white uppercase">
              CyberGuard AI
            </h1>
            <p className="text-[9px] font-mono text-cyber-muted tracking-widest">
              CYBERSECURITY INTELLIGENCE CONCIERGE
            </p>
          </div>
        </div>

        {/* Threat level indicator */}
        <ThreatLevelBadge />

        {/* Clock */}
        <LiveClock />
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-hidden p-3 gap-3 grid grid-cols-[1fr_1px_1fr] grid-rows-[1fr]
                       lg:grid-cols-[5fr_1px_6fr]">
        {/* Left column: VIDEO + AUDIO */}
        <div className="flex flex-col gap-3 min-h-0">
          {/* Video fills all remaining height */}
          <div className="flex-1 min-h-0">
            <VideoPanel status={state.status} setVideoRef={setVideoRef} />
          </div>

          {/* Audio: compact fixed-height strip */}
          <div className="h-[130px] shrink-0">
            <AudioVisualizer analyser={state.audioAnalyser} status={state.status} />
          </div>
        </div>

        {/* Divider */}
        <div className="bg-cyber-border/30" />

        {/* Right column: CHAT */}
        <div className="min-h-0">
          <ChatPanel
            messages={state.messages}
            status={state.status}
            onSend={sendText}
          />
        </div>
      </main>

      {/* ── Bottom bar ── */}
      <footer className="shrink-0 flex items-center justify-between px-4 py-2 border-t border-cyber-border bg-cyber-panel gap-4">
        {/* Error display */}
        {(state.error || startError) && (
          <p className="text-xs font-mono text-cyber-red flex-1 truncate">
            ⚠ {state.error ?? startError}
          </p>
        )}

        {/* Session info */}
        {!state.error && !startError && (
          <div className="flex items-center gap-4 text-[10px] font-mono text-cyber-muted/60">
            <span>SESSION: {state.conversationId?.slice(0, 12) ?? "—"}</span>
            <span>MSGS: {state.messages.length}</span>
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {isIdle && (
            <button
              onClick={handleStart}
              disabled={isStarting}
              className={clsx(
                "px-5 py-1.5 text-xs font-mono tracking-widest uppercase border rounded transition-all",
                isStarting
                  ? "border-cyber-cyan/30 text-cyber-cyan/50 cursor-wait"
                  : "border-cyber-cyan text-cyber-cyan hover:bg-cyber-cyan/10 active:scale-95",
                "shadow-[0_0_12px_rgba(0,212,255,0.15)]"
              )}
            >
              {isStarting ? "CONNECTING…" : "▶  START SESSION"}
            </button>
          )}

          {isActive && (
            <button
              onClick={handleEnd}
              className="px-5 py-1.5 text-xs font-mono tracking-widest uppercase border 
                         border-cyber-red text-cyber-red hover:bg-cyber-red/10 
                         active:scale-95 rounded transition-all"
            >
              ■  END SESSION
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

// ── Helper sub-components ────────────────────────────────────────────────

function ThreatLevelBadge() {
  // Static demo indicator – in production, derive from live feed data
  const levels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
  const current = "HIGH" as (typeof levels)[number];
  const color = { LOW: "text-cyber-green", MEDIUM: "text-cyber-yellow", HIGH: "text-cyber-red", CRITICAL: "text-cyber-red" }[current];

  return (
    <div className="hidden md:flex items-center gap-2 border border-cyber-border rounded px-3 py-1">
      <span className="text-[9px] font-mono text-cyber-muted tracking-wider">THREAT LEVEL</span>
      <div className="flex items-center gap-1">
        {levels.map((l) => (
          <div
            key={l}
            className={clsx(
              "w-5 h-2 rounded-sm",
              l === current || levels.indexOf(l) < levels.indexOf(current)
                ? l === "HIGH" || l === "CRITICAL"
                  ? "bg-cyber-red"
                  : l === "MEDIUM"
                  ? "bg-cyber-yellow"
                  : "bg-cyber-green"
                : "bg-cyber-border"
            )}
          />
        ))}
      </div>
      <span className={clsx("text-[9px] font-mono font-semibold tracking-widest", color)}>
        {current}
      </span>
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const fmt = () => new Date().toISOString().replace("T", " ").slice(0, 19);
    setTime(fmt());
    const id = setInterval(() => setTime(fmt()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="hidden lg:flex flex-col items-end">
      <span className="text-[10px] font-mono text-cyber-cyan/80">
        {time ? `${time} UTC` : ""}
      </span>
      <span className="text-[9px] font-mono text-cyber-muted/50 tracking-wider">
        REAL-TIME INTEL
      </span>
    </div>
  );
}

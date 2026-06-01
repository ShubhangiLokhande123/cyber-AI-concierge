"use client";

import { useCallback, useRef } from "react";
import clsx from "clsx";
import type { AgentStatus } from "@/lib/types";

interface Props {
  status: AgentStatus;
  setVideoRef: (el: HTMLVideoElement | null) => void;
}

const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: "STANDBY",
  connecting: "CONNECTING…",
  listening: "LISTENING",
  thinking: "PROCESSING",
  speaking: "TRANSMITTING",
  error: "CONNECTION ERROR",
  ended: "SESSION ENDED",
};

const STATUS_COLOR: Record<AgentStatus, string> = {
  idle: "text-cyber-muted",
  connecting: "text-cyber-yellow",
  listening: "text-cyber-green",
  thinking: "text-cyber-purple",
  speaking: "text-cyber-cyan",
  error: "text-cyber-red",
  ended: "text-cyber-muted",
};

export default function VideoPanel({ status, setVideoRef }: Props) {
  const isActive = status !== "idle" && status !== "ended" && status !== "error";

  return (
    <div className="relative flex flex-col bg-cyber-panel border border-cyber-border rounded-sm panel-glow overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-cyber-border">
        <span className="text-xs font-mono text-cyber-muted tracking-[0.15em] uppercase">
          VIDEO FEED
        </span>
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              "text-[10px] font-mono tracking-widest uppercase",
              STATUS_COLOR[status]
            )}
          >
            {STATUS_LABEL[status]}
          </span>
          <span
            className={clsx(
              "w-2 h-2 rounded-full",
              status === "speaking"
                ? "bg-cyber-cyan animate-pulse"
                : status === "listening"
                ? "bg-cyber-green animate-pulse-slow"
                : status === "thinking"
                ? "bg-cyber-purple animate-pulse"
                : status === "connecting"
                ? "bg-cyber-yellow animate-pulse"
                : "bg-cyber-muted"
            )}
          />
        </div>
      </div>

      {/* Video */}
      <div className="relative flex-1 bg-black overflow-hidden scanline">
        <video
          ref={setVideoRef}
          autoPlay
          playsInline
          muted={false}
          className={clsx(
            "w-full h-full object-contain transition-opacity duration-700",
            isActive ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Placeholder when not active */}
        {!isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            {/* Avatar silhouette */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-2 border-cyber-border flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="w-12 h-12 text-cyber-muted"
                >
                  <path
                    d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              {(status as string) === "connecting" && (
                <div className="absolute inset-0 rounded-full border-2 border-cyber-cyan animate-spin border-t-transparent" />
              )}
            </div>
            <p className="text-xs font-mono text-cyber-muted">
              {status === "idle"
                ? "START SESSION TO ACTIVATE"
                : (status as string) === "connecting"
                ? "ESTABLISHING SECURE LINK…"
                : "AVATAR OFFLINE"}
            </p>
          </div>
        )}

        {/* Corner decorations */}
        <CornerDecorations />

        {/* Speaking indicator */}
        {status === "speaking" && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/60 px-3 py-1 rounded-full border border-cyber-cyan/30">
            <span className="w-1.5 h-1.5 rounded-full bg-cyber-cyan animate-pulse" />
            <span className="text-[10px] font-mono text-cyber-cyan tracking-wider">
              CYBERGUARD SPEAKING
            </span>
          </div>
        )}
      </div>

      {/* Footer metadata */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-cyber-border">
        <span className="text-[9px] font-mono text-cyber-muted/60">
          ENCRYPTION: AES-256 · WEBRTC
        </span>
        <span className="text-[9px] font-mono text-cyber-muted/60">
          SECURE CHANNEL
        </span>
      </div>
    </div>
  );
}

function CornerDecorations() {
  return (
    <>
      <div className="absolute top-2 left-2 w-4 h-4 border-t border-l border-cyber-cyan/40" />
      <div className="absolute top-2 right-2 w-4 h-4 border-t border-r border-cyber-cyan/40" />
      <div className="absolute bottom-8 left-2 w-4 h-4 border-b border-l border-cyber-cyan/40" />
      <div className="absolute bottom-8 right-2 w-4 h-4 border-b border-r border-cyber-cyan/40" />
    </>
  );
}

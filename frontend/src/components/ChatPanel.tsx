"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import clsx from "clsx";
import type { ChatMessage, AgentStatus } from "@/lib/types";

interface Props {
  messages: ChatMessage[];
  status: AgentStatus;
  onSend: (text: string) => void;
}

export default function ChatPanel({ messages, status, onSend }: Props) {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput("");
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const canInput = status === "listening" || status === "thinking" || status === "speaking";

  return (
    <div className="flex flex-col bg-cyber-panel border border-cyber-border rounded-sm panel-glow h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-cyber-border shrink-0">
        <span className="text-xs font-mono text-cyber-muted tracking-[0.15em] uppercase">
          SECURE COMMS
        </span>
        <span className="text-[10px] font-mono text-cyber-muted/60">
          {messages.length} MESSAGES
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <EmptyState />
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Thinking indicator */}
        {status === "thinking" && (
          <div className="flex gap-2 items-start">
            <RoleBadge role="agent" />
            <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-cyber-bg border border-cyber-border">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-cyber-purple"
                  style={{
                    animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-cyber-border p-2">
        <div
          className={clsx(
            "flex items-center gap-2 px-3 py-2 rounded border transition-colors",
            canInput
              ? "border-cyber-border bg-cyber-bg focus-within:border-cyber-cyan/40"
              : "border-cyber-border/40 bg-cyber-bg/50 opacity-60"
          )}
        >
          <span className="text-cyber-cyan/60 font-mono text-xs select-none">&gt;</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={!canInput}
            placeholder={
              status === "idle"
                ? "Start session to chat…"
                : status === "connecting"
                ? "Connecting…"
                : status === "speaking"
                ? "Agent speaking…"
                : "Type a message…"
            }
            className="flex-1 bg-transparent text-sm text-cyber-text placeholder:text-cyber-muted/50 
                       font-mono outline-none disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={!canInput || !input.trim()}
            className={clsx(
              "px-3 py-1 text-xs font-mono tracking-wider rounded border transition-all",
              canInput && input.trim()
                ? "border-cyber-cyan text-cyber-cyan hover:bg-cyber-cyan/10 active:scale-95"
                : "border-cyber-border/40 text-cyber-muted/40 cursor-not-allowed"
            )}
          >
            SEND
          </button>
        </div>
        <p className="mt-1 text-[9px] font-mono text-cyber-muted/40 text-center">
          VOICE INPUT ACTIVE · END-TO-END ENCRYPTED
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isAgent = message.role === "agent";

  return (
    <div className={clsx("flex gap-2 items-start", !isAgent && "flex-row-reverse")}>
      <RoleBadge role={message.role} />
      <div
        className={clsx(
          "max-w-[80%] px-3 py-2 rounded text-sm leading-relaxed",
          isAgent
            ? "bg-cyber-bg border border-cyber-cyan/20 text-cyber-text"
            : "bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-text"
        )}
      >
        {/* Role label */}
        <p
          className={clsx(
            "text-[9px] font-mono tracking-widest mb-1 uppercase",
            isAgent ? "text-cyber-cyan" : "text-cyber-green"
          )}
        >
          {isAgent ? "CYBERGUARD" : "YOU"}
        </p>
        <p className="whitespace-pre-wrap">{message.content}</p>
        <p className="text-[9px] font-mono text-cyber-muted/50 mt-1 text-right">
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: "agent" | "user" }) {
  return (
    <div
      className={clsx(
        "shrink-0 w-7 h-7 rounded-full border flex items-center justify-center",
        role === "agent"
          ? "border-cyber-cyan/40 bg-cyber-cyan/10"
          : "border-cyber-green/40 bg-cyber-green/10"
      )}
    >
      {role === "agent" ? (
        <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 text-cyber-cyan">
          <path
            d="M12 2a5 5 0 0 1 5 5v2a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5zm-7 18v-1a7 7 0 0 1 14 0v1H5z"
            fill="currentColor"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 text-cyber-green">
          <circle cx="12" cy="12" r="4" fill="currentColor" />
          <path
            d="M12 2v3M12 19v3M2 12h3M19 12h3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </div>
  );
}

function EmptyState() {
  const topics = [
    "Latest CISA exploited vulnerabilities",
    "AI security trends & LLM risks",
    "Ransomware campaigns this month",
    "MITRE ATT&CK techniques for phishing",
    "Zero Trust Architecture overview",
    "Quantum-safe cryptography update",
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 py-6">
      <div className="text-center">
        <p className="text-xs font-mono text-cyber-cyan mb-1 tracking-wider">
          CYBERGUARD READY
        </p>
        <p className="text-[11px] text-cyber-muted max-w-[200px] text-center leading-relaxed">
          Ask me anything about cybersecurity. Try:
        </p>
      </div>
      <ul className="space-y-1.5">
        {topics.map((t) => (
          <li
            key={t}
            className="text-[10px] font-mono text-cyber-muted/70 flex items-center gap-1.5"
          >
            <span className="text-cyber-cyan/50">›</span>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

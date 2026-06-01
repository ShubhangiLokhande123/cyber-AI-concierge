"use client";

import { useEffect, useRef } from "react";
import type { AgentStatus } from "@/lib/types";

interface Props {
  analyser: AnalyserNode | null;
  status: AgentStatus;
}

const BAR_COUNT = 32;

export default function AudioVisualizer({ analyser, status }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dataArray = new Uint8Array(analyser ? analyser.frequencyBinCount : BAR_COUNT);

    function draw() {
      rafRef.current = requestAnimationFrame(draw);
      const { width, height } = canvas!;
      ctx!.clearRect(0, 0, width, height);

      if (analyser) {
        analyser.getByteFrequencyData(dataArray);
      }

      const barWidth = (width / BAR_COUNT) * 0.6;
      const gap = (width / BAR_COUNT) * 0.4;

      for (let i = 0; i < BAR_COUNT; i++) {
        let value: number;

        if (analyser && status === "speaking") {
          // Use real audio data
          const slice = Math.floor((i / BAR_COUNT) * dataArray.length);
          value = dataArray[slice] / 255;
        } else if (status === "listening" || status === "thinking") {
          // Subtle idle animation
          value = 0.08 + Math.sin(Date.now() / 400 + i * 0.4) * 0.06;
        } else {
          value = 0.03;
        }

        const barHeight = Math.max(2, value * height * 0.85);
        const x = i * (barWidth + gap) + gap / 2;
        const y = (height - barHeight) / 2;

        // Gradient fill
        const grad = ctx!.createLinearGradient(x, y, x, y + barHeight);

        if (status === "speaking") {
          grad.addColorStop(0, "rgba(0,212,255,0.9)");
          grad.addColorStop(0.5, "rgba(0,255,159,0.7)");
          grad.addColorStop(1, "rgba(0,212,255,0.3)");
        } else if (status === "thinking") {
          grad.addColorStop(0, "rgba(139,92,246,0.7)");
          grad.addColorStop(1, "rgba(139,92,246,0.2)");
        } else {
          grad.addColorStop(0, "rgba(0,212,255,0.25)");
          grad.addColorStop(1, "rgba(0,212,255,0.05)");
        }

        ctx!.fillStyle = grad;
        ctx!.fillRect(x, y, barWidth, barHeight);
      }
    }

    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [analyser, status]);

  // Resize canvas on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex flex-col bg-cyber-panel border border-cyber-border rounded-sm panel-glow overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-cyber-border">
        {/* Left: speaker icon + label */}
        <div className="flex items-center gap-2">
          <div className="relative w-5 h-5 flex items-center justify-center">
            {/* Ripple ring when speaking */}
            {status === "speaking" && (
              <div
                className="absolute inset-0 rounded-full border border-cyber-cyan/60"
                style={{ animation: "ripple 1.4s ease-out infinite" }}
              />
            )}
            {/* Speaker SVG */}
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 relative z-10">
              <path
                d="M2 5.5h2.5L8 2.5v11l-3.5-3H2V5.5z"
                fill={status === "speaking" ? "#00d4ff" : status === "listening" ? "#00ff9f80" : "#4a6080"}
                style={{ transition: "fill 0.3s" }}
              />
              {(status === "speaking") && (
                <path d="M10 4.5a3.5 3.5 0 0 1 0 7" stroke="#00d4ff" strokeWidth="1.2" strokeLinecap="round" />
              )}
              {(status === "speaking") && (
                <path d="M11.8 2.8a6 6 0 0 1 0 10.4" stroke="rgba(0,212,255,0.35)" strokeWidth="1" strokeLinecap="round" />
              )}
            </svg>
          </div>
          <span className="text-xs font-mono text-cyber-muted tracking-[0.15em] uppercase">
            AUDIO STREAM
          </span>
        </div>

        {/* Right: animated equalizer bars */}
        <div className="flex items-end gap-[3px]">
          {([12, 18, 22, 16, 20, 14, 10] as number[]).map((h, i) => {
            const delays =    [0, 0.12, 0.24, 0.06, 0.18, 0.30, 0.09];
            const durations = [0.70, 0.50, 0.65, 0.80, 0.55, 0.70, 0.60];
            const isSpeaking = status === "speaking";
            const isListening = status === "listening";
            return (
              <div
                key={i}
                className="w-1 rounded-sm"
                style={{
                  height: `${h}px`,
                  background: isSpeaking
                    ? `rgba(0,212,255,${i === 2 || i === 4 ? 0.85 : 0.45})`
                    : isListening
                    ? "rgba(0,255,159,0.25)"
                    : "rgba(0,212,255,0.15)",
                  transformOrigin: "bottom",
                  animation: isSpeaking
                    ? `audioBar ${durations[i]}s ease-in-out ${delays[i]}s infinite alternate`
                    : isListening
                    ? `audioBar 2s ease-in-out ${i * 0.18}s infinite alternate`
                    : "none",
                  transition: "background 0.3s",
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Canvas */}
      <div className="relative flex-1 min-h-[80px] p-2">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ imageRendering: "pixelated" }}
        />

        {/* Level indicator dots like in screenshot */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-150"
              style={{
                width: i === 2 ? "14px" : "10px",
                height: i === 2 ? "14px" : "10px",
                background:
                  status === "speaking"
                    ? i === 2
                      ? "#00d4ff"
                      : i === 1 || i === 3
                      ? "#00d4ff80"
                      : "#00d4ff40"
                    : status === "listening"
                    ? i === 2
                      ? "#00ff9f60"
                      : "#00ff9f30"
                    : "#1a2540",
                boxShadow:
                  status === "speaking" && i === 2
                    ? "0 0 12px #00d4ff"
                    : "none",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

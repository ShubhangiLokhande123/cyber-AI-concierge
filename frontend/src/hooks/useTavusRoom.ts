"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, AgentStatus, TavusRoomState } from "@/lib/types";
import { sendMessage as apiSendMessage } from "@/lib/api";

import type DailyIframe from "@daily-co/daily-js";
type DailyCallObject = ReturnType<typeof DailyIframe.createCallObject>;

let _DailyIframe: typeof DailyIframe | null = null;

async function getDailyJS(): Promise<typeof DailyIframe> {
  if (!_DailyIframe) {
    const mod = await import("@daily-co/daily-js");
    _DailyIframe = mod.default;
  }
  return _DailyIframe;
}

export function useTavusRoom() {
  const callRef = useRef<DailyCallObject | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioElementsRef = useRef<HTMLAudioElement[]>([]);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const agentStatusRef = useRef<AgentStatus>("idle"); // track agent status separate from user speaking

  const [status, setStatus] = useState<AgentStatus>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [audioAnalyser, setAudioAnalyser] = useState<AnalyserNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState<boolean>(false);
  const [micAvailable, setMicAvailable] = useState<boolean>(false);

  const setStatusTracked = useCallback((s: AgentStatus) => {
    agentStatusRef.current = s;
    setStatus(s);
  }, []);

  const addMessage = useCallback((role: "agent" | "user", content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        role,
        content,
        timestamp: new Date(),
      },
    ]);
  }, []);

  const setupAudioAnalyser = useCallback((stream: MediaStream, isLocal = false) => {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new AudioContext();
      }
      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      const source = audioCtxRef.current.createMediaStreamSource(stream);
      source.connect(analyser);

      if (isLocal) {
        localAnalyserRef.current = analyser;
        // For local mic, use this analyser so the visualizer shows user speaking
        analyserRef.current = analyser;
        setAudioAnalyser(analyser);
      } else {
        analyserRef.current = analyser;
        // Only switch to agent analyser if local isn't active
        if (!localAnalyserRef.current) {
          setAudioAnalyser(analyser);
        }
      }
    } catch {
      // AudioContext may be blocked before user gesture; silently ignore
    }
  }, []);

  const join = useCallback(
    async (conversationUrl: string, convId: string) => {
      setStatusTracked("connecting");
      setConversationId(convId);
      setError(null);
      setMicEnabled(false);
      setMicAvailable(false);

      // ── Preflight mic permission check ─────────────────────────────
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        setMicAvailable(true);
      } catch (preflightErr) {
        const name = preflightErr instanceof Error ? preflightErr.name : "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setError(
            "Microphone permission denied. Click the lock icon in your browser address bar to allow microphone access, then restart the session."
          );
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          setError(
            "No microphone detected. Please connect a microphone and restart the session."
          );
        } else {
          setError(
            "Could not access microphone. Please check your browser settings and restart the session."
          );
        }
        setStatus("error");
        return;
      }

      try {
        const Daily = await getDailyJS();
        const call = Daily.createCallObject({
          url: conversationUrl,
          audioSource: true,
          videoSource: false,
          subscribeToTracksAutomatically: true,
        });
        callRef.current = call;

        // ── Track started ──────────────────────────────────────────────
        call.on("track-started", (event) => {
          if (!event.participant) return;
          const { track, participant } = event;

          // Local mic track → set up user audio analyser
          if (participant.local && track.kind === "audio") {
            const stream = new MediaStream([track]);
            setupAudioAnalyser(stream, true);
            return;
          }

          if (participant.local) return;

          if (track.kind === "video") {
            const videoEl = videoElRef.current;
            if (videoEl) {
              const existing = videoEl.srcObject as MediaStream | null;
              const stream = existing ?? new MediaStream();
              stream.addTrack(track);
              videoEl.srcObject = stream;
              videoEl.play().catch(() => {});
            }
          }

          if (track.kind === "audio") {
            const stream = new MediaStream([track]);
            setupAudioAnalyser(stream, false);
            // Play agent audio through a hidden element
            const audioEl = document.createElement("audio");
            audioEl.srcObject = stream;
            audioEl.autoplay = true;
            audioEl.style.display = "none";
            document.body.appendChild(audioEl);
            audioElementsRef.current = [...audioElementsRef.current, audioEl];
          }
        });

        // ── Active speaker detection ───────────────────────────────────
        call.on("active-speaker-change", (event) => {
          const activePeerId = (event as unknown as { activeSpeaker?: { peerId?: string } })
            ?.activeSpeaker?.peerId;
          if (!activePeerId) return;

          const participants = call.participants();
          const isLocalSpeaking = participants?.local?.session_id === activePeerId;

          if (isLocalSpeaking && agentStatusRef.current === "listening") {
            setStatus("listening"); // keep listening while user speaks
          }
        });

        // ── Participant events ─────────────────────────────────────────
        call.on("participant-joined", () => {
          setStatusTracked("listening");
        });

        call.on("participant-left", () => {
          setStatusTracked("ended");
        });

        // ── App messages (Tavus state events) ─────────────────────────
        call.on("app-message", (event: { data: Record<string, unknown>; fromId: string }) => {
          const data = event.data;
          if (!data) return;

          // Tavus transcript events
          if (data.type === "transcript" || data.type === "conversation.transcript") {
            const role = (data.role as string) === "user" ? "user" : "agent";
            const text = (data.text ?? data.content ?? "") as string;
            if (text) addMessage(role, text);
          }

          // Tavus speaking/listening state
          if (data.type === "agent-speaking") {
            setStatusTracked("speaking");
            // Switch visualiser to agent audio when agent speaks
            if (analyserRef.current && analyserRef.current !== localAnalyserRef.current) {
              setAudioAnalyser(analyserRef.current);
            }
          }
          if (data.type === "agent-listening") {
            setStatusTracked("listening");
            // Switch visualiser back to local mic when agent is listening
            if (localAnalyserRef.current) {
              setAudioAnalyser(localAnalyserRef.current);
            }
          }
          if (data.type === "agent-thinking") setStatusTracked("thinking");
        });

        // Daily transcription events (paid plan)
        call.on(
          "transcription-message" as Parameters<typeof call.on>[0],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (event: any) => {
            const text = (event?.text ?? "") as string;
            const isUser = (event?.participantId as string)?.startsWith("local");
            if (!text) return;
            if ((event?.is_final as boolean) || text.endsWith(".") || text.endsWith("?")) {
              addMessage(isUser ? "user" : "agent", text);
            }
          }
        );

        // ── Call state ─────────────────────────────────────────────────
        call.on("joined-meeting", async () => {
          setStatusTracked("listening");

          // Enable local audio after joining (setLocalAudio is the correct
          // Daily.co API once inside a meeting — startCamera() is pre-join only).
          try {
            await call.setLocalAudio(true);
            setMicEnabled(true);
          } catch {
            // Non-fatal; mic state will be updated via participant-updated
          }

          // Start Daily transcription if available (paid plan)
          try {
            (call as unknown as { startTranscription?: (opts: object) => void })
              .startTranscription?.({ language: "en" });
          } catch {
            // Transcription not available on free plan — Tavus handles ASR natively
          }
        });

        // ── Local participant mic state ────────────────────────────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        call.on("participant-updated", (event: any) => {
          const p = event?.participant;
          if (!p?.local) return;
          const audioState: string | undefined = p?.tracks?.audio?.state;
          // p.audio is the legacy muted/unmuted flag; audioState covers the
          // newer Daily track-state API where "playable" means live and
          // "loading" means the track is being established (treat as live).
          const audioEnabled: boolean =
            p?.audio === true || audioState === "playable" || audioState === "loading";
          setMicEnabled(audioEnabled);
        });

        call.on("left-meeting", () => {
          setStatusTracked("ended");
          cleanup();
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        call.on("error", (err: any) => {
          const msg: string = err?.errorMsg ?? "WebRTC error occurred.";
          // Detect non-fatal mic permission/device errors
          if (err?.type === "cam-mic-error" || err?.nonfatal === true) {
            const errorType: string = err?.error?.type ?? err?.errorMsg ?? "";
            if (errorType.includes("NotAllowed") || errorType.includes("PermissionDenied")) {
              setError(
                "Microphone permission denied. Click the lock icon in your browser address bar to allow microphone access, then restart the session."
              );
              setMicAvailable(false);
            } else if (errorType.includes("NotFound") || errorType.includes("DevicesNotFound")) {
              setError(
                "No microphone detected. Please connect a microphone and restart the session."
              );
              setMicAvailable(false);
            }
            // Non-fatal: don't change session status
            return;
          }
          setError(msg);
          setStatusTracked("error");
        });

        // Daily fires "camera-error" for both camera AND microphone device
        // errors (despite the name). It is the correct event to catch
        // NotAllowedError / NotFoundError for audio-only call objects.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        call.on("camera-error" as Parameters<typeof call.on>[0], (err: any) => {
          const errorType: string =
            err?.error?.type ?? err?.error?.name ?? err?.errorMsg ?? "";
          if (errorType.includes("NotAllowed") || errorType.includes("PermissionDenied")) {
            setError(
              "Microphone permission denied. Click the lock icon in your browser address bar to allow microphone access, then restart the session."
            );
          } else if (errorType.includes("NotFound") || errorType.includes("DevicesNotFound")) {
            setError(
              "No microphone detected. Please connect a microphone and restart the session."
            );
          } else {
            setError(
              "Could not access microphone. Please check your browser settings and restart the session."
            );
          }
          setMicAvailable(false);
          setMicEnabled(false);
        });

        await call.join({ url: conversationUrl });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to join session.";
        setError(msg);
        setStatusTracked("error");
      }
    },
    [addMessage, setupAudioAnalyser, setStatusTracked]
  );

  const leave = useCallback(async () => {
    if (callRef.current) {
      await callRef.current.leave();
      await callRef.current.destroy();
      callRef.current = null;
    }
    cleanup();
    setStatusTracked("ended");
    setMicEnabled(false);
    setMicAvailable(false);
  }, [setStatusTracked]);

  const sendText = useCallback(async (text: string) => {
    if (!text.trim()) return;

    addMessage("user", text);
    setStatusTracked("thinking");

    try {
      const convId = conversationId ?? "";
      const { response } = await apiSendMessage(convId, text);
      addMessage("agent", response);

      // Inject the response into the Tavus CVI room so the avatar speaks it
      if (callRef.current && convId) {
        try {
          callRef.current.sendAppMessage(
            {
              message_type: "conversation",
              event_type: "conversation.echo",
              conversation_id: convId,
              properties: { text: response },
            },
            "*"
          );
        } catch {
          // Non-critical — chat still shows the response
        }
      }
    } catch {
      addMessage("agent", "I encountered an issue. Please try again.");
    } finally {
      setStatusTracked("listening");
    }
  }, [addMessage, conversationId, setStatusTracked]);

  function cleanup() {
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
    }

    audioElementsRef.current.forEach((audioEl) => {
      audioEl.pause();
      audioEl.srcObject = null;
      audioEl.remove();
    });

    audioElementsRef.current = [];
    audioCtxRef.current = null;
    analyserRef.current = null;
    localAnalyserRef.current = null;
    setAudioAnalyser(null);
  }

  const toggleMic = useCallback(async () => {
    if (!callRef.current) return;
    const next = !micEnabled;
    try {
      await callRef.current.setLocalAudio(next);
      setMicEnabled(next);
    } catch {
      // State will be reconciled via participant-updated event
    }
  }, [micEnabled]);

  const setVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el;
  }, []);

  useEffect(() => {
    return () => {
      callRef.current?.destroy().catch(() => {});
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const state: TavusRoomState = {
    status,
    messages,
    conversationId,
    videoEl: videoElRef.current,
    audioAnalyser,
    error,
    micEnabled,
    micAvailable,
  };

  return { state, join, leave, sendText, setVideoRef, toggleMic };
}

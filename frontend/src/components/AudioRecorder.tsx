"use client";
import { useRef, useState, useCallback, useEffect } from "react";

interface Props {
  onChunk: (blob: Blob) => void;
  onPause: () => void;
  onStuck: () => void;
}

export function AudioRecorder({ onChunk, onPause }: Props) {
  const [recording, setRecording] = useState(false);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) onChunk(e.data); };
      recorder.start(10_000);
      setRecording(true);
      monitorSilence(analyser);
    } catch (e) {
      console.error("[Audio] Failed:", e);
    }
  }, [onChunk]);

  const stopRecording = useCallback(() => {
    if (mediaRecRef.current?.state !== "inactive") mediaRecRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setRecording(false);
  }, []);

  const monitorSilence = useCallback((analyser: AnalyserNode) => {
    const data = new Uint8Array(analyser.fftSize);
    let silentSince: number | null = null;
    const check = () => {
      if (!mediaRecRef.current) return;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / data.length);
      if (rms < 0.02) {
        if (!silentSince) silentSince = Date.now();
        else if (Date.now() - silentSince > 3000) { onPause(); silentSince = null; }
      } else { silentSince = null; }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }, [onPause]);

  useEffect(() => () => stopRecording(), []);

  return (
    <button
      onClick={recording ? stopRecording : startRecording}
      className={`h-7 flex items-center gap-1.5 px-2.5 rounded-md text-xs font-medium transition-all ${
        recording
          ? "bg-red-500/10 text-red-400 border border-red-500/20"
          : "bg-s2s-surface/50 text-s2s-text-muted hover:text-s2s-text border border-s2s-border hover:border-s2s-border-light"
      }`}
    >
      {recording && <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        {recording ? (
          <rect x="6" y="6" width="12" height="12" rx="1"/>
        ) : (
          <>
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
            <path d="M19 10v2a7 7 0 01-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
          </>
        )}
      </svg>
      {recording ? "Stop" : "Mic"}
    </button>
  );
}

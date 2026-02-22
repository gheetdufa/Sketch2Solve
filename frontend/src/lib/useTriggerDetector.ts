"use client";
import { useCallback, useRef } from "react";
import { triggerCoach } from "./api";

interface TriggerConfig {
  sessionId: string | null;
  drainAudio: () => Blob | null;
  exportWhiteboardPng: () => Promise<Blob | null>;
  onCoachResponse: (response: any) => void;
}

export function useTriggerDetector(config: TriggerConfig) {
  const pendingRef = useRef(false);

  const fire = useCallback(
    async (triggerType: string, revealMode = false) => {
      if (!config.sessionId || pendingRef.current) return;
      pendingRef.current = true;

      try {
        const [audioBlob, pngBlob] = await Promise.all([
          Promise.resolve(config.drainAudio()),
          config.exportWhiteboardPng(),
        ]);

        const result = await triggerCoach({
          sessionId: config.sessionId,
          triggerType,
          revealMode,
          audioBlob: audioBlob ?? undefined,
          whiteboardPng: pngBlob ?? undefined,
        });

        config.onCoachResponse(result);
      } catch (e) {
        console.error("[Trigger]", e);
      } finally {
        pendingRef.current = false;
      }
    },
    [config.sessionId]
  );

  return { fire, isPending: pendingRef };
}

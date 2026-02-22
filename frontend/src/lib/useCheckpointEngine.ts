"use client";
import { useEffect, useRef } from "react";
import { postCheckpoint } from "./api";

interface CheckpointSources {
  sessionId: string | null;
  getWhiteboardJson: () => string;
  getLabels: () => string;
  getPseudocode: () => string;
  getAudioBlob: () => Blob | null;
}

export function useCheckpointEngine(sources: CheckpointSources) {
  const seqRef = useRef(0);

  useEffect(() => {
    if (!sources.sessionId) return;

    const interval = setInterval(async () => {
      const seq = seqRef.current++;
      try {
        await postCheckpoint({
          sessionId: sources.sessionId!,
          sequenceNum: seq,
          pseudocode: sources.getPseudocode(),
          whiteboardJson: sources.getWhiteboardJson(),
          labels: sources.getLabels(),
          audioBlob: sources.getAudioBlob() ?? undefined,
        });
      } catch (e) {
        console.error("[Checkpoint]", e);
      }
    }, 10_000);

    return () => clearInterval(interval);
  }, [sources.sessionId]);

  return { sequenceNum: seqRef };
}

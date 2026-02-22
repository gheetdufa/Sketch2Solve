"use client";
import { useRef, useCallback } from "react";

export function useAudioBuffer() {
  const blobsRef = useRef<Blob[]>([]);

  const push = useCallback((blob: Blob) => {
    blobsRef.current.push(blob);
  }, []);

  const drain = useCallback((): Blob | null => {
    const blobs = blobsRef.current;
    blobsRef.current = [];
    if (blobs.length === 0) return null;
    return new Blob(blobs, { type: "audio/webm" });
  }, []);

  return { push, drain };
}

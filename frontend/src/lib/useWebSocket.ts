"use client";
import { useEffect, useRef, useCallback, useState } from "react";

export type WSMessage =
  | { type: "transcript_delta"; text: string; timestamp: string }
  | { type: "coach_response"; analysis: any }
  | { type: "checkpoint_saved"; checkpoint_id: string };

export function useWebSocket(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${sessionId}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        setLastMessage(msg);
      } catch {}
    };

    ws.onerror = () => {};
    ws.onclose = () => {};

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [sessionId]);

  return { lastMessage };
}

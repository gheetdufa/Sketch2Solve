"use client";
import { useEffect, useRef, useState } from "react";
import { WSMessage } from "@/lib/useWebSocket";

interface Props {
  lastMessage: WSMessage | null;
  onStuck: () => void;
}

export function LiveTranscript({ lastMessage, onStuck }: Props) {
  const [lines, setLines] = useState<{ text: string; time: string }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stuckFiredRef = useRef(false);

  useEffect(() => {
    if (!lastMessage || lastMessage.type !== "transcript_delta") return;
    const { text, timestamp } = lastMessage;
    setLines((prev) => [...prev, { text, time: timestamp }]);

    if (/i'?m stuck/i.test(text)) {
      if (!stuckFiredRef.current) {
        stuckFiredRef.current = true;
        onStuck();
        setTimeout(() => (stuckFiredRef.current = false), 10_000);
      }
    }
  }, [lastMessage, onStuck]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div className="h-full flex flex-col">
      <span className="text-2xs font-medium text-s2s-text-muted uppercase tracking-wider mb-2">
        Voice transcript
      </span>
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {lines.length === 0 && (
          <p className="text-s2s-text-muted text-xs">
            Click <span className="font-medium">Mic</span> and start speaking to see your transcript here.
          </p>
        )}
        {lines.map((l, i) => (
          <p key={i} className="text-xs text-s2s-text-secondary leading-relaxed">{l.text}</p>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSession } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    createSession()
      .then((res) => {
        if (res.session_id) router.replace(`/session/${res.session_id}`);
        else setError("Failed to create session.");
      })
      .catch(() => setError("Backend unavailable. Start the server first."));
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-s2s-bg">
      <div className="w-10 h-10 border-2 border-s2s-accent border-t-transparent rounded-full animate-spin" />
      {error ? (
        <div className="text-center space-y-3">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-s2s-surface text-s2s-text text-sm rounded-lg hover:bg-s2s-surface/80 border border-s2s-border transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <p className="text-s2s-text-muted text-sm">Starting session…</p>
      )}
    </div>
  );
}

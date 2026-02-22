"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSession, completeSession } from "@/lib/api";
import { useWebSocket } from "@/lib/useWebSocket";
import { useAudioBuffer } from "@/lib/useAudioBuffer";
import { useTriggerDetector } from "@/lib/useTriggerDetector";
import { Whiteboard, WhiteboardHandle } from "@/components/Whiteboard";
import { PseudocodeEditor, PseudocodeEditorHandle } from "@/components/PseudocodeEditor";
import { AudioRecorder } from "@/components/AudioRecorder";
import { LiveTranscript } from "@/components/LiveTranscript";
import { CoachPanel } from "@/components/CoachPanel";
import { SubmitPanel } from "@/components/SubmitPanel";

const API_BASE = "/api";

interface ProblemData {
  title?: string;
  description?: string;
  difficulty?: string;
  constraints?: string[];
  examples?: { input: string; output: string }[];
  topicTags?: string[];
}

type RightTab = "coach" | "code" | "submit" | "transcript";

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [problem, setProblem] = useState<ProblemData | null>(null);
  const [coachResponse, setCoachResponse] = useState<any>(null);
  const [coachPending, setCoachPending] = useState(false);

  const [showRightPanel, setShowRightPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<RightTab>("coach");
  const [showProblem, setShowProblem] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [hideChrome, setHideChrome] = useState(false);

  const [lcInput, setLcInput] = useState("");
  const [lcLoading, setLcLoading] = useState(false);
  const [lcError, setLcError] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const lcDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResolvedRef = useRef<string>("");

  const pseudocodeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPseudocodeRef = useRef<string>("");

  const whiteboardRef = useRef<WhiteboardHandle>(null);
  const editorRef = useRef<PseudocodeEditorHandle>(null);
  const audioBuffer = useAudioBuffer();
  const latestAudioChunkRef = useRef<Blob | null>(null);

  const { lastMessage } = useWebSocket(sessionId);

  // Blur/focus tldraw when interacting with side panel vs canvas
  const handlePanelFocus = useCallback(() => {
    whiteboardRef.current?.blurEditor();
  }, []);
  const handleCanvasFocus = useCallback(() => {
    whiteboardRef.current?.focusEditor();
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    getSession(sessionId).then((d) => { if (d.problem) setProblem(d.problem); });
  }, [sessionId]);

  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === "coach_response") {
      setCoachResponse(lastMessage.analysis);
      setCoachPending(false);
      if (lastMessage.analysis?.generated_pseudocode)
        editorRef.current?.setAiPseudocode(lastMessage.analysis.generated_pseudocode);
    }
  }, [lastMessage]);

  const handleAudioChunk = useCallback((blob: Blob) => {
    latestAudioChunkRef.current = blob;
    audioBuffer.push(blob);
  }, [audioBuffer]);

  const trigger = useTriggerDetector({
    sessionId,
    drainAudio: audioBuffer.drain,
    exportWhiteboardPng: async () => whiteboardRef.current?.exportPng() ?? null,
    onCoachResponse: (res) => {
      setCoachResponse(res);
      setCoachPending(false);
      setActiveTab("coach");
      setShowRightPanel(true);
      if (res?.generated_pseudocode)
        editorRef.current?.setAiPseudocode(res.generated_pseudocode);
    },
  });

  const fireCoach = useCallback((type: string, reveal = false) => {
    setCoachPending(true);
    trigger.fire(type, reveal);
  }, [trigger]);

  const fetchProblem = useCallback(async (value: string) => {
    const num = value.trim();
    if (!num || !/^\d+$/.test(num) || num === lastResolvedRef.current) return;
    setLcLoading(true); setLcError(""); setShowPaste(false);
    try {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/problem`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lc_id: num }),
      });
      const data = await res.json();
      if (data.problem) { setProblem(data.problem); lastResolvedRef.current = num; setLcError(""); }
      else { setLcError("Not found"); setShowPaste(true); }
    } catch { setLcError("Error"); setShowPaste(true); }
    finally { setLcLoading(false); }
  }, [sessionId]);

  useEffect(() => {
    if (lcDebounceRef.current) clearTimeout(lcDebounceRef.current);
    const num = lcInput.trim();
    if (!num || !/^\d+$/.test(num) || num === lastResolvedRef.current) return;
    lcDebounceRef.current = setTimeout(() => fetchProblem(num), 800);
    return () => { if (lcDebounceRef.current) clearTimeout(lcDebounceRef.current); };
  }, [lcInput, fetchProblem]);

  useEffect(() => {
    if (!sessionId) return;
    const LC_RE = /(?:lc|leetcode|problem|prob|#)\s*(\d{1,4})\b/i;
    const interval = setInterval(() => {
      try {
        const labels: { label: string }[] = JSON.parse(whiteboardRef.current?.getLabels() ?? "[]");
        for (const { label } of labels) {
          const m = LC_RE.exec(label);
          if (m && m[1] !== lastResolvedRef.current) { setLcInput(m[1]); fetchProblem(m[1]); return; }
          if (/^\d{1,4}$/.test(label.trim())) {
            const n = parseInt(label.trim(), 10);
            if (n >= 1 && n <= 3500 && label.trim() !== lastResolvedRef.current) {
              setLcInput(label.trim()); fetchProblem(label.trim()); return;
            }
          }
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [sessionId, fetchProblem]);

  const handlePseudocodeChange = useCallback(() => {
    if (pseudocodeDebounceRef.current) clearTimeout(pseudocodeDebounceRef.current);
    pseudocodeDebounceRef.current = setTimeout(async () => {
      const code = editorRef.current?.getValue() ?? "";
      const cleaned = code.replace(/\/\/ ---.*?---\n?/g, "").trim();
      if (cleaned.length < 10 || cleaned === lastPseudocodeRef.current) return;
      lastPseudocodeRef.current = cleaned;
      try {
        const res = await fetch(`${API_BASE}/visualize`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pseudocode: cleaned, problem_title: problem?.title ?? "" }),
        });
        const data = await res.json();
        if (data.shapes?.length) whiteboardRef.current?.addShapes(data.shapes);
      } catch {}
    }, 3000);
  }, [problem]);

  const handlePaste = async () => {
    if (!pasteText.trim()) return;
    setLcLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/problem`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem_text: pasteText.trim() }),
      });
      const data = await res.json();
      if (data.problem) { setProblem(data.problem); setLcError(""); setShowPaste(false); setPasteText(""); }
    } catch { setLcError("Error"); }
    finally { setLcLoading(false); }
  };

  const handleEnd = async () => {
    const res = await completeSession(sessionId);
    if (res.mental_model_card_id) router.push(`/card/${sessionId}`);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const monaco = (e.target as HTMLElement)?.closest?.(".monaco-editor");
      if (monaco) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "b") { e.preventDefault(); setShowRightPanel(v => !v); }
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") { e.preventDefault(); setZenMode(v => !v); }
      if ((e.metaKey || e.ctrlKey) && e.key === "p") { e.preventDefault(); setShowProblem(v => !v); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const diffBadge = problem?.difficulty === "Easy"
    ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
    : problem?.difficulty === "Medium"
    ? "bg-amber-500/10 text-amber-400 ring-amber-500/20"
    : "bg-red-500/10 text-red-400 ring-red-500/20";

  const tabs: { key: RightTab; label: string }[] = [
    { key: "coach", label: "Coach" },
    { key: "code", label: "Pseudocode" },
    { key: "submit", label: "Submit" },
    { key: "transcript", label: "Voice" },
  ];

  return (
    <div className="h-screen flex flex-col bg-s2s-bg text-s2s-text select-none">
      {/* Nav */}
      {!zenMode && (
        <nav className="h-11 flex items-center justify-between px-4 border-b border-s2s-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-s2s-accent">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-[13px] font-semibold tracking-tight">Sketch2Solve</span>
            </div>

            <div className="h-4 w-px bg-s2s-border" />

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={lcInput}
                onChange={(e) => setLcInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") fetchProblem(lcInput); e.stopPropagation(); }}
                onKeyUp={(e) => e.stopPropagation()}
                onFocus={handlePanelFocus}
                placeholder="Problem #"
                className="w-20 h-6 px-2 bg-s2s-surface/50 border border-s2s-border rounded text-xs text-s2s-text placeholder:text-s2s-text-muted focus:outline-none focus:border-s2s-accent/40 transition-colors"
              />
              {lcLoading && <div className="w-3 h-3 border-[1.5px] border-s2s-accent border-t-transparent rounded-full animate-spin" />}
              {lcError && <span className="text-2xs text-amber-400">{lcError}</span>}
            </div>

            {problem?.title && (
              <button
                onClick={() => setShowProblem(v => !v)}
                className="flex items-center gap-1.5 px-2 h-6 rounded hover:bg-s2s-surface/40 transition-colors min-w-0"
              >
                <span className="text-xs text-s2s-text-secondary truncate max-w-[200px]">{problem.title}</span>
                {problem.difficulty && (
                  <span className={`text-2xs font-medium px-1.5 py-px rounded-full ring-1 ring-inset ${diffBadge}`}>
                    {problem.difficulty}
                  </span>
                )}
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <AudioRecorder onChunk={handleAudioChunk} onPause={() => fireCoach("pause")} onStuck={() => fireCoach("stuck")} />
            <div className="h-4 w-px bg-s2s-border mx-0.5" />
            <button onClick={() => fireCoach("reflect")} disabled={coachPending} className="h-7 px-2.5 rounded-md text-xs font-medium bg-s2s-accent/10 text-s2s-accent hover:bg-s2s-accent/20 border border-s2s-accent/15 transition-all disabled:opacity-40">Reflect</button>
            <button onClick={() => fireCoach("hint")} disabled={coachPending} className="h-7 px-2.5 rounded-md text-xs font-medium bg-s2s-hint-muted text-s2s-hint hover:bg-amber-500/20 border border-amber-500/15 transition-all disabled:opacity-40">Hint</button>
            <div className="h-4 w-px bg-s2s-border mx-0.5" />
            <button onClick={() => { setShowRightPanel(v => !v); }} className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${showRightPanel ? "bg-s2s-surface text-s2s-text" : "text-s2s-text-muted hover:text-s2s-text hover:bg-s2s-surface/40"}`} title="Toggle panel (Ctrl+B)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
            </button>
            <button onClick={() => setHideChrome(v => !v)} className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${hideChrome ? "bg-s2s-surface text-s2s-text" : "text-s2s-text-muted hover:text-s2s-text hover:bg-s2s-surface/40"}`} title="Toggle drawing tools">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button onClick={() => setZenMode(true)} className="h-7 w-7 flex items-center justify-center rounded-md text-s2s-text-muted hover:text-s2s-text hover:bg-s2s-surface/40 transition-colors" title="Focus mode (Ctrl+\)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>
            </button>
            <div className="h-4 w-px bg-s2s-border mx-0.5" />
            <button onClick={handleEnd} className="h-7 px-2.5 rounded-md text-xs text-s2s-text-muted hover:text-s2s-text hover:bg-s2s-surface/40 transition-colors">End</button>
          </div>
        </nav>
      )}

      {zenMode && (
        <button onClick={() => setZenMode(false)} className="fixed top-3 right-3 z-[200] h-7 px-3 rounded-md text-2xs text-s2s-text-muted hover:text-s2s-text bg-s2s-bg/80 backdrop-blur border border-s2s-border transition-colors">
          Exit focus
        </button>
      )}

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative" onMouseDown={handleCanvasFocus}>
          <Whiteboard ref={whiteboardRef} hideChrome={hideChrome} />

          {showPaste && (
            <div className="absolute top-4 left-4 z-50 w-80 bg-s2s-panel border border-s2s-border rounded-lg shadow-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-s2s-text">Paste problem text</span>
                <button onClick={() => setShowPaste(false)} className="text-s2s-text-muted hover:text-s2s-text">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <textarea
                value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()} onKeyUp={(e) => e.stopPropagation()}
                onFocus={handlePanelFocus}
                placeholder="Paste full problem description…" rows={5}
                className="w-full p-2 bg-s2s-surface border border-s2s-border rounded text-xs text-s2s-text placeholder:text-s2s-text-muted focus:outline-none focus:border-s2s-accent/40 resize-none font-mono"
              />
              <button onClick={handlePaste} disabled={!pasteText.trim() || lcLoading} className="mt-2 w-full h-7 bg-s2s-accent/10 hover:bg-s2s-accent/20 border border-s2s-accent/15 rounded text-xs text-s2s-accent font-medium transition-colors disabled:opacity-40">
                {lcLoading ? "Loading…" : "Use problem"}
              </button>
            </div>
          )}

          {showProblem && problem && (
            <div className="absolute top-4 left-4 z-50 w-[440px] max-h-[75vh] bg-s2s-panel border border-s2s-border rounded-lg shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-s2s-border">
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="text-sm font-semibold truncate">{problem.title}</h2>
                  {problem.difficulty && <span className={`text-2xs font-medium px-1.5 py-px rounded-full ring-1 ring-inset shrink-0 ${diffBadge}`}>{problem.difficulty}</span>}
                </div>
                <button onClick={() => setShowProblem(false)} className="text-s2s-text-muted hover:text-s2s-text p-1 rounded hover:bg-s2s-surface transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="px-4 py-3 overflow-y-auto max-h-[65vh]">
                {problem.topicTags && problem.topicTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {problem.topicTags.map((tag) => (
                      <span key={tag} className="text-2xs px-1.5 py-0.5 bg-s2s-surface rounded text-s2s-text-muted font-medium">{tag}</span>
                    ))}
                  </div>
                )}
                <div className="text-[13px] text-s2s-text-secondary leading-relaxed prose prose-invert prose-sm max-w-none [&_pre]:bg-s2s-surface [&_pre]:rounded [&_pre]:p-2.5 [&_pre]:text-xs [&_code]:text-s2s-accent/80 [&_strong]:text-s2s-text" dangerouslySetInnerHTML={{ __html: problem.description || "" }} />
              </div>
            </div>
          )}
        </div>

        {/* Right panel */}
        {showRightPanel && !zenMode && (
          <aside
            className="w-[340px] border-l border-s2s-border flex flex-col shrink-0 bg-s2s-panel"
            onMouseDown={handlePanelFocus}
            onFocusCapture={handlePanelFocus}
          >
            <div className="h-10 flex items-center border-b border-s2s-border px-1 shrink-0">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 h-full text-xs font-medium transition-colors relative ${activeTab === tab.key ? "text-s2s-accent" : "text-s2s-text-muted hover:text-s2s-text-secondary"}`}
                >
                  {tab.label}
                  {activeTab === tab.key && <span className="absolute bottom-0 left-1/4 right-1/4 h-[2px] bg-s2s-accent rounded-full" />}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-hidden">
              <div className={`h-full overflow-y-auto p-3 ${activeTab === "coach" ? "" : "hidden"}`}>
                <CoachPanel analysis={coachResponse} onReflect={() => fireCoach("reflect")} onHint={() => fireCoach("hint")} onReveal={() => fireCoach("reveal", true)} isPending={coachPending} />
              </div>

              <div className={`h-full flex flex-col ${activeTab === "code" ? "" : "hidden"}`}>
                <div className="flex-1 p-1">
                  <PseudocodeEditor ref={editorRef} onDelta={handlePseudocodeChange} />
                </div>
              </div>

              <div className={`h-full flex flex-col ${activeTab === "submit" ? "" : "hidden"}`}>
                <SubmitPanel sessionId={sessionId} problem={problem} />
              </div>

              <div className={`h-full p-3 ${activeTab === "transcript" ? "" : "hidden"}`}>
                <LiveTranscript lastMessage={lastMessage} onStuck={() => fireCoach("stuck")} />
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

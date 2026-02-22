"use client";
import { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react").then((m) => m.default), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center text-s2s-text-muted text-xs">Loading…</div>,
});

const LANGUAGES = [
  { value: "python", label: "Python", default: "class Solution:\n    def solve(self, nums):\n        pass\n" },
  { value: "javascript", label: "JavaScript", default: "var solve = function(nums) {\n    \n};\n" },
  { value: "typescript", label: "TypeScript", default: "function solve(nums: number[]): number {\n    \n}\n" },
  { value: "java", label: "Java", default: "class Solution {\n    public int solve(int[] nums) {\n        \n    }\n}\n" },
  { value: "cpp", label: "C++", default: "class Solution {\npublic:\n    int solve(vector<int>& nums) {\n        \n    }\n};\n" },
] as const;

interface TestResult {
  passed: boolean;
  input?: string;
  expected?: string;
  actual?: string;
  error?: string;
}

interface VerifyResponse {
  status: "pass" | "fail" | "error";
  summary: string;
  results: TestResult[];
  feedback?: string;
}

interface Props {
  sessionId: string;
  problem: { title?: string; description?: string } | null;
}

export function SubmitPanel({ sessionId, problem }: Props) {
  const [language, setLanguage] = useState("python");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const codeRef = useRef("");
  const editorInstanceRef = useRef<any>(null);

  const langConfig = LANGUAGES.find((l) => l.value === language) ?? LANGUAGES[0];

  const handleSubmit = useCallback(async () => {
    const code = codeRef.current.trim();
    if (!code) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          code,
          language,
          problem_title: problem?.title ?? "",
        }),
      });
      const data: VerifyResponse = await res.json();
      setResult(data);
    } catch {
      setResult({ status: "error", summary: "Network error — could not reach server.", results: [] });
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, language, problem]);

  return (
    <div className="h-full flex flex-col">
      {/* Language selector */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-s2s-border shrink-0">
        <span className="text-2xs text-s2s-text-muted uppercase tracking-wider">Lang</span>
        <select
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value);
            const lang = LANGUAGES.find((l) => l.value === e.target.value);
            if (lang && editorInstanceRef.current && !codeRef.current.trim()) {
              editorInstanceRef.current.setValue(lang.default);
            }
          }}
          className="h-6 px-1.5 bg-s2s-surface border border-s2s-border rounded text-xs text-s2s-text focus:outline-none focus:border-s2s-accent/40"
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
        <div className="flex-1" />
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="h-7 px-3 rounded-md text-xs font-medium bg-s2s-success/10 text-s2s-success hover:bg-s2s-success/20 border border-emerald-500/15 transition-all disabled:opacity-40"
        >
          {submitting ? "Checking…" : "Verify"}
        </button>
      </div>

      {/* Code editor */}
      <div className="flex-1 min-h-0">
        <MonacoEditor
          height="100%"
          language={language === "cpp" ? "cpp" : language}
          defaultValue={langConfig.default}
          theme="vs-dark"
          onChange={(v) => { codeRef.current = v ?? ""; }}
          onMount={(editor) => { editorInstanceRef.current = editor; }}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            lineNumbers: "on",
            wordWrap: "on",
            padding: { top: 8 },
            scrollBeyondLastLine: false,
            renderLineHighlight: "gutter",
            overviewRulerLanes: 0,
            scrollbar: { verticalScrollbarSize: 4 },
          }}
        />
      </div>

      {/* Results */}
      {result && (
        <div className="border-t border-s2s-border px-3 py-2 max-h-[200px] overflow-y-auto shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs font-semibold ${
              result.status === "pass" ? "text-s2s-success" : result.status === "fail" ? "text-s2s-danger" : "text-amber-400"
            }`}>
              {result.status === "pass" ? "All tests passed" : result.status === "fail" ? "Tests failed" : "Error"}
            </span>
          </div>
          <p className="text-xs text-s2s-text-secondary mb-2">{result.summary}</p>

          {result.results.map((r, i) => (
            <div key={i} className={`p-2 rounded mb-1.5 text-xs font-mono ${r.passed ? "bg-emerald-500/8 border border-emerald-500/10" : "bg-red-500/8 border border-red-500/10"}`}>
              {r.error ? (
                <span className="text-red-400">{r.error}</span>
              ) : (
                <>
                  <div className="text-s2s-text-muted">Input: <span className="text-s2s-text-secondary">{r.input}</span></div>
                  <div className="text-s2s-text-muted">Expected: <span className="text-s2s-text-secondary">{r.expected}</span></div>
                  {!r.passed && <div className="text-s2s-text-muted">Got: <span className="text-red-400">{r.actual}</span></div>}
                </>
              )}
            </div>
          ))}

          {result.feedback && (
            <div className="mt-2 p-2 bg-s2s-surface/50 rounded text-xs text-s2s-text-secondary leading-relaxed">
              {result.feedback}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";
import { useState } from "react";

interface CoachResponse {
  analysis_id?: string;
  inferred_approach?: {
    pattern?: string;
    confidence?: number;
    evidence?: string;
  };
  visual_description?: string;
  missing_pieces?: string[];
  questions?: string[];
  micro_hint?: string;
  reveal_outline?: string | null;
  hint_audio_url?: string | null;
  generated_pseudocode?: string | null;
}

interface Props {
  analysis: CoachResponse | null;
  onReflect: () => void;
  onHint: () => void;
  onReveal: () => void;
  isPending: boolean;
}

export function CoachPanel({ analysis, onReflect, onHint, onReveal, isPending }: Props) {
  const [showReveal, setShowReveal] = useState(false);
  const approach = analysis?.inferred_approach;
  const confidence = approach?.confidence ?? 0;

  if (isPending) {
    return (
      <div className="flex items-center gap-2.5 p-3 bg-s2s-surface/50 rounded-lg">
        <div className="w-3.5 h-3.5 border-[1.5px] border-s2s-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-s2s-text-muted">Analyzing your approach…</span>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-6">
        <div className="w-10 h-10 rounded-full bg-s2s-surface flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-s2s-text-muted">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="text-center text-s2s-text-muted text-xs leading-relaxed">
          Draw your approach on the whiteboard, then click <span className="text-s2s-accent font-medium">Reflect</span> or <span className="text-s2s-hint font-medium">Hint</span> to get feedback.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Pattern */}
      {approach?.pattern && (
        <div className="p-3 bg-s2s-surface/60 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xs font-medium text-s2s-text-muted uppercase tracking-wider">Pattern</span>
            <span className="text-2xs text-s2s-text-muted font-mono">{Math.round(confidence * 100)}%</span>
          </div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="text-sm font-semibold text-s2s-accent">{approach.pattern}</span>
            <div className="flex-1 h-1 bg-s2s-border rounded-full overflow-hidden">
              <div className="h-full bg-s2s-accent rounded-full transition-all duration-700" style={{ width: `${confidence * 100}%` }} />
            </div>
          </div>
          {approach.evidence && (
            <p className="text-xs text-s2s-text-secondary leading-relaxed">{approach.evidence}</p>
          )}
        </div>
      )}

      {/* Missing pieces */}
      {analysis.missing_pieces && analysis.missing_pieces.length > 0 && (
        <div className="p-3 bg-s2s-surface/60 rounded-lg">
          <span className="text-2xs font-medium text-s2s-text-muted uppercase tracking-wider">Still needed</span>
          <ul className="mt-2 space-y-1.5">
            {analysis.missing_pieces.map((piece, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-s2s-text-secondary leading-relaxed">
                <span className="mt-[5px] w-1 h-1 bg-s2s-hint rounded-full shrink-0" />
                {piece}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Questions */}
      {analysis.questions && analysis.questions.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-2xs font-medium text-s2s-text-muted uppercase tracking-wider px-1">Think about</span>
          {analysis.questions.map((q, i) => (
            <div key={i} className="p-2.5 bg-s2s-surface/40 border border-s2s-border/50 rounded-lg">
              <p className="text-xs text-s2s-text leading-relaxed">
                <span className="text-s2s-accent font-mono font-medium mr-1.5">{i + 1}.</span>
                {q}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Hint */}
      {analysis.micro_hint && (
        <div className="p-3 bg-s2s-hint-muted border border-amber-500/10 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-2xs font-medium text-s2s-hint uppercase tracking-wider">Nudge</span>
            {analysis.hint_audio_url && (
              <button
                onClick={() => new Audio(analysis.hint_audio_url!).play()}
                className="text-2xs text-s2s-hint hover:text-amber-300 transition-colors"
              >
                ▶ Play
              </button>
            )}
          </div>
          <p className="text-xs text-s2s-text leading-relaxed">{analysis.micro_hint}</p>
        </div>
      )}

      {/* Reveal */}
      {analysis.reveal_outline ? (
        <div className="p-3 bg-emerald-500/8 border border-emerald-500/15 rounded-lg">
          <span className="text-2xs font-medium text-emerald-400 uppercase tracking-wider">Outline</span>
          <p className="mt-1.5 text-xs text-s2s-text-secondary leading-relaxed whitespace-pre-wrap">{analysis.reveal_outline}</p>
        </div>
      ) : (
        <div>
          {!showReveal ? (
            <button
              onClick={() => setShowReveal(true)}
              className="w-full h-8 text-xs text-s2s-text-muted hover:text-s2s-text-secondary border border-dashed border-s2s-border hover:border-s2s-border-light rounded-lg transition-colors"
            >
              Reveal outline…
            </button>
          ) : (
            <div className="p-3 bg-red-500/8 border border-red-500/15 rounded-lg">
              <p className="text-xs text-red-300/80 mb-2">Show a high-level solution outline?</p>
              <div className="flex gap-2">
                <button onClick={() => { setShowReveal(false); onReveal(); }} className="h-7 px-3 text-xs bg-red-500/15 hover:bg-red-500/25 text-red-300 rounded-md transition-colors">
                  Reveal
                </button>
                <button onClick={() => setShowReveal(false)} className="h-7 px-3 text-xs bg-s2s-surface hover:bg-s2s-surface/80 text-s2s-text-muted rounded-md transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";
import { Brain, TrendingUp, HelpCircle, FileText } from "lucide-react";

interface CardData {
  id: string;
  final_pattern: string;
  key_invariants: string[];
  approach_evolution: { sequence_num: string; pattern: string; confidence: number }[];
  unanswered_questions: string[];
  full_transcript: string;
}

interface Props {
  card: CardData;
}

export function MentalModelCard({ card }: Props) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <Brain size={40} className="mx-auto text-coach-accent mb-3" />
        <h1 className="text-2xl font-bold text-coach-text">Mental Model Card</h1>
        <p className="text-coach-muted text-sm mt-1">Session summary and approach evolution</p>
      </div>

      {/* Final pattern */}
      <div className="p-5 bg-coach-surface rounded-xl border border-slate-700">
        <h2 className="text-xs uppercase tracking-wider text-coach-muted mb-2">
          Final Inferred Pattern
        </h2>
        <span className="inline-block px-3 py-1.5 bg-coach-accent/20 text-coach-accent text-lg font-bold rounded-lg">
          {card.final_pattern || "—"}
        </span>
      </div>

      {/* Evolution */}
      {card.approach_evolution.length > 0 && (
        <div className="p-5 bg-coach-surface rounded-xl border border-slate-700">
          <h2 className="flex items-center gap-2 text-xs uppercase tracking-wider text-coach-muted mb-3">
            <TrendingUp size={14} />
            Approach Evolution
          </h2>
          <div className="flex items-end gap-2 h-24">
            {card.approach_evolution.map((e, i) => (
              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                <div
                  className="w-full bg-coach-accent/30 rounded-t"
                  style={{ height: `${(e.confidence || 0.1) * 80}px` }}
                />
                <span className="text-[9px] text-coach-muted truncate max-w-full">
                  {e.pattern}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key invariants */}
      {card.key_invariants.length > 0 && (
        <div className="p-5 bg-coach-surface rounded-xl border border-slate-700">
          <h2 className="text-xs uppercase tracking-wider text-coach-muted mb-2">
            Key Observations
          </h2>
          <ul className="space-y-1">
            {card.key_invariants.map((inv, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-coach-text/80">
                <span className="mt-1.5 w-1.5 h-1.5 bg-coach-accent rounded-full shrink-0" />
                {inv}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Unanswered questions */}
      {card.unanswered_questions.length > 0 && (
        <div className="p-5 bg-coach-surface rounded-xl border border-slate-700">
          <h2 className="flex items-center gap-2 text-xs uppercase tracking-wider text-coach-muted mb-2">
            <HelpCircle size={14} />
            Questions to Revisit
          </h2>
          <ul className="space-y-1">
            {card.unanswered_questions.map((q, i) => (
              <li key={i} className="text-sm text-coach-text/80">
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Transcript */}
      {card.full_transcript && (
        <details className="p-5 bg-coach-surface rounded-xl border border-slate-700">
          <summary className="flex items-center gap-2 text-xs uppercase tracking-wider text-coach-muted cursor-pointer">
            <FileText size={14} />
            Full Transcript
          </summary>
          <p className="mt-3 text-sm text-coach-text/70 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
            {card.full_transcript}
          </p>
        </details>
      )}
    </div>
  );
}

"use client";

interface TimelineEntry {
  checkpoint_id: string;
  sequence_num: number;
}

interface Props {
  entries: TimelineEntry[];
}

export function SessionTimeline({ entries }: Props) {
  if (entries.length === 0) return null;

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      <span className="text-[10px] text-coach-muted uppercase tracking-wider shrink-0 mr-1">
        Checkpoints
      </span>
      {entries.map((e, i) => (
        <div
          key={e.checkpoint_id}
          className="w-6 h-6 flex items-center justify-center rounded bg-coach-surface text-[10px] text-coach-muted border border-slate-700 shrink-0"
          title={`Checkpoint ${e.sequence_num}`}
        >
          {e.sequence_num}
        </div>
      ))}
    </div>
  );
}

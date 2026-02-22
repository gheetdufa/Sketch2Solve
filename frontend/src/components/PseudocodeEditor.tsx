"use client";
import { useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react").then((m) => m.default), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center text-s2s-text-muted text-xs">Loading…</div>
  ),
});

const AI_START = "// --- AI interpretation (from whiteboard) ---";
const AI_END = "// --- end AI ---";

export interface PseudocodeEditorHandle {
  getValue: () => string;
  setAiPseudocode: (text: string) => void;
}

interface Props {
  onDelta?: () => void;
}

export const PseudocodeEditor = forwardRef<PseudocodeEditorHandle, Props>(
  function PseudocodeEditor({ onDelta }, ref) {
    const valueRef = useRef("");
    const prevBlockCountRef = useRef(0);
    const editorInstanceRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      getValue: () => valueRef.current,
      setAiPseudocode: (text: string) => {
        if (!text.trim()) return;
        const editor = editorInstanceRef.current;
        const current = valueRef.current;
        const aiBlock = `${AI_START}\n${text.trim()}\n${AI_END}`;
        let newValue: string;

        const startIdx = current.indexOf(AI_START);
        const endIdx = current.indexOf(AI_END);
        if (startIdx !== -1 && endIdx !== -1) {
          newValue = current.substring(0, startIdx) + aiBlock + current.substring(endIdx + AI_END.length);
        } else {
          const user = current.trim();
          newValue = user && !user.startsWith("// Write")
            ? aiBlock + "\n\n" + user
            : aiBlock + "\n\n// Your notes below…\n";
        }
        valueRef.current = newValue;
        if (editor) editor.setValue(newValue);
      },
    }));

    const handleChange = useCallback((value: string | undefined) => {
      const v = value ?? "";
      valueRef.current = v;
      const blocks = v.split(/\n\s*\n/).filter((b) => b.trim().length > 0);
      if (blocks.length > prevBlockCountRef.current && prevBlockCountRef.current > 0) onDelta?.();
      prevBlockCountRef.current = blocks.length;
    }, [onDelta]);

    return (
      <div className="h-full w-full rounded-lg overflow-hidden border border-s2s-border">
        <MonacoEditor
          height="100%"
          defaultLanguage="plaintext"
          defaultValue="// Write your pseudocode here…"
          theme="vs-dark"
          onChange={handleChange}
          onMount={(editor) => { editorInstanceRef.current = editor; }}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            lineNumbers: "on",
            wordWrap: "on",
            padding: { top: 8 },
            scrollBeyondLastLine: false,
            renderLineHighlight: "none",
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            scrollbar: { verticalScrollbarSize: 4 },
          }}
        />
      </div>
    );
  }
);

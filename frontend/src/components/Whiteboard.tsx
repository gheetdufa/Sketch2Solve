"use client";
import { useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import { Tldraw, Editor, TLShapePartial } from "tldraw";
import "tldraw/tldraw.css";

function makeId(tag: string): any {
  return `shape:${tag}` as any;
}

export interface WhiteboardHandle {
  getSnapshot: () => string;
  getLabels: () => string;
  exportPng: () => Promise<Blob | null>;
  addShapes: (shapes: VisualShape[]) => void;
  clearAiShapes: () => void;
  blurEditor: () => void;
  focusEditor: () => void;
}

export interface VisualShape {
  type: "box" | "text" | "arrow";
  id?: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  label: string;
  color?: string;
  from?: string;
  to?: string;
}

const AI_PREFIX = "ai_viz_";

const HIDDEN_COMPONENTS = {
  StylePanel: null,
  Toolbar: null,
  MainMenu: null,
  PageMenu: null,
  NavigationPanel: null,
  Minimap: null,
  ActionsMenu: null,
  HelperButtons: null,
  ZoomMenu: null,
  HelpMenu: null,
  DebugMenu: null,
  DebugPanel: null,
  SharePanel: null,
  MenuPanel: null,
  TopPanel: null,
};

interface WhiteboardProps {
  hideChrome?: boolean;
}

export const Whiteboard = forwardRef<WhiteboardHandle, WhiteboardProps>(function Whiteboard({ hideChrome }, ref) {
  const editorRef = useRef<Editor | null>(null);

  const extractLabels = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return [];
    const shapes = editor.getCurrentPageShapes();
    return shapes
      .filter((s: any) => {
        const text = s.props?.text || s.props?.label || "";
        return text.trim().length > 0;
      })
      .map((s: any) => ({
        shape_id: s.id,
        label: (s.props?.text || s.props?.label || "").trim(),
      }));
  }, []);

  useImperativeHandle(ref, () => ({
    getSnapshot: () => {
      const editor = editorRef.current;
      if (!editor) return "{}";
      try {
        return JSON.stringify(editor.store.getSnapshot());
      } catch {
        return "{}";
      }
    },
    getLabels: () => JSON.stringify(extractLabels()),
    exportPng: async () => {
      const editor = editorRef.current;
      if (!editor) return null;
      try {
        const shapeIds = [...editor.getCurrentPageShapeIds()];
        if (shapeIds.length === 0) return null;
        const result = await (editor as any).toImage(shapeIds, { format: "png", background: true, scale: 2, padding: 16 });
        return result?.blob ?? null;
      } catch (e) {
        console.warn("[Whiteboard] PNG export failed:", e);
        return null;
      }
    },

    blurEditor: () => {
      editorRef.current?.blur();
    },
    focusEditor: () => {
      editorRef.current?.focus();
    },

    clearAiShapes: () => {
      const editor = editorRef.current;
      if (!editor) return;
      const aiIds = editor.getCurrentPageShapes()
        .filter((s) => (s.id as string).includes(AI_PREFIX))
        .map((s) => s.id);
      if (aiIds.length > 0) editor.deleteShapes(aiIds);
    },

    addShapes: (shapes: VisualShape[]) => {
      const editor = editorRef.current;
      if (!editor || shapes.length === 0) return;

      // Remove previous AI visualization
      const oldAiIds = editor.getCurrentPageShapes()
        .filter((s) => (s.id as string).includes(AI_PREFIX))
        .map((s) => s.id);
      if (oldAiIds.length > 0) editor.deleteShapes(oldAiIds);

      // Offset to the right of existing user content
      const bounds = editor.getCurrentPageBounds();
      const offsetX = bounds ? bounds.maxX + 100 : 100;
      const offsetY = bounds ? bounds.y : 50;

      // Build a position map so arrows know where boxes are
      const posMap = new Map<string, { x: number; y: number; w: number; h: number }>();
      const shapePartials: TLShapePartial[] = [];

      for (const s of shapes) {
        if (s.type === "arrow") continue;
        const rawId = s.id || Math.random().toString(36).slice(2, 8);
        const w = s.w || 140;
        const h = s.h || 50;
        posMap.set(rawId, { x: s.x || 0, y: s.y || 0, w, h });

        if (s.type === "box") {
          shapePartials.push({
            id: makeId(`${AI_PREFIX}${rawId}`),
            type: "geo",
            x: offsetX + (s.x || 0),
            y: offsetY + (s.y || 0),
            props: {
              w,
              h,
              text: s.label || "",
              color: (["green", "red", "yellow", "blue"] as const).includes(s.color as any) ? s.color : "violet",
              geo: "rectangle",
              font: "mono",
              size: "s",
            },
          });
        } else if (s.type === "text") {
          shapePartials.push({
            id: makeId(`${AI_PREFIX}${rawId}`),
            type: "text",
            x: offsetX + (s.x || 0),
            y: offsetY + (s.y || 0),
            props: {
              text: s.label || "",
              color: "violet",
              font: "mono",
              size: "s",
            },
          });
        }
      }

      // Create arrows as geo shapes with arrow labels (simple, no bindings needed)
      for (const s of shapes) {
        if (s.type !== "arrow" || !s.from || !s.to) continue;
        const fromPos = posMap.get(s.from);
        const toPos = posMap.get(s.to);
        if (!fromPos || !toPos) continue;

        const rawId = s.id || `arrow_${s.from}_${s.to}`;
        const fromCenterX = fromPos.x + fromPos.w / 2;
        const fromBottomY = fromPos.y + fromPos.h;
        const toCenterX = toPos.x + toPos.w / 2;
        const toTopY = toPos.y;

        shapePartials.push({
          id: makeId(`${AI_PREFIX}${rawId}`),
          type: "arrow",
          x: offsetX + fromCenterX,
          y: offsetY + fromBottomY,
          props: {
            start: { x: 0, y: 0 },
            end: { x: toCenterX - fromCenterX, y: toTopY - fromBottomY },
            text: s.label || "",
            color: "violet",
            font: "mono",
            size: "s",
          },
        } as any);
      }

      if (shapePartials.length > 0) {
        try {
          editor.createShapes(shapePartials);
        } catch (e) {
          console.warn("[Whiteboard] Failed to create AI shapes:", e);
        }
      }
    },
  }));

  return (
    <div className="h-full w-full overflow-hidden">
      <Tldraw
        onMount={(editor) => {
          editorRef.current = editor;
          editor.setCurrentTool("draw");
        }}
        {...(hideChrome ? { components: HIDDEN_COMPONENTS as any } : {})}
      />
    </div>
  );
});

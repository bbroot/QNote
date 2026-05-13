import { useEffect, useRef, useCallback, useState } from "react";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { keymap } from "prosemirror-keymap";
import { baseKeymap, toggleMark, setBlockType, wrapIn, chainCommands, newlineInCode, createParagraphNear, liftEmptyBlock, splitBlock } from "prosemirror-commands";
import { wrapInList } from "prosemirror-schema-list";
import { history, undo, redo } from "prosemirror-history";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import { tableEditing } from "prosemirror-tables";
import { useEditorStore } from "../store/editorStore";
import { editorSchema } from "../lib/schema";
import { parseMarkdown, serializeToMarkdown } from "../lib/markdown";
import { setEditorView } from "../lib/editorView";

export default function Editor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const {
    tabs,
    activeTabId,
    updateTabContent,
    editorMode,
    fontSize,
    lineHeight,
  } = useEditorStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const parseContent = useCallback((text: string) => {
    if (!text.trim()) {
      return editorSchema.node("doc", null, [editorSchema.node("paragraph", null, [])]);
    }
    try {
      return parseMarkdown(text);
    } catch {
      return editorSchema.node("doc", null, [editorSchema.node("paragraph", null, [])]);
    }
  }, []);

  // Serialize ProseMirror doc → markdown string
  const getPlainText = useCallback((state: EditorState): string => {
    try {
      return serializeToMarkdown(state.doc);
    } catch {
      let text = "";
      state.doc.descendants((node) => {
        if (node.isTextblock) text += node.textContent + "\n";
      });
      return text;
    }
  }, []);

  // ── Source mode state: self-contained, never conflicts with store ──
  const [sourceContent, setSourceContent] = useState("");

  // Track which content version is "live" for source mode
  const sourceModeStableRef = useRef(false);

  // Initialize / sync source content when entering source mode
  // or when the tab changes while in source mode
  useEffect(() => {
    if (editorMode === "source" && activeTab) {
      // Use what's already in the store as the source of truth for tab switches
      setSourceContent(activeTab.content);
    }
  }, [editorMode, activeTabId, activeTab?.content]);

  // ── Create ProseMirror editor ──────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const createEditor = useCallback(() => {
    if (!editorRef.current || !activeTab) return;

    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    const state = EditorState.create({
      doc: parseContent(activeTab.content),
      plugins: [
        history(),
        keymap({
          "Mod-z": undo,
          "Mod-y": redo,
          "Mod-Shift-z": redo,
          "Mod-b": toggleMark(editorSchema.marks.strong),
          "Mod-i": toggleMark(editorSchema.marks.em),
          "Mod-`": toggleMark(editorSchema.marks.code),
          "Mod-Shift-s": toggleMark(editorSchema.marks.strikethrough),
          "Mod-1": setBlockType(editorSchema.nodes.heading, { level: 1 }),
          "Mod-2": setBlockType(editorSchema.nodes.heading, { level: 2 }),
          "Mod-3": setBlockType(editorSchema.nodes.heading, { level: 3 }),
          "Mod-0": setBlockType(editorSchema.nodes.paragraph),
        }),
        keymap(baseKeymap),
        tableEditing(),
        dropCursor(),
        gapCursor(),
      ],
    });

    const view = new EditorView(editorRef.current, {
      state,
      handleKeyDown(view, event) {
        if (event.key === "Enter" && !event.shiftKey) {
          const cmd = chainCommands(newlineInCode, createParagraphNear, liftEmptyBlock, splitBlock);
          if (cmd(view.state, view.dispatch, view)) {
            return true;
          }
        }
        return false;
      },
      dispatchTransaction(tr) {
        const newState = view.state.apply(tr);
        view.updateState(newState);
        if (tr.docChanged && activeTabId) {
          updateTabContent(activeTabId, getPlainText(newState));
        }
      },
    });

    viewRef.current = view;
    setEditorView(view);
  }, [activeTabId]);

  // Mount / unmount editor based on editorMode
  useEffect(() => {
    if (editorMode === "wysiwyg") {
      sourceModeStableRef.current = false;
      createEditor();
    } else {
      // Switching to source: destroy editor so it doesn't run in background
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
        setEditorView(null);
      }
    }

    return () => {
      // Cleanup when Editor unmounts entirely
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
        setEditorView(null);
      }
    };
  }, [editorMode, createEditor]);

  // ── Sync when tab content changes externally (e.g. history restore, save) ──
  // Only in WYSIWYG mode — source mode manages its own content
  useEffect(() => {
    if (editorMode !== "wysiwyg" || !viewRef.current || !activeTab) return;
    const currentText = getPlainText(viewRef.current.state);
    if (currentText !== activeTab.content) {
      const newState = EditorState.create({
        doc: parseContent(activeTab.content),
        plugins: viewRef.current.state.plugins,
      });
      viewRef.current.updateState(newState);
    }
  }, [activeTab?.content, editorMode, parseContent, getPlainText]);

  // ── Image paste handler ────────────────────────────────────────────
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!viewRef.current) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            const src = reader.result as string;
            const node = editorSchema.nodes.image.create({ src, alt: file.name });
            const tr = viewRef.current!.state.tr.replaceSelectionWith(node);
            viewRef.current!.dispatch(tr);
            viewRef.current!.focus();
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  // ── Editor commands from toolbar ───────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      if (!viewRef.current) return;
      const cmd = (e as CustomEvent).detail as string;
      const { state, dispatch } = viewRef.current;

      switch (cmd) {
        case "bold":
          toggleMark(editorSchema.marks.strong)(state, dispatch);
          break;
        case "italic":
          toggleMark(editorSchema.marks.em)(state, dispatch);
          break;
        case "strikethrough":
          toggleMark(editorSchema.marks.strikethrough)(state, dispatch);
          break;
        case "code":
          toggleMark(editorSchema.marks.code)(state, dispatch);
          break;
        case "link": {
          const url = prompt("链接地址:");
          if (url) {
            const linkMark = editorSchema.marks.link.create({ href: url });
            const { from, to } = state.selection;
            dispatch(state.tr.addMark(from, to, linkMark));
          }
          break;
        }
        case "image": {
          const url = prompt("图片 URL:");
          if (url) {
            const node = editorSchema.nodes.image.create({ src: url, alt: "" });
            dispatch(state.tr.replaceSelectionWith(node));
          }
          break;
        }
        case "heading1":
          setBlockType(editorSchema.nodes.heading, { level: 1 })(state, dispatch);
          break;
        case "heading2":
          setBlockType(editorSchema.nodes.heading, { level: 2 })(state, dispatch);
          break;
        case "heading3":
          setBlockType(editorSchema.nodes.heading, { level: 3 })(state, dispatch);
          break;
        case "blockquote":
          wrapIn(editorSchema.nodes.blockquote)(state, dispatch);
          break;
        case "codeBlock":
          setBlockType(editorSchema.nodes.code_block)(state, dispatch);
          break;
        case "bulletList":
          wrapInList(editorSchema.nodes.bullet_list)(state, dispatch);
          break;
        case "orderedList":
          wrapInList(editorSchema.nodes.ordered_list)(state, dispatch);
          break;
        case "hr":
          dispatch(state.tr.replaceSelectionWith(editorSchema.nodes.horizontal_rule.create()));
          break;
      }
      viewRef.current.focus();
    };
    document.addEventListener("editor-command", handler);
    return () => document.removeEventListener("editor-command", handler);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────
  if (editorMode === "source") {
    return (
      <SourceMode
        value={sourceContent}
        onChange={(v) => setSourceContent(v)}
        onConfirm={() => {
          if (activeTabId) updateTabContent(activeTabId, sourceContent);
        }}
        wordCount={activeTab?.wordCount || 0}
      />
    );
  }

  return (
    <div className="editor-area h-full overflow-y-auto">
      <div
        ref={editorRef}
        style={{
          fontSize: `${fontSize}px`,
          lineHeight,
        }}
      />
    </div>
  );
}

// ── Source mode — self-contained, does NOT touch the store until confirmed ──
function SourceMode({
  value,
  onChange,
  onConfirm,
  wordCount,
}: {
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  wordCount: number;
}) {
  const { toggleEditorMode } = useEditorStore();
  const markDirty = useEditorStore((s) => s.markDirty);

  // Listen for external confirm events (e.g., from ⌘S in App.tsx)
  useEffect(() => {
    const handler = () => onConfirm();
    document.addEventListener("source-mode-confirm", handler);
    return () => document.removeEventListener("source-mode-confirm", handler);
  }, [onConfirm]);

  // Auto-save on blur (user leaves textarea)
  const handleBlur = () => {
    onConfirm();
  };

  // Also sync on every change for safety (no-op if content unchanged)
  const handleChange = (newValue: string) => {
    onChange(newValue);
    // Mark dirty so auto-save picks up source mode changes
    markDirty();
  };

  const handleToggleBack = () => {
    onConfirm();
    toggleEditorMode();
  };

  return (
    <div className="source-mode h-full overflow-hidden flex flex-col">
      <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-[var(--text-secondary)] font-mono">
          Markdown 源码
        </span>
        <div className="flex-1" />
        <span className="text-xs text-[var(--text-secondary)]">
          {wordCount} 字 | 已保存 Ctrl+S
        </span>
        <button
          onClick={handleToggleBack}
          className="px-2 py-1 text-xs rounded bg-[var(--accent)] text-white hover:opacity-80 transition-opacity"
        >
          返回视图 ⌘/
        </button>
      </div>
      <textarea
        className="flex-1 p-6 bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono text-sm resize-none outline-none leading-relaxed overflow-y-auto"
        style={{ fontFamily: '"JetBrains Mono", monospace', lineHeight: "1.6" }}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        spellCheck={false}
        autoFocus
      />
    </div>
  );
}

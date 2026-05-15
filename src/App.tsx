import { useEffect, useCallback, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useEditorStore } from "./store/editorStore";
import Sidebar from "./components/Sidebar";
import TabBar from "./components/TabBar";
import Toolbar from "./components/Toolbar";
import Editor from "./components/Editor";
import HistoryPanel from "./components/HistoryPanel";
import SettingsPanel from "./components/SettingsPanel";
import StatusBar from "./components/StatusBar";
import WelcomeScreen from "./components/WelcomeScreen";

export default function App() {
  const {
    tabs,
    activeTabId,
    sidebarOpen,
    historyOpen,
    settingsOpen,
    focusMode,
    theme,
    editorMode,
    fontSize,
    lineHeight,
    autoSaveInterval,
    saveFile,
    saveAs,
    autoSave,
    toggleSidebar,
    toggleHistory,
    toggleSettings,
    toggleFocusMode,
    toggleEditorMode,
    initNewFile,
    closeTab,
    setWorkspace,
    openFileExternal,
    exportFile,
  } = useEditorStore();

  const [isDragOver, setIsDragOver] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // ── File drag & drop ────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear when leaving the root element itself (not children)
    if (e.currentTarget === e.target) setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const items = Array.from(e.dataTransfer.items);
    for (const item of items) {
      if (item.kind !== "file") continue;
      const handle = await (item as any).getAsFileSystemHandle();
      if (!handle) continue;
      if (handle.kind === "directory") {
        // Dropped a folder → open as workspace
        await setWorkspace(handle as unknown as string);
        break;
      }
      if (handle.kind === "file") {
        const fileHandle = handle as any;
        const file = await fileHandle.getFile();
        const name = fileHandle.name;
        if (!name.endsWith(".md") && !name.endsWith(".markdown")) continue;
        const content = await file.text();
        const { tabs: currentTabs } = useEditorStore.getState();
        const existing = currentTabs.find((t) => t.path === name);
        if (existing) {
          useEditorStore.setState({ activeTabId: existing.id });
        } else {
          const newTab = {
            id: Math.random().toString(36).slice(2),
            path: name,
            name,
            content,
            isDirty: false,
            wordCount: content.split(/\s+/).filter(Boolean).length,
          };
          useEditorStore.setState((s) => ({
            tabs: [...s.tabs, newTab],
            activeTabId: newTab.id,
          }));
        }
        break; // only handle the first .md file for now
      }
    }
  }, [setWorkspace]);

  // Typora-like: auto-create blank document on startup
  useEffect(() => { initNewFile(); }, []);

  // ── Handle file opened via double-click (file associations) ─
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen<{ path: string; name: string; content: string }>("file-open", (event) => {
      const { path, name, content } = event.payload;
      const state = useEditorStore.getState();
      // Skip if already open
      const existing = state.tabs.find(
        (t) => t.path === path || t.externalPath === path
      );
      if (existing) {
        useEditorStore.setState({ activeTabId: existing.id });
        return;
      }
      // Open as external file tab
      const newTab = {
        id: Math.random().toString(36).slice(2),
        path,
        name,
        content,
        isDirty: false,
        wordCount: content.split(/\s+/).filter(Boolean).length,
        externalPath: path,
      };
      useEditorStore.setState((s) => ({
        tabs: [...s.tabs, newTab],
        activeTabId: newTab.id,
      }));
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  // Apply theme class to <html> element + github theme CSS variable overrides
  useEffect(() => {
    const root = document.documentElement;

    // Reset to defaults first
    root.style.removeProperty("--bg-primary");
    root.style.removeProperty("--bg-secondary");
    root.style.removeProperty("--bg-sidebar");
    root.style.removeProperty("--text-primary");
    root.style.removeProperty("--text-secondary");
    root.style.removeProperty("--border");
    root.style.removeProperty("--accent");
    root.style.removeProperty("--accent-hover");
    root.style.removeProperty("--code-bg");

    // Apply .dark class for dark themes
    if (theme === "dark" || theme === "github-dark") {
      root.classList.add("dark");
    } else if (theme === "light" || theme === "github-light") {
      root.classList.remove("dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", prefersDark);
    }

    // Apply github-light overrides
    if (theme === "github-light") {
      root.style.setProperty("--bg-primary", "#ffffff");
      root.style.setProperty("--bg-secondary", "#f6f8fa");
      root.style.setProperty("--bg-sidebar", "#f6f8fa");
      root.style.setProperty("--text-primary", "#24292f");
      root.style.setProperty("--text-secondary", "#57606a");
      root.style.setProperty("--border", "#d0d7de");
      root.style.setProperty("--accent", "#0969da");
      root.style.setProperty("--accent-hover", "#0550ae");
      root.style.setProperty("--code-bg", "#f6f8fa");
    }

    // Apply github-dark overrides
    if (theme === "github-dark") {
      root.style.setProperty("--bg-primary", "#0d1117");
      root.style.setProperty("--bg-secondary", "#161b22");
      root.style.setProperty("--bg-sidebar", "#161b22");
      root.style.setProperty("--text-primary", "#e6edf3");
      root.style.setProperty("--text-secondary", "#7d8590");
      root.style.setProperty("--border", "#30363d");
      root.style.setProperty("--accent", "#58a6ff");
      root.style.setProperty("--accent-hover", "#388bfd");
      root.style.setProperty("--code-bg", "#161b22");
    }
  }, [theme]);

  // Apply font size / line height CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--editor-font-size", `${fontSize}px`);
    root.style.setProperty("--editor-line-height", String(lineHeight));
  }, [fontSize, lineHeight]);

  // Auto-save interval
  useEffect(() => {
    if (autoSaveInterval <= 0) return;
    const id = setInterval(autoSave, autoSaveInterval);
    return () => clearInterval(id);
  }, [autoSaveInterval, autoSave]);

  // Listen to system theme changes (only for "system" mode)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") {
        document.documentElement.classList.toggle("dark", mq.matches);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  // Warn before closing with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const hasDirty = tabs.some((t) => t.isDirty);
      if (hasDirty) {
        e.preventDefault();
        e.returnValue = "还有未保存的更改，确定要离开吗？";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [tabs]);

  // Global keyboard shortcuts — all Typora-style
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;

      // ⌘S — Save (⌘⇧S handled below as strikethrough)
      if (e.key === "s" && !e.shiftKey) {
        e.preventDefault();
        if (!activeTabId) return;
        // Source mode: sync textarea content to store first
        if (editorMode === "source") {
          document.dispatchEvent(new CustomEvent("source-mode-confirm"));
        }
        // Small delay to let store update
        setTimeout(() => saveFile(activeTabId), 0);
        return;
      }

      // ⌘⇧S — Save as
      if (e.key === "s" && e.shiftKey) {
        e.preventDefault();
        if (activeTabId) saveAs(activeTabId);
        return;
      }

      // ⌘N — New file
      if (e.key === "n") {
        e.preventDefault();
        initNewFile();
        return;
      }

      // ⌘O — Open folder
      if (e.key === "o" && !e.shiftKey) {
        e.preventDefault();
        setWorkspace();
        return;
      }

      // ⌘⇧O — Open single file
      if (e.key === "o" && e.shiftKey) {
        e.preventDefault();
        openFileExternal();
        return;
      }

      // ⌘W — Close active tab
      if (e.key === "w") {
        e.preventDefault();
        if (activeTabId) closeTab(activeTabId);
        return;
      }

      // ⌘E — Export
      if (e.key === "e") {
        e.preventDefault();
        if (activeTabId) exportFile(activeTabId);
        return;
      }

      // ⌘/ — Toggle editor mode
      if (e.key === "/") {
        e.preventDefault();
        toggleEditorMode();
        return;
      }

      // Formatting shortcuts — dispatch to ProseMirror
      const formatMap: Record<string, string> = {
        b: "bold",
        i: "italic",
        "`": "code",
        k: "link",
      };
      if (e.key in formatMap) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent("editor-command", { detail: formatMap[e.key] }));
        return;
      }

      // ⌘⇧X — Strikethrough
      if (e.key === "x" && e.shiftKey) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent("editor-command", { detail: "strikethrough" }));
        return;
      }

      // Heading shortcuts
      if (["1", "2", "3", "0"].includes(e.key)) {
        e.preventDefault();
        const levelMap: Record<string, string> = {
          "1": "heading1", "2": "heading2", "3": "heading3", "0": "paragraph",
        };
        document.dispatchEvent(new CustomEvent("editor-command", { detail: levelMap[e.key] }));
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTabId, saveFile, saveAs, toggleEditorMode, closeTab, setWorkspace, openFileExternal, initNewFile, exportFile]);

  return (
    <div
      className="relative h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag-over overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-[9999] flex flex-col items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-4 p-10 rounded-2xl border-4 border-dashed border-[var(--accent)] bg-[var(--bg-primary)]/90 backdrop-blur-sm shadow-2xl">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--accent)]">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
            <div className="text-center">
              <p className="text-xl font-semibold text-[var(--text-primary)]">拖放文件到此处</p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">支持 .md 文件和文件夹</p>
            </div>
          </div>
        </div>
      )}
      {/* ── Top bar ── */}
      <div className="h-10 flex items-center px-3 gap-2 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex-shrink-0 select-none">
        <button onClick={toggleSidebar} className="p-1.5 rounded hover:bg-[var(--bg-primary)] transition-colors" title="切换侧边栏 ⌘B (sidebar)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="1" y="3" width="14" height="1.5" rx="0.75" />
            <rect x="1" y="7" width="14" height="1.5" rx="0.75" />
            <rect x="1" y="11" width="14" height="1.5" rx="0.75" />
          </svg>
        </button>

        <div className="text-sm font-semibold tracking-wide">QNote</div>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex overflow-hidden">
        {sidebarOpen && !focusMode && <Sidebar />}

        <div className="flex-1 flex flex-col overflow-hidden">
          {tabs.length > 0 ? (
            <>
              <TabBar />
              <Toolbar />
              <div className="flex-1 overflow-hidden">
                <Editor />
              </div>
            </>
          ) : (
            <WelcomeScreen />
          )}
        </div>

        {historyOpen && <HistoryPanel />}
        {settingsOpen && <SettingsPanel />}
      </div>

      {activeTab && <StatusBar />}
    </div>
  );
}

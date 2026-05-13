import { create } from "zustand";
import { diffLines } from "diff";
import * as fs from "../lib/filesystem";

export interface Tab {
  id: string;
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
  wordCount: number;
  // For external files opened via picker (not in workspace)
  externalPath?: string;
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileEntry[];
}

export interface HistoryEntry {
  hash: string;
  message: string;
  timestamp: number;
  word_diff: number;
  summary: string;
}

interface EditorState {
  // Workspace
  workspaceRoot: string | null;
  files: FileEntry[];
  searchResults: [string, string][];
  searchQuery: string;

  // Tabs
  tabs: Tab[];
  activeTabId: string | null;

  // UI State
  sidebarOpen: boolean;
  historyOpen: boolean;
  settingsOpen: boolean;
  focusMode: boolean;
  theme: "light" | "dark" | "system" | "github-light" | "github-dark";
  editorMode: "wysiwyg" | "source";

  // History
  history: HistoryEntry[];
  selectedHistoryHash: string | null;

  // Settings
  autoSaveInterval: number;
  fontSize: number;
  lineHeight: number;
  _initialized: boolean;

  // Actions
  setWorkspace: (path?: string) => Promise<void>;
  openFileExternal: () => Promise<void>;
  refreshFiles: () => Promise<void>;
  openFile: (path: string) => Promise<void>;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabContent: (id: string, content: string) => void;
  saveFile: (id: string) => Promise<void>;
  saveAll: () => Promise<void>;
  createFile: (path: string) => Promise<void>;
  createDir: (path: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  renameFile: (oldPath: string, newPath: string) => Promise<void>;
  searchFiles: (query: string) => Promise<void>;
  setTheme: (theme: string) => void;
  toggleSidebar: () => void;
  toggleHistory: () => void;
  toggleSettings: () => void;
  toggleFocusMode: () => void;
  toggleEditorMode: () => void;
  loadHistory: (filePath: string) => Promise<void>;
  restoreVersion: (hash: string) => Promise<void>;
  cleanupHistory: (filePath: string, keepCount: number) => Promise<void>;
  getDiff: (filePath: string, hash: string) => Promise<{ additions: number; deletions: number; content: string }>;
  setFontSize: (size: number) => void;
  setLineHeight: (height: number) => void;
  setAutoSaveInterval: (ms: number) => void;
  initNewFile: () => void;
  exportFile: (id: string, format?: "md" | "html") => Promise<void>;
  saveAs: (id: string, newPath?: string) => Promise<void>;
  autoSave: () => void;
  markDirty: () => void;
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

function genId(): string {
  return Math.random().toString(36).slice(2);
}

function snapshotToHistory(s: fs.Snapshot): HistoryEntry {
  const d = new Date(s.timestamp);
  const time = d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return {
    hash: s.id,
    message: `${time} | ${s.summary}`,
    timestamp: Math.floor(s.timestamp / 1000),
    word_diff: s.wordCount,
    summary: s.summary,
  };
}

function toFileEntry(tree: fs.TreeEntry): FileEntry {
  return {
    name: tree.name,
    path: tree.path,
    is_dir: tree.isDir,
    children: tree.children.map(toFileEntry),
  };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  workspaceRoot: null,
  files: [],
  searchResults: [],
  searchQuery: "",
  tabs: [],
  activeTabId: null,
  _initialized: false,
  sidebarOpen: true,
  historyOpen: false,
  settingsOpen: false,
  focusMode: false,
  theme: "system",
  editorMode: "wysiwyg",
  history: [],
  selectedHistoryHash: null,
  autoSaveInterval: 30000,
  fontSize: 16,
  lineHeight: 1.8,

  setWorkspace: async (path) => {
    const dirPath = path || await fs.openDirectoryPicker();
    if (!dirPath) return;
    fs.setCurrentDir(dirPath);
    const name = dirPath.split("/").pop() || dirPath;
    set({
      workspaceRoot: dirPath,
      tabs: [],
      activeTabId: null,
    });
    await get().refreshFiles();
  },

  openFileExternal: async () => {
    const result = await fs.openFilePicker();
    if (!result) return;
    const { path, content } = result;
    const name = path.split("/").pop() || "untitled.md";
    const { tabs } = get();
    const existing = tabs.find((t) => t.path === path);
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }
    const newTab: Tab = {
      id: genId(),
      path,
      name,
      content,
      isDirty: false,
      wordCount: countWords(content),
      externalPath: path,
    };
    set((s) => ({
      tabs: [...s.tabs, newTab],
      activeTabId: newTab.id,
    }));
  },

  refreshFiles: async () => {
    const dirPath = fs.getCurrentDir();
    if (!dirPath) return;
    try {
      const tree = await fs.listDirectory();
      set({ files: tree.map(toFileEntry) });
    } catch (e) {
      console.error("Failed to read directory:", e);
    }
  },

  openFile: async (path) => {
    const { tabs } = get();
    const existing = tabs.find((t) => t.path === path);
    if (existing) {
      set({ activeTabId: existing.id });
      await get().loadHistory(path);
      return;
    }

    try {
      const content = await fs.readFile(path);
      const name = path.split("/").pop() || "untitled.md";
      const newTab: Tab = {
        id: genId(),
        path,
        name,
        content,
        isDirty: false,
        wordCount: countWords(content),
      };
      set((s) => ({
        tabs: [...s.tabs, newTab],
        activeTabId: newTab.id,
      }));
      await get().loadHistory(path);
    } catch (e) {
      console.error("Failed to open file:", e);
    }
  },

  closeTab: (id) => {
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === id);
      const newTabs = s.tabs.filter((t) => t.id !== id);
      let newActiveId = s.activeTabId;
      if (s.activeTabId === id) {
        if (newTabs.length > 0) {
          newActiveId = newTabs[Math.min(idx, newTabs.length - 1)].id;
        } else {
          newActiveId = null;
        }
      }
      return { tabs: newTabs, activeTabId: newActiveId };
    });
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  updateTabContent: (id, content) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id
          ? { ...t, content, isDirty: true, wordCount: countWords(content) }
          : t
      ),
    }));
  },

  saveFile: async (id) => {
    const tab = get().tabs.find((t) => t.id === id);
    if (!tab) return;
    try {
      // External file (opened via picker): use save picker
      if (tab.externalPath) {
        await fs.writeFile(tab.externalPath, tab.content);
        await fs.saveSnapshot(tab.externalPath, tab.content);
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, isDirty: false } : t)),
        }));
        await get().loadHistory(tab.externalPath);
        return;
      }
      // Workspace file
      if (tab.path.startsWith("未命名")) {
        // Untitled file without workspace — trigger save dialog
        await get().saveAs(id);
        return;
      }
      await fs.writeFile(tab.path, tab.content);
      // Save snapshot to IndexedDB
      await fs.saveSnapshot(tab.path, tab.content);
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === id ? { ...t, isDirty: false } : t)),
      }));
      await get().loadHistory(tab.path);
    } catch (e) {
      console.error("Failed to save file:", e);
    }
  },

  saveAll: async () => {
    const { tabs } = get();
    for (const tab of tabs.filter((t) => t.isDirty)) {
      await get().saveFile(tab.id);
    }
  },

  createFile: async (path) => {
    try {
      await fs.createFile(path);
      await get().refreshFiles();
    } catch (e) {
      console.error("Failed to create file:", e);
    }
  },

  createDir: async (path) => {
    try {
      await fs.createDir(path);
      await get().refreshFiles();
    } catch (e) {
      console.error("Failed to create directory:", e);
    }
  },

  deleteFile: async (path) => {
    try {
      await fs.deleteFileEntry(path);
      const { tabs } = get();
      const tab = tabs.find((t) => t.path === path);
      if (tab) get().closeTab(tab.id);
      await get().refreshFiles();
    } catch (e) {
      console.error("Failed to delete file:", e);
    }
  },

  renameFile: async (oldPath, newPath) => {
    try {
      await fs.renameFileEntry(oldPath, newPath);
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.path === oldPath
            ? { ...t, path: newPath, name: newPath.split("/").pop() || t.name }
            : t
        ),
      }));
      await get().refreshFiles();
    } catch (e) {
      console.error("Failed to rename file:", e);
    }
  },

  searchFiles: async (query) => {
    if (!query.trim()) {
      set({ searchResults: [], searchQuery: "" });
      return;
    }
    try {
      const results = await fs.searchFilesContent(query);
      set({ searchResults: results, searchQuery: query });
    } catch (e) {
      console.error("Search failed:", e);
    }
  },

  setTheme: (theme: string) => {
    set({ theme: theme as EditorState["theme"] });
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      root.classList.toggle("dark", prefersDark);
    }
  },

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleHistory: () => set((s) => ({ historyOpen: !s.historyOpen })),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
  toggleEditorMode: () =>
    set((s) => ({
      editorMode: s.editorMode === "wysiwyg" ? "source" : "wysiwyg",
    })),

  loadHistory: async (filePath) => {
    try {
      const snapshots = await fs.getSnapshots(filePath);
      set({ history: snapshots.map(snapshotToHistory) });
    } catch {
      set({ history: [] });
    }
  },

  restoreVersion: async (hash) => {
    const { tabs, activeTabId } = get();
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;
    try {
      const snapshot = await fs.getSnapshot(hash);
      if (!snapshot) return;
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === activeTabId
            ? {
                ...t,
                content: snapshot.content,
                isDirty: true, // Mark as dirty so user sees the change
                wordCount: countWords(snapshot.content),
              }
            : t
        ),
      }));
    } catch (e) {
      console.error("Failed to restore version:", e);
    }
  },

  cleanupHistory: async (filePath, keepCount) => {
    try {
      await fs.cleanupSnapshots(filePath, keepCount);
      await get().loadHistory(filePath);
    } catch (e) {
      console.error("Cleanup failed:", e);
    }
  },

  getDiff: async (filePath, hash) => {
    const current = get().tabs.find((t) => t.path === filePath)?.content || "";
    const snapshot = await fs.getSnapshot(hash);
    if (!snapshot) return { additions: 0, deletions: 0, content: "" };

    const changes = diffLines(snapshot.content, current);
    const additions = changes
      .filter((c) => c.added)
      .reduce((acc, c) => acc + (c.count || 0), 0);
    const deletions = changes
      .filter((c) => c.removed)
      .reduce((acc, c) => acc + (c.count || 0), 0);

    const diffLines_output = changes
      .filter((c) => c.added || c.removed)
      .map((c) => {
        const prefix = c.added ? "+ " : "- ";
        return c.value.split("\n").filter(Boolean).map((l) => prefix + l).join("\n");
      })
      .join("\n");

    return {
      additions,
      deletions,
      content: diffLines_output,
    };
  },

  setFontSize: (size) => set({ fontSize: size }),
  setLineHeight: (height) => set({ lineHeight: height }),
  setAutoSaveInterval: (ms) => set({ autoSaveInterval: ms }),

  // Auto-save: runs on interval, only saves dirty tabs
  // Call this effect in App.tsx or StatusBar
  autoSave: () => {
    const { tabs } = get();
    for (const tab of tabs.filter((t) => t.isDirty)) {
      get().saveFile(tab.id);
    }
  },

  // Mark the active tab dirty (used by source mode to trigger auto-save)
  markDirty: () => {
    const { activeTabId } = get();
    if (!activeTabId) return;
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === activeTabId ? { ...t, isDirty: true } : t
      ),
    }));
  },

  // Auto-create untitled tab on first call (Typora-like)
  initNewFile: () => {
    if (get()._initialized) return;
    const id = genId();
    const name = `未命名-${id.slice(0, 4)}.md`;
    set({
      _initialized: true,
      tabs: [{
        id,
        path: name,
        name,
        content: "",
        isDirty: false,
        wordCount: 0,
      }],
      activeTabId: id,
    });
  },

  exportFile: async (id, format = "md") => {
    const tab = get().tabs.find((t) => t.id === id);
    if (!tab) return;
    let content = tab.content;
    let mime = "text/markdown;charset=utf-8";
    let ext = ".md";
    if (format === "html") {
      // Parse markdown to HTML using markdown-it (the same engine used for editing)
      const md = (await import("markdown-it")).default;
      const parser = new md("commonmark", { html: false, linkify: true, breaks: false });
      parser.enable("table");
      const bodyHtml = parser.render(tab.content);
      content = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8"/>
<title>${tab.name.replace(/\.md$/, "")}</title>
<style>
  body{max-width:800px;margin:40px auto;padding:0 20px;font-family:system-ui,-apple-system,sans-serif;line-height:1.8;color:#333}
  h1,h2,h3{margin-top:1.5em;font-weight:700}
  h1{font-size:2em;border-bottom:2px solid #eee;padding-bottom:.3em}
  h2{font-size:1.5em;border-bottom:1px solid #eee;padding-bottom:.2em}
  h3{font-size:1.2em}
  p{margin:1em 0}
  code{background:#f4f4f4;padding:2px 6px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:.9em}
  pre{background:#f4f4f4;padding:1em;border-radius:8px;overflow-x:auto;margin:1em 0}
  pre code{background:none;padding:0}
  blockquote{border-left:4px solid #ddd;padding-left:1em;color:#666;margin:1em 0}
  table{border-collapse:collapse;width:100%;margin:1em 0}
  td,th{border:1px solid #ddd;padding:.5em .8em;text-align:left}
  th{background:#f4f4f4;font-weight:600}
  img{max-width:100%;border-radius:8px}
  a{color:#0969da}
  hr{border:none;border-top:2px solid #eee;margin:2em 0}
  ul,ol{padding-left:1.5em;margin:1em 0}
  li{margin:.3em 0}
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
      mime = "text/html;charset=utf-8";
      ext = ".html";
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = tab.name.replace(/\.md$/, "") + ext;
    a.click();
    URL.revokeObjectURL(url);
  },

  saveAs: async (id, newPath?) => {
    const tab = get().tabs.find((t) => t.id === id);
    if (!tab) return;
    try {
      // External file or no path: use save picker
      if (tab.externalPath || !newPath) {
        const savedPath = await fs.showSaveFilePicker(tab.name);
        if (!savedPath) return;
        await fs.writeFile(savedPath, tab.content);
        const name = savedPath.split("/").pop() || savedPath;
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === id
              ? { ...t, path: savedPath, name, isDirty: false, externalPath: savedPath }
              : t
          ),
        }));
        return;
      }
      // Workspace file
      await fs.writeFile(newPath, tab.content);
      await fs.saveSnapshot(newPath, tab.content);
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === id ? { ...t, path: newPath, name: newPath.split("/").pop() || newPath, isDirty: false } : t
        ),
      }));
      await get().loadHistory(newPath);
    } catch (e) {
      console.error("Save as failed:", e);
    }
  },
}));

/**
 * Portable filesystem layer for MarkFlowy.
 *
 * Uses the File System Access API (Chromium/Edge) when available,
 * and falls back to a pure In-Memory + IndexedDB layer for Safari / Firefox.
 * No Node.js dependencies — runs entirely in the browser.
 */

import { wrapContent } from "./git";

// ── Capability detection ────────────────────────────────────
export function hasFileSystemAccess(): boolean {
  return "showDirectoryPicker" in window;
}

export function supportsPortable(): boolean {
  return true; // always works, even without FS Access API
}

// ── Workspace handle (only for FS Access API) ───────────────
let _dirHandle: FileSystemDirectoryHandle | null = null;

export async function openDirectoryPicker(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    _dirHandle = handle;
    return handle;
  } catch {
    return null;
  }
}

export function getDirHandle(): FileSystemDirectoryHandle | null {
  return _dirHandle;
}

export function setDirHandle(handle: FileSystemDirectoryHandle) {
  _dirHandle = handle;
}

// ── Save picker for external files ─────────────────────────
export async function showSaveFilePicker(
  suggestedName?: string
): Promise<FileSystemFileHandle | null> {
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: suggestedName || "untitled.md",
      types: [
        {
          description: "Markdown Files",
          accept: { "text/markdown": [".md", ".markdown"] },
        },
      ],
    });
    return handle;
  } catch {
    return null;
  }
}
export async function writeFileWithHandle(
  handle: FileSystemFileHandle,
  content: string
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

// ── Open a single file via picker ──────────────────────────
export async function openFilePicker(): Promise<{ handle: FileSystemFileHandle; content: string } | null> {
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [
        {
          description: "Markdown Files",
          accept: { "text/markdown": [".md", ".markdown"] },
        },
      ],
    });
    const file = await handle.getFile();
    const content = await file.text();
    return { handle, content };
  } catch {
    return null;
  }
}

// ── Read / Write via FS Access API ──────────────────────────

export async function readFile(relativePath: string): Promise<string> {
  const handle = getDirHandle();
  if (!handle) throw new Error("No directory opened");

  const parts = relativePath.split("/");
  let current: FileSystemDirectoryHandle = handle;
  for (let i = 0; i < parts.length - 1; i++) {
    current = await current.getDirectoryHandle(parts[i]);
  }
  const fileHandle = await current.getFileHandle(parts[parts.length - 1]);
  const file = await fileHandle.getFile();
  return file.text();
}

export async function writeFile(relativePath: string, content: string): Promise<void> {
  const handle = getDirHandle();
  if (!handle) throw new Error("No directory opened");

  const parts = relativePath.split("/");
  let current: FileSystemDirectoryHandle = handle;
  for (let i = 0; i < parts.length - 1; i++) {
    current = await current.getDirectoryHandle(parts[i], { create: true });
  }
  const fileHandle = await current.getFileHandle(parts[parts.length - 1], { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

export async function createFile(relativePath: string): Promise<void> {
  await writeFile(relativePath, "");
}

export async function createDir(relativePath: string): Promise<void> {
  const handle = getDirHandle();
  if (!handle) throw new Error("No directory opened");
  const parts = relativePath.split("/");
  let current: FileSystemDirectoryHandle = handle;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create: true });
  }
}

export async function deleteFileEntry(relativePath: string): Promise<void> {
  const handle = getDirHandle();
  if (!handle) throw new Error("No directory opened");
  const parts = relativePath.split("/");
  let current: FileSystemDirectoryHandle = handle;
  for (let i = 0; i < parts.length - 1; i++) {
    current = await current.getDirectoryHandle(parts[i]);
  }
  await current.removeEntry(parts[parts.length - 1], { recursive: true });
}

export async function renameFileEntry(oldPath: string, newPath: string): Promise<void> {
  const content = await readFile(oldPath);
  await writeFile(newPath, content);
  await deleteFileEntry(oldPath);
}

// ── Directory tree (FS Access API only) ─────────────────────

export interface TreeEntry {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeEntry[];
}

export async function listDirectory(
  dirHandle: FileSystemDirectoryHandle,
  basePath = ""
): Promise<TreeEntry[]> {
  const entries: TreeEntry[] = [];
  for await (const [name, handle] of (dirHandle as any).entries()) {
    if (name.startsWith(".") || name === "node_modules" || name === "target") continue;
    const entryPath = basePath ? `${basePath}/${name}` : name;
    if (handle.kind === "directory") {
      const children = await listDirectory(handle, entryPath);
      entries.push({ name, path: entryPath, isDir: true, children });
    } else if (name.endsWith(".md")) {
      entries.push({ name, path: entryPath, isDir: false, children: [] });
    }
  }
  entries.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return entries;
}

// ── Content search (FS Access API only) ──────────────────────

export async function searchFilesContent(query: string): Promise<[string, string][]> {
  const handle = getDirHandle();
  if (!handle) return [];

  const results: [string, string][] = [];
  const q = query.toLowerCase();

  async function searchDir(dir: FileSystemDirectoryHandle, base: string, depth: number) {
    if (depth > 10) return;
    for await (const [name, fileHandle] of (dir as any).entries()) {
      if (name.startsWith(".") || name === "node_modules") continue;
      const ep = base ? `${base}/${name}` : name;
      if (fileHandle.kind === "file" && name.endsWith(".md")) {
        try {
          const file = await (fileHandle as FileSystemFileHandle).getFile();
          const text = await file.text();
          if (text.toLowerCase().includes(q)) {
            const line = text.split("\n").find((l) => l.toLowerCase().includes(q)) || "";
            results.push([ep, line.slice(0, 100)]);
          }
        } catch { /* skip */ }
      } else if (fileHandle.kind === "directory") {
        await searchDir(fileHandle as FileSystemDirectoryHandle, ep, depth + 1);
      }
    }
  }

  await searchDir(handle, "", 0);
  return results;
}

// ── Snapshot store (IndexedDB — works everywhere) ───────────

export interface Snapshot {
  id: string;
  filePath: string;
  content: string;
  timestamp: number;
  wordCount: number;
  summary: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("markflowy", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("snapshots")) {
        db.createObjectStore("snapshots", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSnapshot(
  filePath: string,
  content: string,
  summary?: string
): Promise<string> {
  const db = await openDB();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const snapshot: Snapshot = { id, filePath, content, timestamp: Date.now(), wordCount, summary: summary || `Auto-save | ${wordCount} words` };

  // Also save git blob via git layer (best-effort, don't block)
  try {
    await wrapContent(filePath, content);
  } catch {
    // git layer failure shouldn't block snapshot saves
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction("snapshots", "readwrite");
    tx.objectStore("snapshots").put(snapshot);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSnapshots(filePath: string): Promise<Snapshot[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("snapshots", "readonly");
    const req = tx.objectStore("snapshots").getAll();
    req.onsuccess = () => {
      const all = (req.result as Snapshot[])
        .filter((s) => s.filePath === filePath)
        .sort((a, b) => b.timestamp - a.timestamp);
      resolve(all);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getSnapshot(id: string): Promise<Snapshot | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("snapshots", "readonly");
    const req = tx.objectStore("snapshots").get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function cleanupSnapshots(filePath: string, keepCount: number): Promise<number> {
  const snapshots = await getSnapshots(filePath);
  const toDelete = snapshots.slice(keepCount);
  if (toDelete.length === 0) return 0;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("snapshots", "readwrite");
    const store = tx.objectStore("snapshots");
    for (const snap of toDelete) store.delete(snap.id);
    tx.oncomplete = () => resolve(toDelete.length);
    tx.onerror = () => reject(tx.error);
  });
}

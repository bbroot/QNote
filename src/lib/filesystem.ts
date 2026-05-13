/**
 * MarkFlowy Filesystem Layer — Tauri v2 Native
 * 
 * Uses @tauri-apps/plugin-fs for file operations and @tauri-apps/plugin-dialog for pickers.
 * Falls back to In-Memory + IndexedDB for non-file operations (snapshots).
 */

import { open, save } from "@tauri-apps/plugin-dialog";
import * as fs from "@tauri-apps/plugin-fs";
import { wrapContent } from "./git";

// ── Workspace path (Tauri native) ──────────────────────────
let _currentDir: string | null = null;

export async function openDirectoryPicker(): Promise<string | null> {
  try {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === 'string') {
      _currentDir = selected;
      return selected;
    }
    return null;
  } catch {
    return null;
  }
}

export function getCurrentDir(): string | null {
  return _currentDir;
}

export function setCurrentDir(path: string) {
  _currentDir = path;
}

// ── Save/Export picker ─────────────────────────────────────
export async function showSaveFilePicker(suggestedName?: string): Promise<string | null> {
  try {
    const path = await save({
      defaultPath: suggestedName || "untitled.md",
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }]
    });
    return path;
  } catch {
    return null;
  }
}

// ── Open single file picker ───────────────────────────────
export async function openFilePicker(): Promise<{ path: string; content: string } | null> {
  try {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }]
    });
    if (selected && typeof selected === 'string') {
      const content = await fs.readTextFile(selected);
      return { path: selected, content };
    }
    return null;
  } catch {
    return null;
  }
}

// ── Read / Write via Tauri FS ──────────────────────────────
export async function readFile(relativePath: string): Promise<string> {
  if (relativePath.startsWith('/')) {
    return fs.readTextFile(relativePath);
  }
  const base = getCurrentDir();
  if (!base) throw new Error("No directory opened");
  const fullPath = `${base}/${relativePath}`;
  return fs.readTextFile(fullPath);
}

export async function writeFile(relativePath: string, content: string): Promise<void> {
  if (relativePath.startsWith('/')) {
    await fs.writeTextFile(relativePath, content);
    return;
  }
  const base = getCurrentDir();
  if (!base) throw new Error("No directory opened");
  const fullPath = `${base}/${relativePath}`;
  const parts = relativePath.split("/");
  if (parts.length > 1) {
    const dirParts = parts.slice(0, -1);
    let current = base;
    for (const part of dirParts) {
      current = `${current}/${part}`;
      try { await fs.mkdir(current, { recursive: true }); } catch { /* exists */ }
    }
  }
  await fs.writeTextFile(fullPath, content);
}

export async function createFile(relativePath: string): Promise<void> {
  await writeFile(relativePath, "");
}

export async function createDir(relativePath: string): Promise<void> {
  const base = getCurrentDir();
  if (!base) throw new Error("No directory opened");
  const fullPath = `${base}/${relativePath}`;
  await fs.mkdir(fullPath, { recursive: true });
}

export async function deleteFileEntry(relativePath: string): Promise<void> {
  const base = getCurrentDir();
  if (!base) throw new Error("No directory opened");
  const fullPath = `${base}/${relativePath}`;
  try {
    await fs.remove(fullPath);
  } catch {
    // Try as dir
    await fs.remove(fullPath, { recursive: true });
  }
}

export async function renameFileEntry(oldPath: string, newPath: string): Promise<void> {
  const base = getCurrentDir();
  if (!base) throw new Error("No directory opened");
  const content = await readFile(oldPath);
  await writeFile(newPath, content);
  await deleteFileEntry(oldPath);
}

// ── Directory tree ──────────────────────────────────────────
export interface TreeEntry {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeEntry[];
}

async function readDirRecursive(dirPath: string, basePath: string): Promise<TreeEntry[]> {
  const entries: TreeEntry[] = [];
  try {
    const items = await fs.readDir(dirPath);
    for (const item of items) {
      const name = item.name;
      if (name.startsWith(".")) continue;
      const entryPath = basePath ? `${basePath}/${name}` : name;
      const fullPath = `${dirPath}/${name}`;
      if (item.isDirectory) {
        const children = await readDirRecursive(fullPath, entryPath);
        entries.push({ name, path: entryPath, isDir: true, children });
      } else if (name.endsWith(".md")) {
        entries.push({ name, path: entryPath, isDir: false, children: [] });
      }
    }
  } catch { /* skip inaccessible */ }
  entries.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return entries;
}

export async function listDirectory(dirPath?: string, basePath = ""): Promise<TreeEntry[]> {
  const base = dirPath || getCurrentDir();
  if (!base) return [];
  return readDirRecursive(base, basePath);
}

// ── Content search ──────────────────────────────────────────
export async function searchFilesContent(query: string): Promise<[string, string][]> {
  const base = getCurrentDir();
  if (!base) return [];
  const results: [string, string][] = [];
  const q = query.toLowerCase();

  async function searchDir(dir: string, base: string) {
    try {
      const items = await fs.readDir(dir);
      for (const item of items) {
        if (item.name.startsWith(".")) continue;
        const ep = base ? `${base}/${item.name}` : item.name;
        const fullPath = `${dir}/${item.name}`;
        if (item.isDirectory) {
          await searchDir(fullPath, ep);
        } else if (item.name.endsWith(".md")) {
          try {
            const text = await fs.readTextFile(fullPath);
            if (text.toLowerCase().includes(q)) {
              const line = text.split("\n").find(l => l.toLowerCase().includes(q)) || "";
              results.push([ep, line.slice(0, 100)]);
            }
          } catch { /* skip */ }
        }
      }
    } catch { /* skip */ }
  }

  await searchDir(base, "");
  return results;
}

// ── Snapshot store (IndexedDB) ──────────────────────────────
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

export async function saveSnapshot(filePath: string, content: string, summary?: string): Promise<string> {
  const db = await openDB();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const snapshot: Snapshot = {
    id, filePath, content, timestamp: Date.now(),
    wordCount, summary: summary || `Auto-save | ${wordCount} words`
  };
  // Also save git blob (best-effort)
  try { await wrapContent(filePath, content); } catch { /* git layer failure shouldn't block */ }
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
        .filter(s => s.filePath === filePath)
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

// ── Browser compat shims (always use Tauri in this build) ───
export function hasFileSystemAccess(): boolean { return false; }
export function supportsPortable(): boolean { return true; }
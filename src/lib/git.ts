/**
 * Git layer using isomorphic-git with an IndexedDB backend.
 * Works in any modern browser — no Node.js, no native binaries.
 */
import git from "isomorphic-git";

// ── IndexedDB backend for git ─────────────────────────────────

interface GitObject {
  oid: string;
  type: string;
  blob?: string;
  tree?: string;
  commit?: string;
}

let _gitDB: IDBDatabase | null = null;
let _gitDBPromise: Promise<IDBDatabase> | null = null;

async function gitDB(): Promise<IDBDatabase> {
  if (_gitDB) return _gitDB;
  if (_gitDBPromise) return _gitDBPromise;

  _gitDBPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open("markflowy-git", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("objects")) {
        db.createObjectStore("objects", { keyPath: "oid" });
      }
    };
    req.onsuccess = () => {
      _gitDB = req.result;
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });

  return _gitDBPromise;
}

const idb = {
  async readFile(...args: any[]) {
    // Stub: we'll store content as git blobs separately
    return null;
  },
  async writeFile(oid: string, blob: Uint8Array) {
    const db = await gitDB();
    const tx = db.transaction("objects", "readwrite");
    tx.objectStore("objects").put({
      oid,
      type: "blob",
      blob: new TextDecoder().decode(blob),
    } as GitObject);
    return new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },
  async readBlob(oid: string) {
    const db = await gitDB();
    return new Promise<Uint8Array | null>((res, rej) => {
      const tx = db.transaction("objects", "readonly");
      const req = tx.objectStore("objects").get(oid);
      req.onsuccess = () => {
        const r = req.result as GitObject | undefined;
        res(r ? new TextEncoder().encode(r.blob || "") : null);
      };
      req.onerror = () => rej(req.error);
    });
  },
  async readTree(oid: string) {
    const db = await gitDB();
    return new Promise<any | null>((res, rej) => {
      const tx = db.transaction("objects", "readonly");
      const req = tx.objectStore("objects").get(oid);
      req.onsuccess = () => {
        const r = req.result as GitObject | undefined;
        res(r ? JSON.parse(r.tree || "{}") : null);
      };
      req.onerror = () => rej(req.error);
    });
  },
  async writeTree(tree: any, oid: string) {
    const db = await gitDB();
    const tx = db.transaction("objects", "readwrite");
    tx.objectStore("objects").put({ oid, type: "tree", tree: JSON.stringify(tree) } as GitObject);
    return new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },
  async readCommit(oid: string) {
    const db = await gitDB();
    return new Promise<any | null>((res, rej) => {
      const tx = db.transaction("objects", "readonly");
      const req = tx.objectStore("objects").get(oid);
      req.onsuccess = () => {
        const r = req.result as GitObject | undefined;
        res(r ? JSON.parse(r.commit || "{}") : null);
      };
      req.onerror = () => rej(req.error);
    });
  },
  async writeCommit(commit: any, oid: string) {
    const db = await gitDB();
    const tx = db.transaction("objects", "readwrite");
    tx.objectStore("objects").put({ oid, type: "commit", commit: JSON.stringify(commit) } as GitObject);
    return new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },
};

// ── Workspace metadata ─────────────────────────────────────────

interface WorkspaceMeta {
  dir: string; // 'filesystem' | 'memory'
  branch: string;
  head: string | null;
}

const WORKSPACE_KEY = "markflowy-workspace";

let _metaDB: IDBDatabase | null = null;
let _metaDBPromise: Promise<IDBDatabase> | null = null;

async function openMetaDB(): Promise<IDBDatabase> {
  if (_metaDB) return _metaDB;
  if (_metaDBPromise) return _metaDBPromise;

  _metaDBPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open("markflowy-meta", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    req.onsuccess = () => {
      _metaDB = req.result;
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });

  return _metaDBPromise;
}

async function loadMeta(): Promise<WorkspaceMeta> {
  const db = await openMetaDB();
  return new Promise((res, rej) => {
    const tx = db.transaction("meta", "readonly");
    const req = tx.objectStore("meta").get(WORKSPACE_KEY);
    req.onsuccess = () => res(req.result || { dir: "filesystem", branch: "main", head: null });
    req.onerror = () => rej(req.error);
  });
}

async function saveMeta(meta: WorkspaceMeta) {
  const db = await openMetaDB();
  return new Promise<void>((res, rej) => {
    const tx = db.transaction("meta", "readwrite");
    tx.objectStore("meta").put({ key: WORKSPACE_KEY, ...meta });
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

// ── Public API ─────────────────────────────────────────────────

export interface GitCommit {
  oid: string;
  message: string;
  timestamp: number;
  author: string;
  parent?: string;
}

/**
 * Save content as a git blob and create a commit snapshot.
 */
export async function wrapContent(filePath: string, content: string): Promise<string> {
  const meta = await loadMeta();

  // Write blob
  const encoder = new TextEncoder();
  const blob = encoder.encode(content);
  const oid = await git.writeBlob({
    fs: idb as any,
    dir: "/",
    blob,
  });

  // Read current tree
  let tree: any = {};
  if (meta.head) {
    try {
      const commit = await git.readCommit({ fs: idb as any, dir: "/", oid: meta.head });
      tree = await git.readTree({ fs: idb as any, dir: "/", oid: commit.commit.tree });
      // Convert tree entries to map
      tree = tree.tree.reduce((acc: any, entry: any) => {
        acc[entry.path] = { oid: entry.oid, type: entry.type };
        return acc;
      }, {} as Record<string, any>);
    } catch { /* fresh repo */ }
  }

  // Update tree entry
  tree[filePath] = { oid, type: "blob" };

  // Write new tree
  const treeEntries = Object.entries(tree).map(([path, info]: [string, any]) => ({
    path,
    oid: info.oid,
    type: "blob" as const,
    mode: "100644",
  }));
  const treeOid = await git.writeTree({
    fs: idb as any,
    dir: "/",
    tree: treeEntries,
  });

  // Write commit
  const author = { name: "MarkFlowy", email: "markflowy@local", timestamp: Math.floor(Date.now() / 1000), timezoneOffset: 0 };
  const commitOid = await git.writeCommit({
    fs: idb as any,
    dir: "/",
    commit: {
      tree: treeOid,
      message: `Update ${filePath}`,
      author,
      committer: author,
      parent: meta.head ? [meta.head] : [],
    },
  });

  await saveMeta({ ...meta, head: commitOid });
  return commitOid;
}

/**
 * Read a file at a specific commit.
 */
export async function unwrapContent(oid: string, filePath: string): Promise<string | null> {
  try {
    const commit = await git.readCommit({ fs: idb as any, dir: "/", oid });
    const tree = await git.readTree({ fs: idb as any, dir: "/", oid: commit.commit.tree });
    const entry = tree.tree.find((e: any) => e.path === filePath);
    if (!entry) return null;
    const blob = await git.readBlob({ fs: idb as any, dir: "/", oid: entry.oid });
    return new TextDecoder().decode(blob.blob);
  } catch {
    return null;
  }
}

/**
 * Get commit history (last N commits).
 */
export async function getGitHistory(count = 20): Promise<GitCommit[]> {
  const meta = await loadMeta();
  if (!meta.head) return [];

  const commits: GitCommit[] = [];
  let currentOid = meta.head;
  const visited = new Set<string>();

  while (commits.length < count && currentOid && !visited.has(currentOid)) {
    visited.add(currentOid);
    try {
      const commit = await git.readCommit({ fs: idb as any, dir: "/", oid: currentOid });
      commits.push({
        oid: currentOid,
        message: commit.commit.message,
        timestamp: commit.commit.author.timestamp,
        author: `${commit.commit.author.name} <${commit.commit.author.email}>`,
        parent: commit.commit.parent[0] || "",
      });
    } catch {
      break;
    }
  }

  return commits;
}

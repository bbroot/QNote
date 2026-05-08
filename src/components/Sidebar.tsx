import { useState, useRef } from "react";
import { useEditorStore, FileEntry } from "../store/editorStore";

type SortKey = "name" | "date";
type SortOrder = "asc" | "desc";

function sortEntries(entries: FileEntry[], key: SortKey, order: SortOrder): FileEntry[] {
  return [...entries]
    .sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      if (key === "name") {
        const cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        return order === "asc" ? cmp : -cmp;
      }
      return 0;
    })
    .map((e) => ({
      ...e,
      children: e.is_dir ? sortEntries(e.children, key, order) : e.children,
    }));
}

function FileItem({ entry, depth = 0 }: { entry: FileEntry; depth?: number }) {
  const { openFile, deleteFile, renameFile, tabs, activeTabId } = useEditorStore();
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(entry.name);
  const [showMenu, setShowMenu] = useState(false);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isActive = activeTab?.path === entry.path;
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClick = () => {
    if (entry.is_dir) {
      setExpanded(!expanded);
    } else {
      openFile(entry.path);
    }
  };

  const handleRename = () => {
    if (newName && newName !== entry.name) {
      const parent = entry.path.substring(0, entry.path.lastIndexOf("/"));
      const newPath = `${parent}/${newName}`;
      renameFile(entry.path, newPath);
    }
    setRenaming(false);
    setShowMenu(false);
  };

  const handleDelete = () => {
    if (confirm(`确定删除 ${entry.name}？`)) {
      deleteFile(entry.path);
    }
    setShowMenu(false);
  };

  return (
    <div>
      <div
        className={`file-tree-item flex items-center gap-1 text-sm group ${
          isActive ? "active" : ""
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowMenu(true);
        }}
      >
        {entry.is_dir ? (
          <>
            <span className="text-[var(--text-secondary)] text-xs">
              {expanded ? "📂" : "📁"}
            </span>
            {renaming ? (
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") setRenaming(false);
                }}
                className="flex-1 bg-transparent border border-[var(--accent)] rounded px-1 text-xs outline-none"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="flex-1 truncate">{entry.name}</span>
            )}
          </>
        ) : (
          <>
            <span className="text-[var(--text-secondary)]">📄</span>
            {renaming ? (
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") setRenaming(false);
                }}
                className="flex-1 bg-transparent border border-[var(--accent)] rounded px-1 text-xs outline-none"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="flex-1 truncate">{entry.name}</span>
            )}
          </>
        )}

        {/* Context menu */}
        {showMenu && (
          <div
            ref={menuRef}
            className="fixed z-50 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg shadow-lg py-1 min-w-[120px] text-sm"
            onMouseLeave={() => setShowMenu(false)}
          >
            <button
              className="w-full text-left px-3 py-1.5 hover:bg-[var(--bg-secondary)]"
              onClick={(e) => {
                e.stopPropagation();
                setRenaming(true);
              }}
            >
              重命名
            </button>
            <button
              className="w-full text-left px-3 py-1.5 hover:bg-[var(--bg-secondary)] text-[var(--danger)]"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
            >
              删除
            </button>
          </div>
        )}
      </div>

      {entry.is_dir && expanded && entry.children.length > 0 && (
        <div>
          {entry.children.map((child) => (
            <FileItem key={child.path} entry={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const {
    workspaceRoot,
    files,
    setWorkspace,
    openFileExternal,
    refreshFiles,
    createFile,
    createDir,
  } = useEditorStore();
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const handleOpenFolder = async () => {
    await setWorkspace();
  };

  const handleNewFile = () => {
    if (!workspaceRoot) return;
    const name = prompt("文件名（.md）:", "新建文档.md");
    if (name) {
      createFile(name);
    }
    setShowNewMenu(false);
  };

  const handleNewFolder = () => {
    if (!workspaceRoot) return;
    const name = prompt("文件夹名:", "新建文件夹");
    if (name) {
      createDir(name);
    }
    setShowNewMenu(false);
  };

  return (
    <div className="sidebar w-56 flex-shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--bg-sidebar)] overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          文档
        </span>
        <div className="relative flex items-center gap-1">
          {/* Open file — always visible */}
          <button
            onClick={() => openFileExternal()}
            className="p-1 rounded hover:bg-[var(--bg-primary)] transition-colors"
            title="打开文件"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
          </button>
          {workspaceRoot && (
            <>
              {/* Sort buttons */}
              <div className="flex items-center gap-0.5" title="排序">
                <button
                  onClick={() => handleSort("name")}
                  className={`p-1 rounded transition-colors ${
                    sortKey === "name" ? "bg-[var(--bg-primary)] text-[var(--accent)]" : "hover:bg-[var(--bg-primary)] text-[var(--text-secondary)]"
                  }`}
                  title="按名称排序"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="15" y2="12" />
                    <line x1="3" y1="18" x2="9" y2="18" />
                  </svg>
                </button>
                <button
                  onClick={() => handleSort("date")}
                  className={`p-1 rounded transition-colors ${
                    sortKey === "date" ? "bg-[var(--bg-primary)] text-[var(--accent)]" : "hover:bg-[var(--bg-primary)] text-[var(--text-secondary)]"
                  }`}
                  title="按时间排序"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12,6 12,12 16,14" />
                  </svg>
                </button>
              </div>
              {/* New button */}
              <button
                onClick={() => setShowNewMenu(!showNewMenu)}
                className="p-1 rounded hover:bg-[var(--bg-primary)] transition-colors"
                title="新建"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              {showNewMenu && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg shadow-lg py-1 min-w-[120px] text-sm">
                  <button
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--bg-secondary)]"
                    onClick={handleNewFile}
                  >
                    📄 新建文档
                  </button>
                  <button
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--bg-secondary)]"
                    onClick={handleNewFolder}
                  >
                    📁 新建文件夹
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {workspaceRoot ? (
          sortEntries(files, sortKey, sortOrder).length > 0 ? (
            sortEntries(files, sortKey, sortOrder).map((entry) => (
              <FileItem key={entry.path} entry={entry} />
            ))
          ) : (
            <div className="text-center text-[var(--text-secondary)] text-xs py-8 px-4">
              <p>文件夹为空</p>
              <p className="mt-1">点击上方 + 创建文档</p>
            </div>
          )
        ) : (
          <div className="text-center py-8 px-4">
            <p className="text-[var(--text-secondary)] text-sm mb-4">
              打开一个文件夹
              <br />
              开始编辑 Markdown
            </p>
            <button
              onClick={handleOpenFolder}
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm hover:bg-[var(--accent-hover)] transition-colors"
            >
              打开文件夹
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      {workspaceRoot && (
        <div className="px-3 py-2 border-t border-[var(--border)]">
          <button
            onClick={handleOpenFolder}
            className="w-full text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-left flex items-center gap-1"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
            切换文件夹
          </button>
        </div>
      )}
    </div>
  );
}
